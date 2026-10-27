import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCRMStore } from '@/store/useCRMStore';
import { mergeEnumColumns } from '@/lib/boostySchema';

import type { Tables } from '@/integrations/supabase/types';

type ContactRow = Tables<'contacts'>;

const ENUM_FIELDS = mergeEnumColumns();
const DATE_FIELDS = ['first_contact_date', 'next_contact_date', 'ftd_date_mentioned', 'ftd_date_actual', 'created_at', 'updated_at'];
const INTEGER_FIELDS = ['id'];
const PAGE_SIZE = 1000;

// No server-side sort helper columns needed for the contacts table
const SERVER_SORT_COLUMN_MAP: Record<string, string> = {};

function validateField(field: string, value: any): void {
  if (value === null || value === undefined || value === '') return;

  if (ENUM_FIELDS[field]) {
    if (!ENUM_FIELDS[field].includes(value)) {
      throw new Error('Invalid value. Please select from the allowed options.');
    }
    return;
  }

  if (DATE_FIELDS.includes(field)) {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error('Invalid date format.');
    return;
  }

  if (INTEGER_FIELDS.includes(field)) {
    if (typeof value === 'string' && value.trim() === '') return;
    const n = Number(value);
    if (isNaN(n) || !Number.isInteger(n)) throw new Error('This field only accepts whole numbers.');
    return;
  }

  if (typeof value === 'string' && value.length > 1000) {
    throw new Error('Text exceeds maximum length of 1000 characters.');
  }
}

// ── Query builder ──

interface FilterCondition {
  column: string;
  operator: string;
  value: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

function buildQuery(page: number, filters: FilterCondition[], sortBy: SortConfig) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + 999;

  let query: any = supabase.from('contacts').select('*', { count: 'exact' });

  for (const f of filters) {
    const col = f.column;
    const val = f.value;
    if (!val && f.operator !== 'is_empty' && f.operator !== 'is_not_empty') continue;
    if (f.operator === 'is_between' && !String(val).includes('|')) continue;

    const isDateOnly = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
    const dayStart = isDateOnly ? `${val}T00:00:00.000Z` : val;
    const dayEnd = isDateOnly ? `${val}T23:59:59.999Z` : val;

    switch (f.operator) {
      case 'contains':
        query = ENUM_FIELDS[col] ? query.eq(col, val) : query.ilike(col, `%${val}%`);
        break;
      case 'starts_with':
        query = ENUM_FIELDS[col] ? query.eq(col, val) : query.ilike(col, `${val}%`);
        break;
      case 'equals':
      case 'is':
        if (isDateOnly) {
          query = query.gte(col, dayStart).lte(col, dayEnd);
        } else {
          query = query.eq(col, val);
        }
        break;
      case 'not_equals':
      case 'is_not':
        if (isDateOnly) {
          query = query.or(`${col}.lt.${dayStart},${col}.gt.${dayEnd}`);
        } else {
          query = query.neq(col, val);
        }
        break;
      case 'is_empty':
        query = query.is(col, null);
        break;
      case 'is_not_empty':
        query = query.not(col, 'is', null);
        break;
      case 'is_before':
        query = query.lt(col, dayStart);
        break;
      case 'is_after':
        query = query.gt(col, dayEnd);
        break;
      case 'is_between': {
        const [start, end] = String(val).split('|');
        if (start) {
          const s = /^\d{4}-\d{2}-\d{2}$/.test(start) ? `${start}T00:00:00.000Z` : start;
          query = query.gte(col, s);
        }
        if (end) {
          const e = /^\d{4}-\d{2}-\d{2}$/.test(end) ? `${end}T23:59:59.999Z` : end;
          query = query.lte(col, e);
        }
        break;
      }
    }
  }

  const serverSortCol = SERVER_SORT_COLUMN_MAP[sortBy.column] ?? sortBy.column;
  query = query.order(serverSortCol, { ascending: sortBy.direction === 'asc' });
  query = query.range(from, to);

  return query;
}

// ── Main hook ──

export interface UseBoostyOptions {
  extraFilters?: FilterCondition[];
  viewKey?: string;
}

