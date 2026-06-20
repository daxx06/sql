-- =====================================================================
-- SeedForge SQL Schema Exporter
-- Run this script in SQL Server Management Studio (SSMS) or Azure Data Studio.
-- It generates the exact JSON schema required by the SeedForge playground and CLI.
-- =====================================================================

SELECT 
    s.name AS [schema],
    t.name AS [name],
    (
        SELECT 
            c.name AS [name],
            tp.name AS [type],
            CAST(c.is_nullable AS bit) AS [nullable],
            CAST(c.is_identity AS bit) AS [identity],
            CAST(CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS bit) AS [primaryKey],
            (
                SELECT TOP 1
                    rt.name AS [table],
                    rc.name AS [column]
                FROM sys.foreign_key_columns fkc
                INNER JOIN sys.tables rt ON fkc.referenced_object_id = rt.object_id
                INNER JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
                WHERE fkc.parent_object_id = t.object_id AND fkc.parent_column_id = c.column_id
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            ) AS [references]
        FROM sys.columns c
        INNER JOIN sys.types tp ON c.user_type_id = tp.user_type_id
        LEFT JOIN (
            SELECT ic.column_id, ic.object_id
            FROM sys.index_columns ic
            INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            WHERE i.is_primary_key = 1
        ) pk ON t.object_id = pk.object_id AND c.column_id = pk.column_id
        WHERE c.object_id = t.object_id
        FOR JSON PATH
    ) AS [columns]
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.is_ms_shipped = 0 -- Exclude system tables
FOR JSON PATH, ROOT('tables')
