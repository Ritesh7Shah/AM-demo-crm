import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getBootstrappedSchema,
  mergeColumnTypes,
  mergeEnumColumns,
  type BoostySchemaColumnType,
  type BoostyColumnType,
} from '@/lib/boostySchema';

interface BoostySchemaResponse {
  enumColumns?: Record<string, string[]>;
  columnTypes?: Record<string, BoostySchemaColumnType>;
  customColumnNames?: string[];
}

/**
 * Fallback: query boosty_custom_columns directly via REST when the edge function
 * is unavailable. Ensures custom dropdown columns work across all environments.
 */
async function fetchCustomColumnsViaREST(): Promise<{
  enumColumns: Record<string, string[]>;
  columnTypes: Record<string, BoostyColumnType>;
}> {
  const { data, error } = await supabase
    .from('boosty_custom_columns' as any)
    .select('column_name, data_type, options') as { data: any[] | null; error: any };

  const enumColumns: Record<string, string[]> = {};
  const columnTypes: Record<string, BoostyColumnType> = {};

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      const name = String(row.column_name);
      const dt = String(row.data_type) as BoostyColumnType;
      columnTypes[name] = dt;
      if (dt === 'dropdown' && Array.isArray(row.options) && row.options.length > 0) {
        enumColumns[name] = row.options.map(String);
      }
    }
  }

  return { enumColumns, columnTypes };
}

export function useBoostySchema() {
  const queryClient = useQueryClient();
  const initialSchema = useMemo(() => getBootstrappedSchema(), []);

  const query = useQuery({
    queryKey: ['boosty-schema'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke<BoostySchemaResponse>('get-boosty-schema');
        if (!error && data) {
          const enumColumns = mergeEnumColumns(data.enumColumns);
          return {
            enumColumns,
            columnTypes: mergeColumnTypes(data.columnTypes, enumColumns),
            customColumnNames: data.customColumnNames ?? [],
          };
        }
      } catch {
        // Edge function failed — fall through to REST fallback
      }

      console.log('[Schema] Edge function unavailable, using REST fallback');
      const custom = await fetchCustomColumnsViaREST();
      const enumColumns = mergeEnumColumns(custom.enumColumns);
      return {
        enumColumns,
        columnTypes: mergeColumnTypes(custom.columnTypes, enumColumns),
        customColumnNames: Object.keys(custom.columnTypes),
      };
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['boosty-schema'] });
  }, [queryClient]);

  return {
    enumColumns: query.data?.enumColumns ?? initialSchema.enumColumns,
    columnTypes: query.data?.columnTypes ?? initialSchema.columnTypes,
    customColumnNames: query.data?.customColumnNames ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