export function useBoosty(options: UseBoostyOptions = {}) {
  const { extraFilters = [], viewKey = 'default' } = options;
  const queryClient = useQueryClient();
  const {
    currentPage, filters, sortBy,
    setCurrentPage, setFilters, setSortBy,
  } = useCRMStore();

  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');

  const mergedFilters = [...extraFilters, ...filters];
  const queryKey = ['boosty', viewKey, currentPage, mergedFilters, sortBy];

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error, count } = await buildQuery(currentPage, mergedFilters, sortBy);
      if (error) throw error;
      return { rows: (data ?? []) as ContactRow[], totalCount: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });

  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ── Prefetch next page ──
  useEffect(() => {
    if (data && currentPage < totalPages) {
      const nextKey = ['boosty', viewKey, currentPage + 1, mergedFilters, sortBy];
      queryClient.prefetchQuery({
        queryKey: nextKey,
        queryFn: async () => {
          const { data: d, error: e, count } = await buildQuery(currentPage + 1, mergedFilters, sortBy);
          if (e) throw e;
          return { rows: (d ?? []) as ContactRow[], totalCount: count ?? 0 };
        },
      });
    }
  }, [data, currentPage, totalPages, mergedFilters, sortBy, queryClient, viewKey]);

  // ── Realtime ──
  useEffect(() => {
    const channel = supabase
      .channel('boosty-crm')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            queryClient.invalidateQueries({ queryKey: ['boosty'] });
          } else if (payload.eventType === 'DELETE') {
            queryClient.setQueriesData(
              { queryKey: ['boosty'] },
              (old: any) => {
                if (!old?.rows) return old;
                return {
                  ...old,
                  totalCount: Math.max(0, old.totalCount - 1),
                  rows: old.rows.filter((r: ContactRow) => r.id !== (payload.old as any).id),
                };
              }
            );
          } else if (payload.eventType === 'INSERT') {
            queryClient.invalidateQueries({ queryKey: ['boosty'] });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeStatus('error');
        else setRealtimeStatus('connecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── updateRow ──
  const updateRow = useCallback(
    async (id: number, field: string, value: any) => {
      validateField(field, value);
      const finalValue = value === '' ? null : value;
      const isFilteredField = filters.some((f) => f.column === field);

      if (!isFilteredField) {
        queryClient.setQueriesData<{ rows: ContactRow[]; totalCount: number }>(
          { queryKey: ['boosty'] },
          (old) => {
            if (!old?.rows) return old;
            return { ...old, rows: old.rows.map((r) => r.id === id ? { ...r, [field]: finalValue } : r) };
          }
        );
      }

      const { error } = await supabase.from('contacts').update({ [field]: finalValue } as any).eq('id', id);

      if (error) {
        queryClient.invalidateQueries({ queryKey: ['boosty'] });
        throw new Error(error.message);
      }

      await queryClient.invalidateQueries({ queryKey: ['boosty'] });
    },
    [queryClient, filters]
  );

  // ── deleteRow / deleteRows ──
  const deleteRow = useCallback(
    async (id: number) => {
      queryClient.setQueriesData<{ rows: ContactRow[]; totalCount: number }>(
        { queryKey: ['boosty'] },
        (old) => {
          if (!old?.rows) return old;
          return { ...old, totalCount: Math.max(0, old.totalCount - 1), rows: old.rows.filter((r) => r.id !== id) };
        }
      );

      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['boosty'] });
        throw new Error(error.message);
      }
    },
    [queryClient]
  );

  const deleteRows = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);

      queryClient.setQueriesData<{ rows: ContactRow[]; totalCount: number }>(
        { queryKey: ['boosty'] },
        (old) => {
          if (!old?.rows) return old;
          return {
            ...old,
            totalCount: Math.max(0, old.totalCount - ids.length),
            rows: old.rows.filter((r) => !idSet.has(r.id)),
          };
        }
      );

      const { error } = await supabase.from('contacts').delete().in('id', ids);
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['boosty'] });
        throw new Error(error.message);
      }
    },
    [queryClient]
  );

  // ── addRow ──
  const addRow = useCallback(async (initialData?: Record<string, any>): Promise<ContactRow> => {
    const insertData = initialData && Object.keys(initialData).length > 0
      ? initialData
      : { created_at: new Date().toISOString() };

    const { data: newRow, error } = await supabase
      .from('contacts')
      .insert(insertData as any)
      .select()
      .single();

    if (error) throw new Error(error.message);

    queryClient.setQueriesData<{ rows: ContactRow[]; totalCount: number }>(
      { queryKey: ['boosty'] },
      (old) => {
        if (!old) return { rows: [newRow as ContactRow], totalCount: 1 };
        return { ...old, totalCount: old.totalCount + 1, rows: [newRow as ContactRow, ...old.rows] };
      }
    );

    return newRow as ContactRow;
  }, [queryClient]);

  // ── addColumn (via edge function) ──
  const addColumn = useCallback(async (columnName: string) => {
    const { data, error } = await supabase.functions.invoke('add-column', {
      body: { column_name: columnName, data_type: 'text' },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['boosty'] }),
      queryClient.invalidateQueries({ queryKey: ['boosty-schema'] }),
    ]);
  }, [queryClient]);

  // ── renameColumn (via RPC) ──
  const renameColumn = useCallback(async (oldName: string, newName: string) => {
    const { error } = await supabase.rpc('rename_column', {
      table_name: 'contacts',
      old_column_name: oldName,
      new_column_name: newName,
    });
    if (error) throw new Error(error.message);
    queryClient.invalidateQueries({ queryKey: ['boosty'] });
  }, [queryClient]);

  // ── dropColumn (via edge function) ──
  const dropColumn = useCallback(async (columnName: string) => {
    const { data, error } = await supabase.functions.invoke('delete-column', {
      body: { column_name: columnName },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['boosty'] }),
      queryClient.invalidateQueries({ queryKey: ['boosty-schema'] }),
    ]);
  }, [queryClient]);

  return {
    data: data?.rows ?? [],
    totalCount,
    totalPages,
    isLoading,
    isFetching,
    error,
    page: currentPage,
    setPage: setCurrentPage,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    updateRow,
    addRow,
    deleteRow,
    deleteRows,
    addColumn,
    renameColumn,
    dropColumn,
    realtimeStatus,
  };
}
