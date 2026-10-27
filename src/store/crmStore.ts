import { create } from 'zustand';

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

interface CRMStore {
  // Pagination
  page: number;
  pageSize: number;
  setPage: (page: number) => void;

  // Sorting
  sortBy: SortConfig;
  setSortBy: (sortBy: SortConfig) => void;
  toggleSort: (column: string) => void;

  // Filters
  filters: FilterCondition[];
  addFilter: (filter: FilterCondition) => void;
  removeFilter: (id: string) => void;
  updateFilter: (id: string, updates: Partial<FilterCondition>) => void;
  clearFilters: () => void;

  // Column management
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;
  hiddenColumns: string[];
  toggleColumnVisibility: (col: string) => void;

  // Sync status
  syncStatus: 'live' | 'reconnecting';
  setSyncStatus: (status: 'live' | 'reconnecting') => void;

  // Editing
  editingCell: { rowId: number; column: string } | null;
  setEditingCell: (cell: { rowId: number; column: string } | null) => void;

  // Agent flow triggering
  triggeringRows: Set<number>;
  setRowTriggering: (rowId: number, triggering: boolean) => void;
}

const savedOrder = localStorage.getItem('boosty-column-order');
const savedHidden = localStorage.getItem('boosty-hidden-columns');

export const useCRMStore = create<CRMStore>((set) => ({
  page: 0,
  pageSize: 1000,
  setPage: (page) => set({ page }),

  sortBy: { column: 'id', direction: 'asc' },
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSort: (column) =>
    set((s) => {
      if (s.sortBy.column === column) {
        return { sortBy: { column, direction: s.sortBy.direction === 'asc' ? 'desc' : 'asc' }, page: 0 };
      }
      return { sortBy: { column, direction: 'asc' }, page: 0 };
    }),

  filters: [],
  addFilter: (filter) => set((s) => ({ filters: [...s.filters, filter] })),
  removeFilter: (id) => set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),
  updateFilter: (id, updates) =>
    set((s) => ({
      filters: s.filters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),
  clearFilters: () => set({ filters: [] }),

  columnOrder: savedOrder ? JSON.parse(savedOrder) : [],
  setColumnOrder: (order) => {
    localStorage.setItem('boosty-column-order', JSON.stringify(order));
    set({ columnOrder: order });
  },

  hiddenColumns: savedHidden ? JSON.parse(savedHidden) : [],
  toggleColumnVisibility: (col) =>
    set((s) => {
      const next = s.hiddenColumns.includes(col)
        ? s.hiddenColumns.filter((c) => c !== col)
        : [...s.hiddenColumns, col];
      localStorage.setItem('boosty-hidden-columns', JSON.stringify(next));
      return { hiddenColumns: next };
    }),

  syncStatus: 'live',
  setSyncStatus: (syncStatus) => set({ syncStatus }),

  editingCell: null,
  setEditingCell: (editingCell) => set({ editingCell }),

  triggeringRows: new Set(),
  setRowTriggering: (rowId, triggering) =>
    set((s) => {
      const next = new Set(s.triggeringRows);
      if (triggering) next.add(rowId); else next.delete(rowId);
      return { triggeringRows: next };
    }),
}));
