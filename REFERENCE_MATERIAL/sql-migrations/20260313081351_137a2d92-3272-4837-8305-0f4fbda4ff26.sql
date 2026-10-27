
-- Fix 1: Add auth checks to all three RPCs and revoke public access

CREATE OR REPLACE FUNCTION public.add_column(table_name text, column_name text, column_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF table_name NOT IN ('contacts') THEN
    RAISE EXCEPTION 'Unauthorized table: %', table_name;
  END IF;
  IF column_type NOT IN ('text', 'numeric', 'date', 'boolean', 'timestamptz') THEN
    RAISE EXCEPTION 'Unsupported column type: %', column_type;
  END IF;
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s', table_name, column_name, column_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_column(table_name text, old_column_name text, new_column_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF table_name NOT IN ('contacts') THEN
    RAISE EXCEPTION 'Unauthorized table: %', table_name;
  END IF;
  EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', table_name, old_column_name, new_column_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.drop_column(table_name text, column_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF table_name NOT IN ('contacts') THEN
    RAISE EXCEPTION 'Unauthorized table: %', table_name;
  END IF;
  EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I', table_name, column_name);
END;
$$;

-- Revoke public access and grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.add_column(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.add_column(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.rename_column(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rename_column(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.drop_column(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.drop_column(text, text) TO authenticated;
