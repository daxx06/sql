export function normalizeSchema(input) {
  if (!input || !Array.isArray(input.tables)) {
    throw new Error("Schema must contain a tables array.");
  }

  const tables = input.tables.map((table) => {
    if (!table.name || !Array.isArray(table.columns)) {
      throw new Error("Each table must contain name and columns.");
    }
    return {
      schema: table.schema || "dbo",
      name: table.name,
      fullName: `${table.schema || "dbo"}.${table.name}`,
      columns: table.columns.map((column) => ({
        nullable: true,
        type: "nvarchar",
        ...column
      }))
    };
  });

  const byName = new Map();
  for (const table of tables) {
    byName.set(table.name, table);
    byName.set(table.fullName, table);
  }

  return { tables, byName };
}

export function dependencyOrder(tables, byName) {
  const result = [];
  const temporary = new Set();
  const permanent = new Set();

  function visit(table) {
    if (permanent.has(table.fullName)) return;
    if (temporary.has(table.fullName)) {
      return; // Cycle detected: break cycle and return gracefully
    }

    temporary.add(table.fullName);
    for (const dep of tableDependencies(table, byName)) visit(dep);
    temporary.delete(table.fullName);
    permanent.add(table.fullName);
    result.push(table);
  }

  for (const table of tables) visit(table);
  return result;
}

export function tableDependencies(table, byName) {
  const deps = [];
  for (const column of table.columns) {
    if (!column.references?.table) continue;
    const referenced = byName.get(column.references.table);
    if (!referenced) throw new Error(`${table.fullName}.${column.name} references unknown table ${column.references.table}`);
    if (referenced.fullName !== table.fullName) deps.push(referenced);
  }
  return deps;
}
