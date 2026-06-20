#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateDataset } from "./generator.js";
import { parseRowsSpec, parseList, loadJson } from "./config.js";
import { renderCsvFiles, renderSqlServerInsertScript } from "./renderers.js";

async function main(argv) {
  const args = parseArgs(argv);

  if (args.help || args.h) {
    printHelp();
    return;
  }

  if (args["direct-seed"]) {
    throw new Error("Direct database writes are intentionally disabled in this MVP. Generate SQL/CSV and review before applying.");
  }

  const schemaPath = requireArg(args, "schema");
  const outDir = requireArg(args, "out");
  const formats = parseList(args.format || "sql");
  const schema = await loadJson(schemaPath);
  const rules = args.rules ? await loadJson(args.rules) : {};

  const dataset = generateDataset(schema, {
    seed: args.seed || "default",
    rows: parseRowsSpec(args.rows || "default=10"),
    include: parseList(args.include),
    exclude: parseList(args.exclude),
    rules
  });

  await mkdir(outDir, { recursive: true });

  if (formats.includes("sql")) {
    await writeFile(path.join(outDir, "seed.sql"), renderSqlServerInsertScript(dataset), "utf8");
  }

  if (formats.includes("csv")) {
    for (const file of renderCsvFiles(dataset)) {
      await writeFile(path.join(outDir, file.name), file.content, "utf8");
    }
  }

  await writeFile(path.join(outDir, "summary.json"), JSON.stringify(dataset.summary, null, 2), "utf8");
  console.log(`Generated ${dataset.summary.totalRows} rows across ${dataset.tables.length} tables in ${outDir}`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function requireArg(args, key) {
  if (!args[key]) throw new Error(`Missing required --${key}`);
  return args[key];
}

function printHelp() {
  console.log(`sql-seed

Required:
  --schema <path>       JSON schema export
  --out <dir>           Output directory

Options:
  --format <list>       sql, csv, or sql,csv. Default: sql
  --rows <spec>         default=10,users=100,orders=250
  --seed <value>        Deterministic seed
  --include <list>      Comma-separated table names
  --exclude <list>      Comma-separated table names
  --rules <path>        JSON custom rule overrides
  --direct-seed         Refused in MVP for safety
`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
