import { create } from 'zustand';

export interface FilterCondition {
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
  currentPage: number;
  filters: FilterCondition[];
  sortBy: SortConfig;
  columnOrder: string[];
  hiddenColumns: string[];

  setCurrentPage: (page: number) => void;
  setFilters: (filters: FilterCondition[]) => void;
  addFilter: (filter: FilterCondition) => void;
  removeFilter: (id: string) => void;
  updateFilter: (id: string, updates: Partial<FilterCondition>) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: SortConfig) => void;
  setColumnOrder: (order: string[]) => void;
  setHiddenColumns: (cols: string[]) => void;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export const useCRMStore = create<CRMStore>((set) => ({
  currentPage: 1,
  filters: [],
  // Newest leads first. Sorted by id rather than a date column because
  // first_contact_date is identical across most rows and would not order reliably.
  sortBy: { column: 'id', direction: 'desc' },
  columnOrder: loadFromStorage<string[]>('boosty-column-order', []),
  hiddenColumns: loadFromStorage<string[]>('boosty-hidden-columns', []),

  setCurrentPage: (currentPage) => set({ currentPage }),
  setFilters: (filters) => set({ filters }),
  addFilter: (filter) => set((s) => ({ filters: [...s.filters, filter] })),
  removeFilter: (id) => set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),
  updateFilter: (id, updates) =>
    set((s) => ({ filters: s.filters.map((f) => (f.id === id ? { ...f, ...updates } : f)) })),
  clearFilters: () => set({ filters: [] }),
  setSortBy: (sortBy) => set({ sortBy }),
  setColumnOrder: (columnOrder) => {
    localStorage.setItem('boosty-column-order', JSON.stringify(columnOrder));
    set({ columnOrder });
  },
  setHiddenColumns: (hiddenColumns) => {
    localStorage.setItem('boosty-hidden-columns', JSON.stringify(hiddenColumns));
    set({ hiddenColumns });
  },
}));
