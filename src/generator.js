import { createRandom } from "./random.js";
import { dependencyOrder, normalizeSchema } from "./schema.js";

const firstNames = ["Avery", "Jordan", "Riley", "Morgan", "Casey", "Taylor", "Quinn", "Jamie"];
const lastNames = ["Patel", "Smith", "Garcia", "Kim", "Brown", "Singh", "Miller", "Davis"];
const companies = ["Northstar Labs", "Blue Finch", "Summit Works", "Clearline", "Metrobyte", "Ironleaf"];
const words = ["alpha", "bravo", "cedar", "delta", "ember", "frost", "harbor", "indigo", "juniper"];

export function generateDataset(schemaInput, options = {}) {
  const schema = normalizeSchema(schemaInput);
  const include = new Set(options.include || []);
  const exclude = new Set(options.exclude || []);
  const selected = schema.tables.filter((table) => {
    const selectedByInclude = include.size === 0 || include.has(table.name) || include.has(table.fullName);
    return selectedByInclude && !exclude.has(table.name) && !exclude.has(table.fullName);
  });
  const orderedTables = dependencyOrder(selected, schema.byName);
  const random = createRandom(options.seed || "default");
  const rowsByTable = new Map();
  const rules = options.rules || {};

  for (const table of orderedTables) {
    const count = rowCountFor(table, options.rows);
    const rows = [];
    for (let index = 0; index < count; index += 1) {
      rows.push(generateRow(table, index, rowsByTable, rules, random, rows));
    }
    rowsByTable.set(table.fullName, rows);
    rowsByTable.set(table.name, rows);
  }

  const tables = orderedTables.map((table) => ({
    schema: table.schema,
    name: table.name,
    fullName: table.fullName,
    columns: table.columns,
    rows: rowsByTable.get(table.fullName) || []
  }));

  return {
    tables,
    summary: {
      seed: options.seed || "default",
      tableOrder: tables.map((table) => table.fullName),
      totalRows: tables.reduce((sum, table) => sum + table.rows.length, 0),
      generatedAt: new Date().toISOString(),
      skippedTables: schema.tables
        .filter((table) => !tables.some((selectedTable) => selectedTable.fullName === table.fullName))
        .map((table) => table.fullName)
    }
  };
}

function rowCountFor(table, rowsSpec) {
  if (!rowsSpec) return 10;
  return rowsSpec.tables?.get(table.name) ?? rowsSpec.tables?.get(table.fullName) ?? rowsSpec.default ?? 10;
}

function generateRow(table, index, rowsByTable, rules, random, existingRows) {
  const row = {};
  for (const column of table.columns) {
    if (column.identity) {
      row[column.name] = index + 1;
      continue;
    }

    if (column.references) {
      row[column.name] = referencedValue(table, column, index, rowsByTable, random);
      continue;
    }

    const rule = rules[`${table.name}.${column.name}`] || rules[`${table.fullName}.${column.name}`] || rules[column.name];
    row[column.name] = uniqueValueFor(column, rule, index, random, existingRows);
  }
  return row;
}

function referencedValue(table, column, index, rowsByTable, random) {
  const referencedRows = rowsByTable.get(column.references.table);
  if (!referencedRows || referencedRows.length === 0) {
    if (column.nullable) return null;
    throw new Error(`${column.name} cannot reference ${column.references.table}; no parent rows generated.`);
  }
  if (column.unique && index >= referencedRows.length) {
    throw new Error(`${table.fullName}.${column.name} is unique but needs ${index + 1} parent rows from ${column.references.table}.`);
  }
  const parent = column.unique ? referencedRows[index % referencedRows.length] : random.pick(referencedRows);
  return parent[column.references.column];
}

function uniqueValueFor(column, rule, index, random, existingRows) {
  const first = valueFor(column, rule, index, random);
  if (!column.unique || first === null || first === undefined) return first;

  const used = new Set(existingRows.map((row) => row[column.name]));
  if (!used.has(first)) return first;

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const candidate = valueFor(column, rule, index + attempt * 100000, random);
    if (!used.has(candidate)) return candidate;
  }

  throw new Error(`${column.name} is unique but generated duplicate values.`);
}

function valueFor(column, rule, index, random) {
  if (rule?.kind === "null") return null;
  if (column.nullable && random.next() < 0.06) return null;

  if (rule) return ruleValue(rule, column, index, random);

  const name = column.name.toLowerCase();
  const type = column.type.toLowerCase();

  if (name.includes("email")) return email(index, "example.test");
  if (name.includes("phone")) return `+1-555-${String(1000000 + index).slice(1)}`;
  if (name.includes("url") || name.includes("website")) return `https://example.test/${words[index % words.length]}`;
  if (name.includes("name")) return fullName(index);
  if (name.includes("company")) return random.pick(companies);
  if (name.includes("status")) return random.pick(["new", "active", "paused", "closed"]);
  if (name.includes("sku")) return `SKU-${String(index + 1).padStart(6, "0")}`;
  if (name.includes("uuid") || type.includes("uniqueidentifier")) return uuid(index);
  if (name.includes("created") || name.includes("updated") || name.endsWith("_at") || type.includes("date")) return dateValue(index);
  if (type.includes("bit")) return random.next() >= 0.5;
  if (type.includes("int") || type.includes("decimal") || type.includes("money") || type.includes("numeric")) return random.int(1, 10000);
  if (type.includes("binary") || type.includes("image")) return null;

  return `${rule?.prefix || "value"}-${index + 1}`;
}

function ruleValue(rule, column, index, random) {
  switch (rule.kind) {
    case "email":
      return email(index, rule.domain || "example.test");
    case "name":
      return fullName(index);
    case "company":
      return random.pick(companies);
    case "phone":
      return `+1-555-${String(1000000 + index).slice(1)}`;
    case "url":
      return `${rule.base || "https://example.test"}/${words[index % words.length]}`;
    case "pick":
      if (!Array.isArray(rule.values) || rule.values.length === 0) throw new Error(`${column.name} pick rule needs values.`);
      return random.pick(rule.values);
    case "number":
      return random.int(rule.min ?? 1, rule.max ?? 10000);
    case "boolean":
      return random.next() >= 0.5;
    case "date":
      return dateValue(index, rule.start);
    case "uuid":
      return uuid(index);
    case "text":
      return `${rule.prefix || "value"}${String(index + 1).padStart(rule.pad || 4, "0")}`;
    default:
      throw new Error(`Unsupported rule kind: ${rule.kind}`);
  }
}

function email(index, domain) {
  return `user${String(index + 1).padStart(4, "0")}@${domain}`;
}

function fullName(index) {
  return `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`;
}

function dateValue(index, start = "2025-01-01T09:00:00.000Z") {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString();
}

function uuid(index) {
  const hex = String(index + 1).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}
