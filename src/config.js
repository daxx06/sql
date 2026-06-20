import { readFile } from "node:fs/promises";

export async function loadJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export function parseList(value) {
  if (!value || value === true) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseRowsSpec(value) {
  const result = { default: 10, tables: new Map() };
  if (!value) return result;

  for (const part of String(value).split(",")) {
    const [rawKey, rawCount] = part.split("=");
    const key = rawKey?.trim();
    const count = Number.parseInt(rawCount, 10);
    if (!key || !Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid row spec: ${part}`);
    }
    if (key === "default") result.default = count;
    else result.tables.set(key, count);
  }

  return result;
}
