import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCRMStore } from '@/store/crmStore';
import toast from 'react-hot-toast';

import type { Tables } from '@/integrations/supabase/types';

type ContactRow = Tables<'contacts'>;

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

function buildQuery(page: number, pageSize: number, filters: any[], sortBy: SortConfig) {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query: any = supabase.from('contacts').select('*', { count: 'exact' });

  filters.forEach((f) => {
    const col = f.column;
    const val = f.value;
    switch (f.operator) {
      case 'equals': query = query.eq(col, val); break;
      case 'not_equals': query = query.neq(col, val); break;
      case 'contains': query = query.ilike(col, `%${val}%`); break;
      case 'starts_with': query = query.ilike(col, `${val}%`); break;
      case 'is_empty': query = query.is(col, null); break;
      case 'is_not_empty': query = query.not(col, 'is', null); break;
    }
  });

  query = query.order(sortBy.column, { ascending: sortBy.direction === 'asc' }).range(from, to);
  return query;
}

export function useBoostyData() {
  const { page, pageSize, filters, sortBy } = useCRMStore();
  const queryClient = useQueryClient();

  const queryKey = ['boosty', page, pageSize, filters, sortBy];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error, count } = await buildQuery(page, pageSize, filters, sortBy);
      if (error) throw error;
      return { rows: (data ?? []) as ContactRow[], totalCount: count ?? 0 };
    },
    placeholderData: (prev) => prev,
    staleTime: 30000,
  });

  useEffect(() => {
    if (data && (page + 1) * pageSize < data.totalCount) {
      queryClient.prefetchQuery({
        queryKey: ['boosty', page + 1, pageSize, filters, sortBy],
        queryFn: async () => {
          const { data: d, error: e, count } = await buildQuery(page + 1, pageSize, filters, sortBy);
          if (e) throw e;
          return { rows: (d ?? []) as ContactRow[], totalCount: count ?? 0 };
        },
      });
    }
  }, [data, page, pageSize, filters, sortBy, queryClient]);

  return {
    rows: data?.rows ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
    error,
    refetch,
  };
}

export function useBoostyRealtime() {
  const queryClient = useQueryClient();
  const setSyncStatus = useCRMStore((s) => s.setSyncStatus);

  useEffect(() => {
    const channel = supabase
      .channel('boosty-crm')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            queryClient.setQueriesData({ queryKey: ['boosty'] }, (old: any) => {
              if (!old?.rows) return old;
              return {
                ...old,
                rows: old.rows.map((r: ContactRow) =>
                  r.id === (payload.new as ContactRow).id ? payload.new : r
                ),
              };
            });
          } else {
            queryClient.invalidateQueries({ queryKey: ['boosty'] });
          }
        }
      )
      .subscribe((status) => {
        setSyncStatus(status === 'SUBSCRIBED' ? 'live' : 'reconnecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, setSyncStatus]);
}

export function useUpdateCell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, column, value }: { id: number; column: string; value: any }) => {
      const { error } = await supabase.from('contacts').update({ [column]: value } as any).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, column, value }) => {
      await queryClient.cancelQueries({ queryKey: ['boosty'] });
      queryClient.setQueriesData({ queryKey: ['boosty'] }, (old: any) => {
        if (!old?.rows) return old;
        return { ...old, rows: old.rows.map((r: ContactRow) => r.id === id ? { ...r, [column]: value } : r) };
      });
    },
    onError: () => {
      toast.error('Invalid data type. Value not saved.');
      queryClient.invalidateQueries({ queryKey: ['boosty'] });
    },
  });
}

export function useDeleteRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boosty'] });
      toast.success('Row deleted');
    },
    onError: () => {
      toast.error('Failed to delete. Please retry.');
    },
  });
}

export function useDeleteRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase.from('contacts').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['boosty'] });
      toast.success(ids.length === 1 ? 'Row deleted' : `${ids.length} rows deleted`);
    },
    onError: () => {
      toast.error('Failed to delete selected rows. Please retry.');
    },
  });
}

export function useAddRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (row: Partial<ContactRow>) => {
      const { error } = await supabase.from('contacts').insert(row as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boosty'] });
      toast.success('Row added');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add row.');
    },
  });
}
