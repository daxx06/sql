import test from "node:test";
import assert from "node:assert/strict";
import { generateDataset } from "../src/generator.js";
import { parseRowsSpec } from "../src/config.js";
import { renderSqlServerInsertScript } from "../src/renderers.js";

const schema = {
  tables: [
    {
      name: "parents",
      columns: [
        { name: "id", type: "int", nullable: false, identity: true, primaryKey: true },
        { name: "email", type: "nvarchar", nullable: false, unique: true }
      ]
    },
    {
      name: "children",
      columns: [
        { name: "id", type: "int", nullable: false, identity: true, primaryKey: true },
        { name: "parent_id", type: "int", nullable: false, references: { table: "parents", column: "id" } },
        { name: "status", type: "nvarchar", nullable: false }
      ]
    }
  ]
};

test("generates parent tables before child tables", () => {
  const dataset = generateDataset(schema, {
    seed: "test",
    rows: parseRowsSpec("default=3,children=5")
  });

  assert.deepEqual(dataset.summary.tableOrder, ["dbo.parents", "dbo.children"]);
  assert.equal(dataset.tables[0].rows.length, 3);
  assert.equal(dataset.tables[1].rows.length, 5);

  const parentIds = new Set(dataset.tables[0].rows.map((row) => row.id));
  for (const row of dataset.tables[1].rows) {
    assert.equal(parentIds.has(row.parent_id), true);
  }
});

test("uses deterministic seed output", () => {
  const options = { seed: "same", rows: parseRowsSpec("default=2") };
  assert.deepEqual(generateDataset(schema, options).tables, generateDataset(schema, options).tables);
});

test("applies custom rules", () => {
  const dataset = generateDataset(schema, {
    seed: "rules",
    rows: parseRowsSpec("default=2"),
    rules: {
      "parents.email": { kind: "email", domain: "pilot.test" },
      status: { kind: "pick", values: ["ready"] }
    }
  });

  assert.match(dataset.tables[0].rows[0].email, /@pilot\.test$/);
  assert.equal(dataset.tables[1].rows[0].status, "ready");
});

test("renders SQL Server insert script with identity insert", () => {
  const dataset = generateDataset(schema, { seed: "sql", rows: parseRowsSpec("default=1") });
  const sql = renderSqlServerInsertScript(dataset);

  assert.match(sql, /SET IDENTITY_INSERT \[dbo\]\.\[parents\] ON;/);
  assert.match(sql, /INSERT INTO \[dbo\]\.\[children\]/);
  assert.match(sql, /COMMIT TRANSACTION;/);
});

test("refuses impossible one-to-one foreign key counts", () => {
  assert.throws(
    () =>
      generateDataset(
        {
          tables: [
            {
              name: "orders",
              columns: [{ name: "id", type: "int", identity: true, primaryKey: true, nullable: false }]
            },
            {
              name: "invoices",
              columns: [
                { name: "id", type: "int", identity: true, primaryKey: true, nullable: false },
                { name: "order_id", type: "int", nullable: false, unique: true, references: { table: "orders", column: "id" } }
              ]
            }
          ]
        },
        { rows: parseRowsSpec("orders=1,invoices=2") }
      ),
    /unique/
  );
});

test("handles a simulated 300 table dependency chain", () => {
  const bigSchema = {
    tables: Array.from({ length: 300 }, (_, index) => ({
      name: `table_${index + 1}`,
      columns: [
        { name: "id", type: "int", identity: true, primaryKey: true, nullable: false },
        ...(index === 0
          ? []
          : [{ name: "parent_id", type: "int", nullable: false, references: { table: `table_${index}`, column: "id" } }]),
        { name: "label", type: "nvarchar", nullable: false }
      ]
    }))
  };

  const dataset = generateDataset(bigSchema, { seed: "big", rows: parseRowsSpec("default=1") });

  assert.equal(dataset.tables.length, 300);
  assert.equal(dataset.summary.totalRows, 300);
  assert.equal(dataset.summary.tableOrder.at(0), "dbo.table_1");
  assert.equal(dataset.summary.tableOrder.at(-1), "dbo.table_300");
});

test("handles circular/cyclic table dependencies gracefully", () => {
  const circularSchema = {
    tables: [
      {
        name: "employees",
        columns: [
          { name: "id", type: "int", identity: true, primaryKey: true, nullable: false },
          { name: "name", type: "nvarchar", nullable: false },
          { name: "manager_id", type: "int", nullable: true, references: { table: "employees", column: "id" } },
          { name: "department_id", type: "int", nullable: false, references: { table: "departments", column: "id" } }
        ]
      },
      {
        name: "departments",
        columns: [
          { name: "id", type: "int", identity: true, primaryKey: true, nullable: false },
          { name: "name", type: "nvarchar", nullable: false },
          { name: "head_id", type: "int", nullable: false, references: { table: "employees", column: "id" } }
        ]
      }
    ]
  };

  // This should not throw a "Circular table dependency" error
  const dataset = generateDataset(circularSchema, {
    seed: "circular",
    rows: parseRowsSpec("default=2")
  });

  assert.equal(dataset.tables.length, 2);
  assert.equal(dataset.summary.totalRows, 4); // 2 tables * 2 rows = 4

  const sql = renderSqlServerInsertScript(dataset);
  // Verify that it disables constraints temporarily
  assert.match(sql, /ALTER TABLE \[dbo\]\.\[employees\] NOCHECK CONSTRAINT ALL;/);
  assert.match(sql, /ALTER TABLE \[dbo\]\.\[departments\] NOCHECK CONSTRAINT ALL;/);
  assert.match(sql, /ALTER TABLE \[dbo\]\.\[employees\] WITH CHECK CHECK CONSTRAINT ALL;/);
  assert.match(sql, /ALTER TABLE \[dbo\]\.\[departments\] WITH CHECK CHECK CONSTRAINT ALL;/);
});
