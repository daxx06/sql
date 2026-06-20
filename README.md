# SQL Seed MVP

Dependency-free Node CLI for generating deterministic fake SQL Server seed data from an exported schema.

## Quick Start

```powershell
node .\src\cli.js --schema .\examples\five-table-schema.json --out .\out --format sql,csv --rows default=10 --seed pilot
```

Outputs:

- `seed.sql`: SQL Server `INSERT` statements in dependency-safe table order.
- `*.csv`: one CSV file per generated table.
- `summary.json`: generation counts, order, and skipped tables.

## CLI Options

```text
--schema <path>       Required. JSON schema export.
--out <dir>           Required. Output directory.
--format <list>       sql, csv, or sql,csv. Default: sql.
--rows <spec>         default=10,users=100,orders=250
--seed <value>        Deterministic seed. Default: default.
--include <list>      Comma-separated table names to include.
--exclude <list>      Comma-separated table names to skip.
--rules <path>        JSON custom rule overrides.
--direct-seed         Required acknowledgement for future direct DB writes. Currently refused.
```

## Schema Shape

```json
{
  "tables": [
    {
      "name": "users",
      "schema": "dbo",
      "columns": [
        { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
        { "name": "email", "type": "nvarchar", "nullable": false, "unique": true },
        { "name": "created_at", "type": "datetime2", "nullable": false }
      ]
    },
    {
      "name": "orders",
      "columns": [
        { "name": "id", "type": "int", "identity": true, "primaryKey": true },
        { "name": "user_id", "type": "int", "nullable": false, "references": { "table": "users", "column": "id" } }
      ]
    }
  ]
}
```

## Custom Rules

Rules are matched by `table.column`, then by column name.

```json
{
  "users.email": { "kind": "email", "domain": "pilot.test" },
  "status": { "kind": "pick", "values": ["new", "active", "paused"] },
  "orders.total_cents": { "kind": "number", "min": 500, "max": 25000 }
}
```

Supported rule kinds: `email`, `name`, `company`, `phone`, `url`, `pick`, `number`, `boolean`, `date`, `text`, `uuid`, `null`.

## Safety

This MVP is read/export oriented. It writes only local output files. `--direct-seed` intentionally exits with an error until a real SQL Server connector and explicit target confirmation are added.

## Website

Open `website/index.html` in a browser to view the customer-facing landing page and pricing/ROI explanation.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
