import { presets } from "./js/presets.js";
import { generateDataset } from "./js/core/generator.js";
import { renderSqlServerInsertScript, renderCsvFiles } from "./js/core/renderers.js";

// DOM Elements
const presetSelect = document.querySelector("#presetSelect");
const playgroundSeed = document.querySelector("#playgroundSeed");
const tableList = document.querySelector("#tableList");
const tabsGroup = document.querySelector("#tabsGroup");
const copyBtn = document.querySelector("#copyBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const outputCode = document.querySelector("#outputCode");
const playgroundSpeedText = document.querySelector("#playgroundSpeedText");
const playgroundTotalRows = document.querySelector("#playgroundTotalRows");

// ROI Elements
const hourlyRateInput = document.querySelector("#hourlyRate");
const hoursSavedInput = document.querySelector("#hoursSaved");
const rateValue = document.querySelector("#rateValue");
const hoursValue = document.querySelector("#hoursValue");
const roiOutput = document.querySelector("#roiOutput");

// State
let activePreset = presets.ecommerce;
let activeTab = "sql";
let rowsState = {}; // maps tableName -> count
let generatedDataset = null;
let activeCsvFileIndex = 0; // index of active CSV in the dataset.tables list
let csvFileSelectElement = null;

// Initialize
function init() {
  // Modal Elements
  const importModal = document.querySelector("#importModal");
  const closeModalBtn = document.querySelector("#closeModalBtn");
  const cancelModalBtn = document.querySelector("#cancelModalBtn");
  const copyExporterBtn = document.querySelector("#copyExporterBtn");
  const applySchemaBtn = document.querySelector("#applySchemaBtn");
  const customSchemaInput = document.querySelector("#customSchemaInput");
  const importError = document.querySelector("#importError");
  const sqlExporterScript = document.querySelector("#sqlExporterScript");

  let previousPresetKey = "ecommerce";

  // Preset Select Listener
  presetSelect.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      importModal.style.display = "flex";
      customSchemaInput.value = "";
      importError.style.display = "none";
      importError.textContent = "";
      presetSelect.value = previousPresetKey;
    } else if (e.target.value === "custom_active") {
      // Keep active
    } else {
      previousPresetKey = e.target.value;
      loadPreset(e.target.value);
    }
  });

  // Modal Close Actions
  const closeModal = () => {
    importModal.style.display = "none";
  };
  closeModalBtn.addEventListener("click", closeModal);
  cancelModalBtn.addEventListener("click", closeModal);

  // Copy Exporter Script to Clipboard
  copyExporterBtn.addEventListener("click", () => {
    const scriptText = sqlExporterScript.textContent;
    navigator.clipboard.writeText(scriptText)
      .then(() => {
        const originalText = copyExporterBtn.textContent;
        copyExporterBtn.textContent = "Copied!";
        copyExporterBtn.style.color = "var(--emerald)";
        setTimeout(() => {
          copyExporterBtn.textContent = originalText;
          copyExporterBtn.style.color = "";
        }, 1500);
      });
  });

  // Apply Custom Schema Parser
  applySchemaBtn.addEventListener("click", () => {
    const rawVal = customSchemaInput.value.trim();
    if (!rawVal) {
      showError("Please paste a JSON schema output.");
      return;
    }

    try {
      const parsed = JSON.parse(rawVal);
      if (!parsed.tables || !Array.isArray(parsed.tables)) {
        showError("Invalid schema format: JSON must contain a 'tables' array.");
        return;
      }
      
      for (const t of parsed.tables) {
        if (!t.name || !Array.isArray(t.columns)) {
          showError(`Table error: Each table must have a name and columns array.`);
          return;
        }
      }

      // Generate a default rows configuration string
      const defaultRowsList = parsed.tables.map(t => `${t.name}=10`).join(",");

      // Load custom schema as a preset
      activePreset = {
        name: "Custom Schema",
        description: "Custom SQL Server schema loaded from SSMS JSON output.",
        schema: parsed,
        rules: {},
        defaultRows: defaultRowsList
      };

      // Set active preset state
      rowsState = {};
      parsed.tables.forEach(t => {
        rowsState[t.name] = 10;
      });

      // Update dropdown option or keep it custom
      let customOpt = presetSelect.querySelector('option[value="custom_active"]');
      if (!customOpt) {
        customOpt = document.createElement("option");
        customOpt.value = "custom_active";
        presetSelect.appendChild(customOpt);
      }
      customOpt.textContent = "Custom Schema (" + parsed.tables.length + " tables)";
      customOpt.selected = true;
      previousPresetKey = "custom_active";

      // Render
      renderSidebarTables();
      runGeneration();

      // Close modal
      closeModal();
    } catch (err) {
      showError("Invalid JSON: " + err.message);
    }
  });

  function showError(msg) {
    importError.textContent = msg;
    importError.style.display = "block";
  }

  // Seed Input Listener
  playgroundSeed.addEventListener("input", () => {
    runGeneration();
  });

  // Tabs Listeners
  tabsGroup.addEventListener("click", (e) => {
    const tabBtn = e.target.closest(".tab-btn");
    if (!tabBtn) return;
    
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    tabBtn.classList.add("active");
    activeTab = tabBtn.dataset.tab;
    
    renderOutput();
  });

  // Copy Listener
  copyBtn.addEventListener("click", handleCopy);

  // Download Listener
  downloadBtn.addEventListener("click", handleDownload);

  // ROI Calculator Listeners
  [hourlyRateInput, hoursSavedInput].forEach(input => {
    input.addEventListener("input", updateRoi);
  });

  // Load Initial Preset
  loadPreset("ecommerce");
  updateRoi();
}

