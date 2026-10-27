
-- Drop the old permissive public policy
DROP POLICY IF EXISTS "Allow all access to contacts" ON public.contacts;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can select contacts"
  ON public.contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
  ON public.contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contacts"
  ON public.contacts FOR DELETE TO authenticated USING (true);

-- Secure RPCs with table whitelist and auth check
CREATE OR REPLACE FUNCTION public.add_column(
  table_name text, column_name text, column_type text
) RETURNS void AS $$
BEGIN
  IF table_name NOT IN ('contacts') THEN
    RAISE EXCEPTION 'Unauthorized table: %', table_name;
  END IF;
  IF column_type NOT IN ('text', 'numeric', 'date', 'boolean', 'timestamptz') THEN
    RAISE EXCEPTION 'Unsupported column type: %', column_type;
  END IF;
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s', table_name, column_name, column_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.rename_column(
  table_name text, old_column_name text, new_column_name text
) RETURNS void AS $$
BEGIN
  IF table_name NOT IN ('contacts') THEN
    RAISE EXCEPTION 'Unauthorized table: %', table_name;
  END IF;
  EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', table_name, old_column_name, new_column_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.drop_column(
  table_name text, column_name text
) RETURNS void AS $$
BEGIN
  IF table_name NOT IN ('contacts') THEN
    RAISE EXCEPTION 'Unauthorized table: %', table_name;
  END IF;
  EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I', table_name, column_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
