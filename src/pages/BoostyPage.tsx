import { useState, useMemo, useCallback, useRef, useEffect, type UIEvent } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO } from 'date-fns';
import {
  Trash2, Plus, ArrowUp, ArrowDown,
  Columns, Check, Loader2, ChevronRight, Filter, X, Maximize2,
  Search, Database, CheckSquare2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RowDetailPanel } from '@/components/RowDetailPanel';
import { AddColumnButton } from '@/components/AddColumnButton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useBoosty } from '@/hooks/useBoosty';
import { useBoostySchema } from '@/hooks/useBoostySchema';
import { type BoostyColumnType } from '@/lib/boostySchema';
import { useCRMStore } from '@/store/useCRMStore';
import { FilterBar } from '@/components/crm/FilterBar';
import { AddRecordDialog } from '@/components/crm/AddRecordDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { Tables } from '@/integrations/supabase/types';

type ContactRow = Tables<'contacts'>;

const ALL_COLUMNS = [
  'id', 'name', 'contact_id', 'status', 'assigned_to',
  'backoffice', 'live', 'first_contact_date', 'next_contact_date',
  'ftd_date_mentioned', 'ftd_date_actual', 'created_at', 'updated_at',
];

const READONLY_COLUMNS = ['id', 'contact_id', 'created_at', 'updated_at', 'first_contact_date'];

const COL_WIDTHS: Record<string, number> = {
  id: 70,
  name: 180,
  contact_id: 150,
  status: 140,
  assigned_to: 120,
  backoffice: 110,
  live: 80,
  first_contact_date: 160,
  next_contact_date: 160,
  ftd_date_mentioned: 160,
  ftd_date_actual: 160,
  created_at: 160,
  updated_at: 160,
};

function colW(col: string) { return COL_WIDTHS[col] ?? 150; }

const TABLE_ROW_HEIGHT = 40;
const TABLE_OVERSCAN = 14;

const DATE_DISPLAY_COLUMNS = new Set([
  'first_contact_date', 'next_contact_date',
  'ftd_date_mentioned', 'ftd_date_actual',
  'created_at', 'updated_at',
]);

// ── Badge color maps ──

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-600',
  outreach_1: 'bg-blue-50 text-blue-700',
  outreach_2: 'bg-purple-50 text-purple-700',
  outreach_3: 'bg-amber-50 text-amber-700',
  outreach_4: 'bg-orange-50 text-orange-700',
  outreach_5: 'bg-red-50 text-red-600',
  live: 'bg-emerald-50 text-emerald-700',
  quit: 'bg-gray-100 text-gray-500',
};

const ASSIGNED_TO_COLORS: Record<string, string> = {
  bot: 'bg-blue-50 text-blue-700',
  human: 'bg-teal-50 text-teal-700',
};

// ── Initials avatar ──

function InitialsAvatar({ name }: { name: string | null }) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const colors = [
    'bg-primary/20 text-primary', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-emerald-100 text-emerald-700',
    'bg-cyan-100 text-cyan-700', 'bg-teal-100 text-teal-700',
  ];
  return (
    <span className={cn(
      'inline-flex items-center justify-center h-[22px] w-[22px] rounded-full text-[9px] font-bold shrink-0',
      colors[name.charCodeAt(0) % colors.length],
    )}>
      {initials}
    </span>
  );
}

// ── Tag / Badge ──

function Tag({ value, colorClass }: { value: string | null; colorClass?: string }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-xl text-[11px] font-medium tracking-wide whitespace-nowrap',
      colorClass || 'bg-surface3 text-muted-foreground',
    )}>
      {value}
    </span>
  );
}

// ── Cell display ──