// Load Preset Data
function loadPreset(presetKey) {
  activePreset = presets[presetKey];
  if (!activePreset) return;

  // Parse default rows spec (e.g. "users=8,products=15")
  rowsState = {};
  const parts = activePreset.defaultRows.split(",");
  for (const part of parts) {
    const [name, count] = part.split("=");
    rowsState[name.trim()] = parseInt(count.trim(), 10) || 10;
  }

  // Render Table Sidebar List
  renderSidebarTables();

  // Run generation loop
  runGeneration();
}

// Render Table list inside Sidebar
function renderSidebarTables() {
  tableList.innerHTML = "";
  
  const tables = activePreset.schema.tables;
  tables.forEach(table => {
    const rowCount = rowsState[table.name] ?? 10;
    
    const card = document.createElement("div");
    card.className = "table-list-item";
    card.dataset.tableName = table.name;
    
    // Column details preview
    const colsPreview = table.columns
      .map(c => `${c.name} (${c.type}${c.identity ? " 🔑" : ""}${c.references ? " 🔗" : ""})`)
      .join("<br>• ");

    card.innerHTML = `
      <div class="table-name" title="${table.fullName}">
        ${table.fullName}
      </div>
      <div class="table-meta">
        <span>${table.columns.length} columns</span>
        <input type="number" min="0" max="200" value="${rowCount}" data-table="${table.name}" aria-label="${table.fullName} row count">
      </div>
      <div class="table-columns-details" style="font-size: 9px; color: var(--text-muted); margin-top: 6px; display: none; line-height: 1.3;">
        • ${colsPreview}
      </div>
    `;

    // Toggle showing columns when clicking table list card header
    card.addEventListener("click", (e) => {
      // Don't toggle details if user is editing the row input count box
      if (e.target.tagName.toLowerCase() === "input") return;
      
      document.querySelectorAll(".table-list-item").forEach(item => {
        if (item !== card) {
          item.classList.remove("active");
          item.querySelector(".table-columns-details").style.display = "none";
        }
      });

      card.classList.toggle("active");
      const details = card.querySelector(".table-columns-details");
      details.style.display = details.style.display === "none" ? "block" : "none";
    });

    // Input row counts editor listener
    const numInput = card.querySelector("input");
    numInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      rowsState[table.name] = isNaN(val) ? 0 : Math.max(0, val);
      runGeneration();
    });

    tableList.appendChild(card);
  });
}

// Run deterministic generation loop
function runGeneration() {
  const seed = playgroundSeed.value || "default";
  
  // Format Rows Spec correctly for generator.js
  const rowsSpec = {
    default: 10,
    tables: new Map(Object.entries(rowsState))
  };

  const startTime = performance.now();
  
  try {
    generatedDataset = generateDataset(activePreset.schema, {
      seed: seed,
      rows: rowsSpec,
      rules: activePreset.rules
    });

    const elapsed = (performance.now() - startTime).toFixed(1);
    
    playgroundSpeedText.textContent = `Generated in ${elapsed}ms`;
    playgroundTotalRows.textContent = `${generatedDataset.summary.totalRows} rows`;
    
    // Automatically render active tab
    renderOutput();
  } catch (err) {
    outputCode.innerHTML = `<span style="color:#ef4444; font-weight:700;">Generation Error:</span>\n${err.message}`;
    playgroundSpeedText.textContent = "Error";
    playgroundTotalRows.textContent = "0 rows";
  }
}

// Render generated outputs inside viewport based on activeTab
function renderOutput() {
  if (!generatedDataset) return;

  // Clear dynamically injected CSV dropdown if visible
  removeCsvFileSelector();

  switch (activeTab) {
    case "sql": {
      const sqlScript = renderSqlServerInsertScript(generatedDataset);
      outputCode.innerHTML = highlightSql(sqlScript);
      break;
    }
    case "csv": {
      const csvFiles = renderCsvFiles(generatedDataset);
      if (csvFiles.length === 0) {
        outputCode.textContent = "-- No CSV files generated.";
        break;
      }
      
      // Inject CSV file selection dropdown in tab actions
      injectCsvFileSelector(csvFiles);

      // Display active file index
      if (activeCsvFileIndex >= csvFiles.length) activeCsvFileIndex = 0;
      outputCode.textContent = csvFiles[activeCsvFileIndex].content;
      break;
    }
    case "rules": {
      outputCode.textContent = JSON.stringify(activePreset.rules, null, 2);
      break;
    }
    case "schema": {
      outputCode.textContent = JSON.stringify(activePreset.schema, null, 2);
      break;
    }
  }
}

