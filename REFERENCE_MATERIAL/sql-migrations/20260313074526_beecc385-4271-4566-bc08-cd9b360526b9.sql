
CREATE OR REPLACE FUNCTION add_column(
  table_name text, column_name text, column_type text
) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s', table_name, column_name, column_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION rename_column(
  table_name text, old_column_name text, new_column_name text
) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', table_name, old_column_name, new_column_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION drop_column(
  table_name text, column_name text
) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I', table_name, column_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
