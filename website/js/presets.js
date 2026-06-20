export const presets = {
  ecommerce: {
    name: "E-Commerce & Invoicing",
    description: "5 tables featuring users, products, orders, order items, and invoices with 1-to-many and 1-to-1 relationships.",
    schema: {
      "tables": [
        {
          "schema": "dbo",
          "name": "users",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "email", "type": "nvarchar", "nullable": false, "unique": true },
            { "name": "full_name", "type": "nvarchar", "nullable": false },
            { "name": "created_at", "type": "datetime2", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "products",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "name", "type": "nvarchar", "nullable": false },
            { "name": "sku", "type": "nvarchar", "nullable": false, "unique": true },
            { "name": "price_cents", "type": "int", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "orders",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "user_id", "type": "int", "nullable": false, "references": { "table": "users", "column": "id" } },
            { "name": "status", "type": "nvarchar", "nullable": false },
            { "name": "created_at", "type": "datetime2", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "order_items",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "order_id", "type": "int", "nullable": false, "references": { "table": "orders", "column": "id" } },
            { "name": "product_id", "type": "int", "nullable": false, "references": { "table": "products", "column": "id" } },
            { "name": "quantity", "type": "int", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "invoices",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "order_id", "type": "int", "nullable": false, "unique": true, "references": { "table": "orders", "column": "id" } },
            { "name": "invoice_number", "type": "nvarchar", "nullable": false, "unique": true },
            { "name": "issued_at", "type": "datetime2", "nullable": false }
          ]
        }
      ]
    },
    rules: {
      "users.email": { "kind": "email", "domain": "example.test" },
      "orders.status": { "kind": "pick", "values": ["draft", "paid", "fulfilled", "cancelled"] },
      "products.price_cents": { "kind": "number", "min": 500, "max": 25000 },
      "order_items.quantity": { "kind": "number", "min": 1, "max": 5 },
      "invoice_number": { "kind": "text", "prefix": "INV-" }
    },
    defaultRows: "users=8,products=15,orders=12,order_items=24,invoices=6"
  },
  saas: {
    name: "SaaS App & Activity",
    description: "4 tables modeling multi-tenant accounts, user memberships, plan subscriptions, and user action logs.",
    schema: {
      "tables": [
        {
          "schema": "dbo",
          "name": "accounts",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "company_name", "type": "nvarchar", "nullable": false },
            { "name": "website_url", "type": "nvarchar", "nullable": true },
            { "name": "created_at", "type": "datetime2", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "users",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "account_id", "type": "int", "nullable": false, "references": { "table": "accounts", "column": "id" } },
            { "name": "email", "type": "nvarchar", "nullable": false, "unique": true },
            { "name": "full_name", "type": "nvarchar", "nullable": false },
            { "name": "is_admin", "type": "bit", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "subscriptions",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "account_id", "type": "int", "nullable": false, "unique": true, "references": { "table": "accounts", "column": "id" } },
            { "name": "plan_name", "type": "nvarchar", "nullable": false },
            { "name": "status", "type": "nvarchar", "nullable": false },
            { "name": "started_at", "type": "datetime2", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "activity_logs",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "user_id", "type": "int", "nullable": false, "references": { "table": "users", "column": "id" } },
            { "name": "action_name", "type": "nvarchar", "nullable": false },
            { "name": "ip_address", "type": "nvarchar", "nullable": true },
            { "name": "created_at", "type": "datetime2", "nullable": false }
          ]
        }
      ]
    },
    rules: {
      "subscriptions.plan_name": { "kind": "pick", "values": ["Starter", "Professional", "Enterprise"] },
      "subscriptions.status": { "kind": "pick", "values": ["active", "trialing", "past_due", "canceled"] },
      "activity_logs.action_name": { "kind": "pick", "values": ["login", "export_data", "invite_user", "update_billing", "logout"] },
      "accounts.website_url": { "kind": "url", "base": "https://company.test" }
    },
    defaultRows: "accounts=5,users=10,subscriptions=5,activity_logs=30"
  },
  pm: {
    name: "Project Management",
    description: "4 tables representing organizations, sub-teams, projects, and work items with dates and priorities.",
    schema: {
      "tables": [
        {
          "schema": "dbo",
          "name": "organizations",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "name", "type": "nvarchar", "nullable": false },
            { "name": "subdomain", "type": "nvarchar", "nullable": false, "unique": true },
            { "name": "created_at", "type": "datetime2", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "teams",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "organization_id", "type": "int", "nullable": false, "references": { "table": "organizations", "column": "id" } },
            { "name": "team_name", "type": "nvarchar", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "projects",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "team_id", "type": "int", "nullable": false, "references": { "table": "teams", "column": "id" } },
            { "name": "title", "type": "nvarchar", "nullable": false },
            { "name": "status", "type": "nvarchar", "nullable": false }
          ]
        },
        {
          "schema": "dbo",
          "name": "tasks",
          "columns": [
            { "name": "id", "type": "int", "nullable": false, "identity": true, "primaryKey": true },
            { "name": "project_id", "type": "int", "nullable": false, "references": { "table": "projects", "column": "id" } },
            { "name": "title", "type": "nvarchar", "nullable": false },
            { "name": "due_date", "type": "datetime2", "nullable": true },
            { "name": "priority", "type": "nvarchar", "nullable": false }
          ]
        }
      ]
    },
    rules: {
      "projects.status": { "kind": "pick", "values": ["planning", "active", "completed", "archived"] },
      "tasks.priority": { "kind": "pick", "values": ["low", "medium", "high", "critical"] },
      "organizations.subdomain": { "kind": "text", "prefix": "org-" }
    },
    defaultRows: "organizations=4,teams=8,projects=12,tasks=40"
  }
};