// Simulates basic syntax highlighting for SQL
function highlightSql(sql) {
  let escaped = sql
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
    
  // Comments
  escaped = escaped.replace(/(--.*)/g, '<span class="hl-comment">$1</span>');
  
  // SQL Keywords
  const keywords = [
    "SET XACT_ABORT ON", "BEGIN TRANSACTION", "COMMIT TRANSACTION",
    "SET IDENTITY_INSERT ON", "SET IDENTITY_INSERT OFF",
    "SET IDENTITY_INSERT", "ON", "OFF",
    "INSERT INTO", "VALUES", "NULL"
  ];
  
  for (const kw of keywords) {
    // Regex matching keyword boundary
    const regex = new RegExp(`\\b${kw}\\b`, "g");
    escaped = escaped.replace(regex, `<span class="hl-keyword">${kw}</span>`);
  }
  
  // Strings
  escaped = escaped.replace(/(N'.*?')/g, '<span class="hl-string">$1</span>');
  
  // Numbers
  escaped = escaped.replace(/\b(\d+)\b/g, '<span class="hl-number">$1</span>');
  
  return escaped;
}

// Injects dropdown for CSV file picking
function injectCsvFileSelector(csvFiles) {
  const tabActions = document.querySelector(".tab-actions");
  
  // Create selector dropdown
  const select = document.createElement("select");
  select.id = "csvFileSelect";
  select.className = "playground-preset-select";
  select.style.fontSize = "11px";
  select.style.padding = "2px 8px";
  
  csvFiles.forEach((file, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.textContent = file.name;
    if (index === activeCsvFileIndex) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", (e) => {
    activeCsvFileIndex = parseInt(e.target.value, 10);
    outputCode.textContent = csvFiles[activeCsvFileIndex].content;
  });

  // Insert before the Copy button
  tabActions.insertBefore(select, copyBtn);
  csvFileSelectElement = select;
}

// Clean up injected CSV selector
function removeCsvFileSelector() {
  if (csvFileSelectElement) {
    csvFileSelectElement.remove();
    csvFileSelectElement = null;
  }
}

// Clipboard copying action
function handleCopy() {
  let textToCopy = "";
  
  if (activeTab === "sql") {
    textToCopy = renderSqlServerInsertScript(generatedDataset);
  } else if (activeTab === "csv") {
    const csvFiles = renderCsvFiles(generatedDataset);
    textToCopy = csvFiles[activeCsvFileIndex]?.content || "";
  } else if (activeTab === "rules") {
    textToCopy = JSON.stringify(activePreset.rules, null, 2);
  } else if (activeTab === "schema") {
    textToCopy = JSON.stringify(activePreset.schema, null, 2);
  }

  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      const originalHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span style="color: var(--emerald)">Copied!</span>
      `;
      setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
      }, 1500);
    })
    .catch(err => {
      console.error("Clipboard copy failed: ", err);
    });
}

// File triggers download action
function handleDownload() {
  let fileContent = "";
  let filename = "";
  let mimeType = "text/plain";

  if (activeTab === "sql") {
    fileContent = renderSqlServerInsertScript(generatedDataset);
    filename = "seed.sql";
    mimeType = "text/plain;charset=utf-8";
  } else if (activeTab === "csv") {
    const csvFiles = renderCsvFiles(generatedDataset);
    const activeFile = csvFiles[activeCsvFileIndex];
    if (!activeFile) return;
    fileContent = activeFile.content;
    filename = activeFile.name;
    mimeType = "text/csv;charset=utf-8";
  } else if (activeTab === "rules") {
    fileContent = JSON.stringify(activePreset.rules, null, 2);
    filename = "rules.json";
    mimeType = "application/json;charset=utf-8";
  } else if (activeTab === "schema") {
    fileContent = JSON.stringify(activePreset.schema, null, 2);
    filename = "schema.json";
    mimeType = "application/json;charset=utf-8";
  }

  // Trigger download link
  const blob = new Blob([fileContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ROI calculations
function updateRoi() {
  const rate = parseInt(hourlyRateInput.value, 10) || 75;
  const hours = parseInt(hoursSavedInput.value, 10) || 8;

  // Update text label display
  rateValue.textContent = `$${rate}`;
  hoursValue.textContent = `${hours} hrs`;

  // Time-savings math
  const grossSavings = rate * hours;
  
  roiOutput.innerHTML = `
    $${grossSavings} saved per month
    <span>approx. ${hours} developer hours reclaimed</span>
  `;
  roiOutput.style.background = "linear-gradient(135deg, var(--cyan), var(--emerald))";
  roiOutput.style.color = "var(--text-inverse)";
}

// Run app initializer
document.addEventListener("DOMContentLoaded", init);
if (document.readyState === "complete" || document.readyState === "interactive") {
  init();
}
