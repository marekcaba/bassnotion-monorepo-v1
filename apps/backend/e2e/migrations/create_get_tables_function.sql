CREATE OR REPLACE FUNCTION get_all_tables(schema_name text)
RETURNS TABLE (table_name text)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT c.relname::text
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = schema_name
    AND c.relkind = 'r';  -- 'r' means regular table
END;
$$; 