function CellDisplay({ column, value }: { column: string; value: any }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs">—</span>;

  if (column === 'status') return <Tag value={value} colorClass={STATUS_COLORS[value]} />;
  if (column === 'assigned_to') return <Tag value={value} colorClass={ASSIGNED_TO_COLORS[value]} />;

  if (column === 'backoffice' || column === 'live') {
    const bool = value === true || value === 'true';
    return <Tag value={bool ? 'Yes' : 'No'} colorClass={bool ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'} />;
  }

  if (DATE_DISPLAY_COLUMNS.has(column)) {
    try {
      return <span className="text-[12px] text-muted-foreground tabular-nums">{format(parseISO(value), 'dd MMM yyyy')}</span>;
    } catch {
      return <span className="text-[13px]">{value}</span>;
    }
  }

  if (column === 'name') {
    return (
      <div className="flex items-center gap-[7px]">
        <InitialsAvatar name={value} />
        <span className="font-medium text-foreground text-[13px]">{value}</span>
      </div>
    );
  }

  if (column === 'id') return <span className="text-[13px] text-muted-foreground tabular-nums">{value}</span>;

  if (column === 'inbox_link') {
    return (
      <a
        href={String(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline text-[13px]"
        title={String(value)}
        onClick={(e) => e.stopPropagation()}
      >
        Link
      </a>
    );
  }

  return <span className="text-[13px]">{String(value)}</span>;
}

// ── Inline cell editor ──

function InlineCellEditor({ columnType, value, enumOptions, onSave, onCancel }: {
  columnType: BoostyColumnType;
  value: any;
  enumOptions: string[];
  onSave: (val: any) => void;
  onCancel: () => void;
}) {
  const [editVal, setEditVal] = useState<any>(value ?? '');
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const editValRef = useRef(editVal);
  const savedRef = useRef(false);

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { editValRef.current = editVal; }, [editVal]);

  const normalizeValue = useCallback((rawValue: any) => {
    if (rawValue === '' || rawValue === undefined) return null;
    if (columnType === 'number') {
      const parsed = Number(rawValue);
      return Number.isNaN(parsed) ? rawValue : parsed;
    }
    if (columnType === 'checkbox') {
      if (rawValue === true || rawValue === false) return rawValue;
      if (rawValue === 'true') return true;
      if (rawValue === 'false') return false;
      return null;
    }
    return rawValue;
  }, [columnType]);

  const doSave = useCallback((nextValue: any) => {
    if (savedRef.current) return;
    savedRef.current = true;
    onSave(normalizeValue(nextValue));
  }, [normalizeValue, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); doSave(editValRef.current); }
    if (e.key === 'Escape') onCancel();
  };

  const cls = 'w-full h-8 border border-border rounded-lg px-2 text-[13px] bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

  if (enumOptions.length > 0 || columnType === 'dropdown') {
    return (
      <select
        ref={ref as any}
        value={editVal}
        onChange={(e) => { const sel = e.target.value; setEditVal(sel); doSave(sel); }}
        onBlur={() => doSave(editValRef.current)}
        onKeyDown={handleKeyDown}
        className={cls}
      >
        <option value="">—</option>
        {enumOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  if (columnType === 'date') {
    return (
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <button className={cn(cls, 'text-left', !editVal && 'text-muted-foreground')}>
            {editVal ? format(new Date(editVal), 'dd MMM yyyy') : 'Pick date...'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={editVal ? new Date(editVal) : undefined}
            onSelect={(date) => {
              const formatted = date ? format(date, 'yyyy-MM-dd') : '';
              setEditVal(formatted);
              doSave(formatted);
            }}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    );
  }

  if (columnType === 'checkbox') {
    const checkboxValue = editVal === true || editVal === 'true' ? 'true' : editVal === false || editVal === 'false' ? 'false' : '';
    return (
      <select
        ref={ref as any}
        value={checkboxValue}
        onChange={(e) => {
          const sel = e.target.value;
          const next = sel === '' ? '' : sel === 'true';
          setEditVal(next);
          doSave(next);
        }}
        onBlur={() => doSave(editValRef.current)}
        onKeyDown={handleKeyDown}
        className={cls}
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  return (
    <input
      ref={ref as any}
      type={columnType === 'number' ? 'number' : 'text'}
      value={editVal}
      onChange={(e) => setEditVal(e.target.value)}
      onBlur={() => doSave(editValRef.current)}
      onKeyDown={handleKeyDown}
      className={cls}
    />
  );
}

// ── Sortable column header ──

function SortableHeader({ colId, label, sortBy, onSort, onRename, onDelete, customHeader }: {
  colId: string; label: string;
  sortBy: { column: string; direction: 'asc' | 'desc' };
  onSort: (col: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete?: (col: string) => void;
  customHeader?: any;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    minWidth: colW(colId),
    width: colW(colId),
  };
  const isSorted = sortBy.column === colId;
  const hasCustomRenderer = typeof customHeader === 'function';

  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(label);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) renameRef.current?.focus(); }, [renaming]);

  const handleRenameSubmit = () => {
    setRenaming(false);
    const trimmed = renameVal.trim();
    if (trimmed && trimmed !== label) onRename(label, trimmed);
    else setRenameVal(label);
  };

  if (renaming) {
    return (
      <th ref={setNodeRef} style={style}
        className="sticky top-0 z-10 h-9 px-3 border-b border-r border-border bg-[hsl(220,14%,98%)]">
        <input
          ref={renameRef}
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit();
            if (e.key === 'Escape') { setRenameVal(label); setRenaming(false); }
          }}
          className="w-full h-6 px-1 text-[11px] font-semibold uppercase tracking-[0.5px] bg-card border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </th>
    );
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(hasCustomRenderer ? {} : listeners)}
      className={cn(
        'group sticky top-0 z-10 h-9 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px] whitespace-nowrap select-none',
        !hasCustomRenderer && 'cursor-grab',
        'border-b border-r border-border bg-[hsl(220,14%,98%)] text-muted-foreground',
        !hasCustomRenderer && 'hover:bg-surface2 hover:text-foreground transition-colors',
        isSorted && !hasCustomRenderer && 'text-primary',
      )}
    >
      {hasCustomRenderer ? (
        flexRender(customHeader, { table: null, header: null, column: null })
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSort(colId); }}
            className="inline-flex min-w-0 items-center gap-1 hover:text-foreground transition-colors"
          >
            <span className="truncate">{label}</span>
            {isSorted && (sortBy.direction === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />)}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(colId); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"
              title="Delete column"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </th>
  );
}

// ── Column visibility checklist ──

function ColumnChecklist({ columns, hiddenColumns, onToggle }: {
  columns: string[]; hiddenColumns: string[]; onToggle: (col: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="h-7 px-2.5 rounded-md text-[12px] font-medium cursor-pointer bg-transparent border border-border text-muted-foreground flex items-center gap-[5px] transition-all hover:bg-surface2 hover:text-foreground hover:border-[hsl(var(--border2))]">
          <Columns className="h-3.5 w-3.5" /> Columns
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5 max-h-80 overflow-y-auto bg-card border-border" align="end">
        <p className="px-2.5 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Toggle columns</p>
        {columns.map((col) => {
          const visible = !hiddenColumns.includes(col);
          return (
            <button key={col} onClick={() => onToggle(col)}
              className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-[13px] hover:bg-surface2 transition-colors">
              <span className={cn('h-4 w-4 rounded border flex items-center justify-center',
                visible ? 'bg-accent border-accent' : 'border-muted-foreground/30')}>
                {visible && <Check className="h-3 w-3 text-foreground" />}
              </span>
              <span className="truncate text-foreground">{col}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}


// ══════════════════════════════════════════════
// ── MAIN PAGE
// ══════════════════════════════════════════════

export default function BoostyPage() {
  const [view, setView] = useState<'contacts' | 'live'>(() => {
    if (typeof window === 'undefined') return 'contacts';
    return (localStorage.getItem('boosty-view') as any) === 'live' ? 'live' : 'contacts';
  });
  useEffect(() => { localStorage.setItem('boosty-view', view); }, [view]);

  // Live view: filter to contacts where live = true
  const liveExtraFilters = useMemo(
    () => view === 'live'
      ? [{ column: 'live', operator: 'is', value: true }]
      : [],
    [view],
  );

  const {
    data, totalCount, totalPages, isLoading, isFetching, error,
    page, setPage, filters, sortBy, setSortBy,
    updateRow, addRow, deleteRow, deleteRows,
    addColumn, renameColumn, dropColumn,
    realtimeStatus,
  } = useBoosty({ extraFilters: liveExtraFilters, viewKey: view });

  useEffect(() => { setPage(1); }, [view, setPage]);

  const { enumColumns, columnTypes, customColumnNames } = useBoostySchema();
  const { columnOrder, setColumnOrder, hiddenColumns, setHiddenColumns, setFilters } = useCRMStore();

  const [editingCell, setEditingCell] = useState<{ rowId: number; col: string } | null>(null);
  const [savingCell, setSavingCell] = useState<{ rowId: number; col: string } | null>(null);
  const [flashCell, setFlashCell] = useState<{ rowId: number; col: string; type: 'success' | 'error' } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteColName, setDeleteColName] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [addingRow, setAddingRow] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [goToPage, setGoToPage] = useState('');
  const [detailRowId, setDetailRowId] = useState<number | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(560);

  const editingCellRef = useRef(editingCell);
  const savingCellRef = useRef(savingCell);
  const flashCellRef = useRef(flashCell);
  const selectedRowIdsRef = useRef(selectedRowIds);
  useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);
  useEffect(() => { savingCellRef.current = savingCell; }, [savingCell]);
  useEffect(() => { flashCellRef.current = flashCell; }, [flashCell]);
  useEffect(() => { selectedRowIdsRef.current = selectedRowIds; }, [selectedRowIds]);

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const allColumns = useMemo(() => {
    if (data.length > 0) return Object.keys(data[0]);
    return ALL_COLUMNS;
  }, [data]);

  const orderedColumns = useMemo(() => {
    const base = columnOrder.length > 0 ? columnOrder.filter((c) => allColumns.includes(c)) : allColumns;
    const missing = allColumns.filter((c) => !base.includes(c));
    return [...base, ...missing].filter((c) => !hiddenColumns.includes(c));
  }, [columnOrder, hiddenColumns, allColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder(arrayMove(orderedColumns, orderedColumns.indexOf(active.id as string), orderedColumns.indexOf(over.id as string)));
  }, [orderedColumns, setColumnOrder]);

  const handleSort = useCallback((col: string) => {
    setSortBy({ column: col, direction: sortBy.column === col && sortBy.direction === 'asc' ? 'desc' : 'asc' });
  }, [sortBy, setSortBy]);

  const triggerAssignedToFlow = useCallback(async (contactId: string, newValue: string) => {
    try {
      await supabase.functions.invoke('trigger-agent-flow', {
        body: { contactId, assignedTo: newValue },
      });
    } catch {
      // Flow trigger is fire-and-forget
    }
  }, []);

  const handleCellSave = useCallback(async (rowId: number, col: string, value: any) => {
    setEditingCell(null);
    setSavingCell({ rowId, col });
    try {
      if (col === 'assigned_to') {
        const row = data.find((r) => r.id === rowId);
        const oldValue = row ? (row as any).assigned_to : undefined;
        await updateRow(rowId, col, value);
        if (row && oldValue !== value && (row as any).contact_id) {
          triggerAssignedToFlow(String((row as any).contact_id), String(value));
        }
      } else {
        await updateRow(rowId, col, value);
      }
      setFlashCell({ rowId, col, type: 'success' });
      toast.success('Saved successfully');
      setTimeout(() => setFlashCell(null), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save. Please retry.');
      setFlashCell({ rowId, col, type: 'error' });
      setTimeout(() => setFlashCell(null), 1000);
    } finally {
      setSavingCell(null);
    }
  }, [updateRow, data, triggerAssignedToFlow]);

  const handleAddRow = useCallback(async (initialData?: Record<string, any>) => {
    setAddingRow(true);
    try {
      const newRow = await addRow(initialData);
      toast.success('New contact added');
      setDetailRowId(newRow.id);
      setSelectedRowId(newRow.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add contact. Please retry.');
    } finally {
      setAddingRow(false);
    }
  }, [addRow]);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteId === null) return;
    try {
      await deleteRow(deleteId);
      toast.success('Contact deleted successfully');
      if (detailRowId === deleteId) { setDetailRowId(null); setSelectedRowId(null); }
    } catch {
      toast.error('Failed to delete. Please retry.');
    }
    setDeleteId(null);
  }, [deleteId, deleteRow, detailRowId]);

  const handleAddColumn = useCallback(async (name: string) => {
    await addColumn(name);
    const newOrder = [...(columnOrder.length > 0 ? columnOrder : orderedColumns), name];
    setColumnOrder(newOrder);
  }, [addColumn, columnOrder, orderedColumns, setColumnOrder]);

  const handleRenameColumn = useCallback(async (oldName: string, newName: string) => {
    try {
      await renameColumn(oldName, newName);
      if (columnOrder.length > 0) setColumnOrder(columnOrder.map((c) => c === oldName ? newName : c));
      toast.success('Column renamed successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename column. Please retry.');
    }
  }, [renameColumn, columnOrder, setColumnOrder]);

  const handleDeleteColumnConfirm = useCallback(async () => {
    if (!deleteColName) return;
    if (!hiddenColumns.includes(deleteColName)) setHiddenColumns([...hiddenColumns, deleteColName]);
    try {
      await dropColumn(deleteColName);
      if (columnOrder.length > 0) setColumnOrder(columnOrder.filter((c) => c !== deleteColName));
      setHiddenColumns(hiddenColumns.filter((c) => c !== deleteColName));
      toast.success('Column deleted successfully');
    } catch (err: any) {
      setHiddenColumns(hiddenColumns.filter((c) => c !== deleteColName));
      toast.error(err.message || 'Failed to delete column. Please retry.');
    }
    setDeleteColName(null);
  }, [deleteColName, dropColumn, columnOrder, setColumnOrder, hiddenColumns, setHiddenColumns]);

  const toggleCol = useCallback((col: string) => {
    setHiddenColumns(hiddenColumns.includes(col) ? hiddenColumns.filter((c) => c !== col) : [...hiddenColumns, col]);
  }, [hiddenColumns, setHiddenColumns]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) => val !== null && val !== undefined && String(val).toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  useEffect(() => {
    const visibleIds = new Set(filteredData.map((row) => row.id));
    setSelectedRowIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredData]);

  const toggleRowSelection = useCallback((rowId: number, checked: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((checked: boolean) => {
    if (!checked) { setSelectedRowIds(new Set()); return; }
    setSelectedRowIds(new Set(filteredData.map((row) => row.id)));
  }, [filteredData]);

  const clearBulkSelection = useCallback(() => { setSelectedRowIds(new Set()); }, []);

  const selectedCount = selectedRowIds.size;
  const allVisibleSelected = filteredData.length > 0 && filteredData.every((row) => selectedRowIds.has(row.id));
  const someVisibleSelected = filteredData.some((row) => selectedRowIds.has(row.id));

  const tableColumns = useMemo<ColumnDef<ContactRow, any>[]>(() => {
    const cols: ColumnDef<ContactRow, any>[] = orderedColumns.map((key) => ({
      id: key,
      accessorFn: (row: any) => row[key],
      header: key === 'id'
        ? () => (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Select all contacts"
                className="border-border data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
              />
              <span>id</span>
            </div>
          )
        : key,
      size: colW(key),
      cell: ({ row }) => {
        const rd = row.original;
        const val = (rd as any)[key];
        const editingCellNow = editingCellRef.current;
        const savingCellNow = savingCellRef.current;
        const flashCellNow = flashCellRef.current;
        const selectedRowIdsNow = selectedRowIdsRef.current;
        const isEditing = editingCellNow?.rowId === rd.id && editingCellNow?.col === key;
        const isSaving = savingCellNow?.rowId === rd.id && savingCellNow?.col === key;
        const flash = flashCellNow?.rowId === rd.id && flashCellNow?.col === key ? flashCellNow.type : null;
        const isRO = READONLY_COLUMNS.includes(key);
        const isBulkSelected = selectedRowIdsNow.has(rd.id);

        if (isEditing && !isRO) {
          return <InlineCellEditor columnType={columnTypes[key] ?? 'text'} value={val} enumOptions={enumColumns[key] ?? []} onSave={(v) => handleCellSave(rd.id, key, v)} onCancel={() => setEditingCell(null)} />;
        }

        if (key === 'id') {
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleRowSelection(rd.id, !isBulkSelected); }}
                aria-label={`Select contact ${rd.id}`}
                className="relative flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Checkbox
                  checked={isBulkSelected}
                  onCheckedChange={(checked) => toggleRowSelection(rd.id, checked === true)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select contact ${rd.id}`}
                  className={cn(
                    'absolute inset-0 m-auto h-5 w-5 border-border bg-card transition-all duration-150 ease-out pointer-events-none',
                    isBulkSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100'
                  )}
                />
                <span className={cn('text-[13px] text-muted-foreground tabular-nums transition-opacity duration-150', isBulkSelected ? 'opacity-0' : 'opacity-100 group-hover:opacity-0 group-focus-within:opacity-0')}>
                  {val}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDetailRowId(rd.id); setSelectedRowId(rd.id); }}
                aria-label={`Expand contact ${rd.id}`}
                title="Expand row"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        }

        return (
          <div
            className={cn(
              'flex items-center min-h-[28px]',
              !isRO && 'cursor-pointer',
              flash === 'success' && 'bg-primary/[0.15] rounded transition-all duration-1000',
              flash === 'error' && 'bg-destructive/[0.15] rounded transition-all duration-1000',
            )}
            onDoubleClick={() => { if (!isRO) setEditingCell({ rowId: rd.id, col: key }); }}
          >
            {isSaving && <Loader2 className="h-3 w-3 text-primary animate-spin mr-1 shrink-0" />}
            <CellDisplay column={key} value={val} />
          </div>
        );
      },
    }));

    cols.push({
      id: '_actions',
      header: '',
      size: 70,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); setDetailRowId(row.original.id); setSelectedRowId(row.original.id); }} className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-surface2 transition-colors" title="View details">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.original.id); }} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    });

    return cols;
  }, [orderedColumns, enumColumns, columnTypes, handleCellSave, allVisibleSelected, someVisibleSelected, toggleSelectAll, toggleRowSelection]);

  const table = useReactTable({ data: filteredData, columns: tableColumns, getCoreRowModel: getCoreRowModel() });
  const tableRows = table.getRowModel().rows;

  const selectedRow = useMemo(
    () => (selectedRowId === null ? null : data.find((r) => r.id === selectedRowId) ?? null),
    [data, selectedRowId],
  );

  const detailRow = useMemo(
    () => (detailRowId === null ? null : data.find((r) => r.id === detailRowId) ?? null),
    [data, detailRowId],
  );

  const handleBulkDeleteConfirm = useCallback(async () => {
    const ids = Array.from(selectedRowIds);
    if (ids.length === 0) return;
    try {
      await deleteRows(ids);
      toast.success(ids.length === 1 ? 'Contact deleted successfully' : `${ids.length} contacts deleted successfully`);
      setBulkDeleteOpen(false);
      clearBulkSelection();
      if (selectedRowId !== null && ids.includes(selectedRowId)) { setSelectedRowId(null); setDetailRowId(null); }
    } catch {
      toast.error('Failed to delete selected contacts. Please retry.');
    }
  }, [selectedRowIds, deleteRows, clearBulkSelection, selectedRowId]);

  const handleTableScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const nextTop = event.currentTarget.scrollTop;
    if (nextTop === scrollTopRef.current) return;
    scrollTopRef.current = nextTop;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => { setScrollTop(nextTop); frameRef.current = null; });
  }, []);

  useEffect(() => {
    const node = tableScrollRef.current;
    if (!node) return;
    const syncViewport = () => setViewportHeight(node.clientHeight);
    syncViewport();
    const observer = new ResizeObserver(syncViewport);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); };
  }, []);

  const virtualRange = useMemo(() => {
    const totalRows = tableRows.length;
    if (totalRows === 0) return { start: 0, end: 0, topPad: 0, bottomPad: 0 };
    const visibleCount = Math.max(1, Math.ceil(viewportHeight / TABLE_ROW_HEIGHT));
    const start = Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN);
    const end = Math.min(totalRows, start + visibleCount + TABLE_OVERSCAN * 2);
    return { start, end, topPad: start * TABLE_ROW_HEIGHT, bottomPad: Math.max(0, (totalRows - end) * TABLE_ROW_HEIGHT) };
  }, [tableRows.length, scrollTop, viewportHeight]);

  const virtualRows = useMemo(
    () => tableRows.slice(virtualRange.start, virtualRange.end),
    [tableRows, virtualRange.start, virtualRange.end],
  );

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailRow) { setDetailRowId(null); setSelectedRowId(null); }
        else if (editingCell) setEditingCell(null);
        else if (showFilters) setShowFilters(false);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [detailRow, editingCell, showFilters]);

  useEffect(() => {
    if (realtimeStatus === 'connecting') {
      toast('Reconnecting to live sync...', { icon: 'ℹ️', style: { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' } });
    }
  }, [realtimeStatus]);

  return (
    <>
      {/* Mobile guard */}
      <div className="md:hidden min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-sm">
          <h2 className="text-lg font-bold text-foreground mb-2">Boosty AI CRM</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This dashboard is optimized for desktop. Please use a desktop browser for the best experience.
          </p>
        </div>
      </div>

      {/* Desktop */}
      <div
        className="hidden md:flex flex-col bg-background overflow-hidden"
        style={{
          width: `${100 / zoom}vw`,
          height: `${100 / zoom}vh`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >

        {/* ══ TOP NAV BAR ══ */}
        <header className="flex items-center h-[52px] bg-card border-b border-border px-5 gap-3 shrink-0 z-30">
          <div className="flex items-center gap-[6px] text-[13px] text-muted-foreground">
            <span>Boosty AI</span>
            <span className="opacity-40">›</span>
            <button
              type="button"
              onClick={() => setView('contacts')}
              className={cn(
                'px-2 py-0.5 rounded-md transition-colors',
                view === 'contacts' ? 'text-foreground font-medium bg-surface2' : 'hover:text-foreground',
              )}
            >
              Contacts
            </button>
            <span className="opacity-40">·</span>
            <button
              type="button"
              onClick={() => setView('live')}
              className={cn(
                'px-2 py-0.5 rounded-md transition-colors',
                view === 'live' ? 'text-foreground font-medium bg-surface2' : 'hover:text-foreground',
              )}
            >
              Live
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-semibold border',
              realtimeStatus === 'connected' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : realtimeStatus === 'connecting' ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-red-50 border-red-200 text-red-600',
            )}>
              <span className={cn(
                'h-[5px] w-[5px] rounded-full',
                realtimeStatus === 'connected' ? 'bg-emerald-500' : realtimeStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500',
              )} />
              {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'connecting' ? 'Reconnecting...' : 'Disconnected'}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} disabled={zoom <= 0.5} aria-label="Zoom out" className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-surface2 hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent">
                <span className="text-[14px] leading-none font-semibold">−</span>
              </button>
              <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom" className="h-6 min-w-[36px] px-1 text-[10px] font-semibold tabular-nums text-muted-foreground hover:text-foreground transition-colors">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} disabled={zoom >= 2} aria-label="Zoom in" className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-surface2 hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent">
                <span className="text-[14px] leading-none font-semibold">+</span>
              </button>
            </div>
            <button onClick={() => setShowAddDialog(true)}
              className="h-[32px] px-3.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold flex items-center gap-[6px] hover:bg-[hsl(166,67%,38%)] transition-all shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              New Contact
            </button>
          </div>
        </header>

        {/* ══ MAIN LAYOUT ══ */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── TOOLBAR ── */}
            <div className="flex items-center h-[46px] bg-card border-b border-border px-4 gap-2 shrink-0">
              <div className="flex-1" />
              <div className="flex gap-[6px]">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    'h-7 px-[10px] rounded-lg text-[12px] cursor-pointer bg-card border border-border text-muted-foreground flex items-center gap-[5px] transition-all hover:bg-muted hover:text-foreground',
                    (showFilters || filters.length > 0) && 'bg-primary/10 text-primary border-primary/30',
                  )}>
                  <Filter className="h-3 w-3" />
                  Filter
                  {filters.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-[9px] font-bold rounded-full h-3.5 min-w-[14px] flex items-center justify-center px-1 ml-0.5">
                      {filters.length}
                    </span>
                  )}
                </button>
                <ColumnChecklist columns={allColumns} hiddenColumns={hiddenColumns} onToggle={toggleCol} />
                <AddColumnButton existingColumns={orderedColumns} />
              </div>
              <div className="w-px h-5 bg-border mx-1" />
              {showSearch ? (
                <div className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    autoFocus
                    className="h-7 w-48 rounded-lg border border-border bg-muted px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowSearch(true)} className="flex items-center gap-[5px] text-muted-foreground text-[12px] hover:text-foreground transition-colors cursor-pointer">
                  <Search className="h-3.5 w-3.5" />
                  <span>Search</span>
                </button>
              )}
            </div>

            {/* Filter bar */}
            {showFilters && (
              <div className="border-b border-border bg-card px-4 py-2">
                <FilterBar />
              </div>
            )}

            {/* Error */}
            {error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-card rounded-xl border border-border p-8 text-center max-w-sm">
                  <X className="h-8 w-8 text-destructive mx-auto mb-3" />
                  <p className="text-foreground font-semibold mb-1">Failed to load data</p>
                  <p className="text-sm text-muted-foreground mb-4">{(error as any)?.message || 'Unknown error'}</p>
                  <button onClick={() => window.location.reload()} className="h-[30px] px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold">Try again</button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* ── TABLE ── */}
                <div ref={tableScrollRef} onScroll={handleTableScroll} className="relative flex-1 overflow-auto crm-scroll bg-card rounded-lg border border-border mx-4 mt-3 mb-1">
                  {isFetching && !isLoading && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] overflow-hidden">
                      <div className="crm-load-bar h-full w-1/3 bg-accent" />
                    </div>
                  )}

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <table className="border-collapse w-full table-fixed" style={{ minWidth: orderedColumns.reduce((s, c) => s + colW(c), 0) + 70 }}>
                      <thead>
                        <SortableContext items={orderedColumns} strategy={horizontalListSortingStrategy}>
                          <tr>
                            {table.getHeaderGroups()[0]?.headers.map((header) => {
                              if (header.id === '_actions') {
                                return <th key={header.id} className="sticky top-0 z-10 h-9 px-2 border-b border-r border-border bg-[hsl(220,14%,98%)]" style={{ width: 70, minWidth: 70 }} />;
                              }
                              return (
                                <SortableHeader
                                  key={header.id}
                                  colId={header.id}
                                  label={typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.id}
                                  sortBy={sortBy}
                                  onSort={handleSort}
                                  onRename={handleRenameColumn}
                                  onDelete={customColumnNames.includes(header.id) ? (col) => setDeleteColName(col) : undefined}
                                  customHeader={header.column.columnDef.header}
                                />
                              );
                            })}
                          </tr>
                        </SortableContext>
                      </thead>
                      <tbody>
                        {isLoading && data.length === 0 ? (
                          Array.from({ length: 12 }).map((_, i) => (
                            <tr key={i} className="border-b border-border">
                              {orderedColumns.map((col, j) => (
                                <td key={j} className="h-10 px-3 border-r border-border" style={{ width: colW(col), minWidth: colW(col) }}>
                                  <Skeleton className="h-4 w-full rounded bg-surface2" />
                                </td>
                              ))}
                              <td className="h-10 px-2 border-r border-border"><Skeleton className="h-4 w-5 rounded bg-surface2" /></td>
                            </tr>
                          ))
                        ) : data.length === 0 ? (
                          <tr>
                            <td colSpan={orderedColumns.length + 1} className="text-center py-16">
                              <Filter className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                              <p className="text-foreground font-semibold text-sm mb-1">No contacts found</p>
                              <p className="text-xs text-muted-foreground mb-3">Try adjusting your filters</p>
                              {filters.length > 0 && (
                                <button onClick={() => setFilters([])} className="h-7 px-3 rounded-md border border-border text-[12px] text-muted-foreground hover:bg-surface2 hover:text-foreground transition-all">Clear filters</button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          <>
                            {virtualRange.topPad > 0 && (
                              <tr aria-hidden className="pointer-events-none">
                                <td colSpan={orderedColumns.length + 1} style={{ height: virtualRange.topPad }} />
                              </tr>
                            )}

                            {virtualRows.map((row) => {
                              const rd = row.original;
                              const isSelected = selectedRowId === rd.id;

                              return (
                                <tr
                                  key={row.id}
                                  className={cn(
                                    'group border-b border-border transition-colors',
                                    selectedRowIds.has(rd.id)
                                      ? 'bg-primary/[0.08] shadow-[inset_3px_0_0_hsl(var(--primary))] hover:bg-primary/[0.12]'
                                      : isSelected
                                        ? 'bg-primary/[0.05] ring-1 ring-inset ring-primary/20 hover:bg-muted'
                                        : 'hover:bg-muted'
                                  )}
                                  style={{ height: TABLE_ROW_HEIGHT }}
                                >
                                  {row.getVisibleCells().map((cell) => (
                                    <td
                                      key={cell.id}
                                      className={cn(
                                        'h-10 px-3 border-r border-border whitespace-nowrap overflow-hidden text-ellipsis text-[13px]',
                                        cell.column.id === 'name' && 'sticky left-0 z-[5]',
                                        cell.column.id === 'name' && selectedRowIds.has(rd.id)
                                          ? 'bg-primary/[0.08]'
                                          : cell.column.id === 'name' && isSelected
                                            ? 'bg-primary/[0.05]'
                                            : cell.column.id === 'name' && 'bg-card group-hover:bg-muted',
                                      )}
                                      style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: 220 }}
                                    >
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}

                            {virtualRange.bottomPad > 0 && (
                              <tr aria-hidden className="pointer-events-none">
                                <td colSpan={orderedColumns.length + 1} style={{ height: virtualRange.bottomPad }} />
                              </tr>
                            )}

                            {/* Add contact row */}
                            <tr className="border-b border-border">
                              <td colSpan={orderedColumns.length + 1} className="h-9 px-[52px]">
                                <button onClick={() => setShowAddDialog(true)}
                                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-[12px] transition-colors">
                                  <span className="h-[18px] w-[18px] rounded border border-dashed border-muted-foreground flex items-center justify-center text-[14px] leading-none">+</span>
                                  Add contact
                                </button>
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </DndContext>
                </div>

                {/* ── STATS BAR / PAGINATION ── */}
                <div className="flex items-center justify-between h-9 bg-card border-t border-border px-5 shrink-0 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-5">
                    <span><b className="text-foreground font-semibold">{totalCount.toLocaleString()}</b> contacts</span>
                    {selectedCount > 0 ? (
                      <span className="flex items-center gap-1.5 text-primary font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {selectedCount} selected
                      </span>
                    ) : selectedRow ? (
                      <span className="flex items-center gap-1.5 text-primary font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Selected: #{selectedRow.id} — {selectedRow['name'] || 'Unnamed'}
                      </span>
                    ) : null}
                    {isFetching && !isLoading && <span className="text-primary font-medium">Refreshing…</span>}
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      Synced
                    </span>
                  </div>
                  {totalPages > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="mr-2">
                        Page <b className="text-foreground font-semibold">{page}</b> of {totalPages}
                      </span>
                      <button onClick={() => setPage(page - 1)} disabled={page <= 1}
                        className="h-[22px] px-2 rounded border border-border text-[10px] disabled:opacity-30 hover:bg-surface2 transition-colors">Prev</button>
                      {(() => {
                        const pages: number[] = [];
                        let s = Math.max(1, page - 2), e = Math.min(totalPages, s + 4);
                        if (e - s < 4) s = Math.max(1, e - 4);
                        for (let i = s; i <= e; i++) pages.push(i);
                        return pages.map((p) => (
                          <button key={p} onClick={() => setPage(p)}
                            className={cn('h-[22px] w-[22px] rounded text-[10px] font-semibold',
                              p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-surface2 text-muted-foreground')}>
                            {p}
                          </button>
                        ));
                      })()}
                      <button onClick={() => setPage(page + 1)} disabled={page >= totalPages}
                        className="h-[22px] px-2 rounded border border-border text-[10px] disabled:opacity-30 hover:bg-surface2 transition-colors">Next</button>
                      <div className="flex items-center gap-1 ml-1.5 pl-1.5 border-l border-border">
                        <span>Go</span>
                        <input type="number" value={goToPage} onChange={(e) => setGoToPage(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { const p = Number(goToPage); if (p >= 1 && p <= totalPages) { setPage(p); setGoToPage(''); } } }}
                          className="h-[22px] w-10 rounded border border-border bg-muted px-1.5 text-[10px] text-center text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          min={1} max={totalPages} />
                        <button
                          onClick={() => { const p = Number(goToPage); if (p >= 1 && p <= totalPages) { setPage(p); setGoToPage(''); } }}
                          className="h-[22px] px-1.5 rounded border border-border text-[10px] hover:bg-muted transition-colors"
                        >→</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Contact Dialog */}
        <AddRecordDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSubmit={handleAddRow}
          visibleFields={null}
          initialValues={undefined}
          title="New Contact"
        />

        {selectedCount > 0 && (
          <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-sm font-medium text-foreground">
                <CheckSquare2 className="h-4 w-4 text-primary" />
                <span>{selectedCount} contact{selectedCount === 1 ? '' : 's'} selected</span>
              </div>
              <Button variant="outline" size="sm" onClick={clearBulkSelection}>
                <X className="h-4 w-4" />
                Deselect All
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {/* Delete contact dialog */}
        <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent className="rounded-xl bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete Contact</AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] text-muted-foreground">
                Are you sure you want to delete this contact? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteId(null)} className="rounded-lg text-[13px] bg-muted border-border text-foreground hover:bg-border">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-[13px]">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk delete dialog */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
          <AlertDialogContent className="rounded-xl bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete Selected Contacts</AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] text-muted-foreground">
                Delete {selectedCount} selected contact{selectedCount === 1 ? '' : 's'}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBulkDeleteOpen(false)} className="rounded-lg text-[13px] bg-muted border-border text-foreground hover:bg-border">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-[13px]">Delete Selected</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete column dialog */}
        <AlertDialog open={deleteColName !== null} onOpenChange={(o) => !o && setDeleteColName(null)}>
          <AlertDialogContent className="rounded-xl bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete Column</AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] text-muted-foreground">
                Are you sure you want to delete the column "{deleteColName}"? All data in this column will be lost. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteColName(null)} className="rounded-lg text-[13px] bg-muted border-border text-foreground hover:bg-border">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteColumnConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-[13px]">Delete Column</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Detail panel */}
        <RowDetailPanel
          row={detailRow}
          open={detailRow !== null}
          onClose={() => { setDetailRowId(null); setSelectedRowId(null); }}
          onUpdate={async (id, field, value) => {
            if (field === 'assigned_to') {
              const row = data.find((r) => r.id === id);
              const oldValue = row ? (row as any).assigned_to : undefined;
              await updateRow(id, field, value);
              if (row && oldValue !== value && (row as any).contact_id) {
                triggerAssignedToFlow(String((row as any).contact_id), String(value));
              }
            } else {
              await updateRow(id, field, value);
            }
          }}
          onDelete={deleteRow}
          onDeleteColumn={(name) => setDeleteColName(name)}
          visibleFields={null}
        />
      </div>
    </>
  );
}
