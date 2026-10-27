import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { CheckSquare2, Trash2, X } from 'lucide-react';
import { ColumnHeaderCell } from './ColumnHeaderCell';
import { useBoostyData, useBoostyRealtime, useDeleteRow, useDeleteRows } from '@/hooks/useBoostyData';
import { useCRMStore } from '@/store/crmStore';
import { DEFAULT_COLUMN_ORDER, READONLY_COLUMNS, HIDDEN_INTERNAL_COLUMNS } from '@/lib/columns';
import { CellRenderer } from './CellRenderer';
import { CellEditor } from './CellEditor';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { BulkSelectionBar } from './BulkSelectionBar';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import type { Tables } from '@/integrations/supabase/types';

type ContactRow = Tables<'contacts'>;

export function CRMTable() {
  const { rows, totalCount, isLoading, error, refetch } = useBoostyData();
  useBoostyRealtime();

  const { page, pageSize, setPage, editingCell, setEditingCell, hiddenColumns, columnOrder } = useCRMStore();
  const deleteRow = useDeleteRow();
  const deleteRows = useDeleteRows();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const visibleIds = new Set(rows.map((row) => row.id));
    setSelectedRowIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const selectedCount = selectedRowIds.size;
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedRowIds.has(row.id));
  const someVisibleSelected = rows.some((row) => selectedRowIds.has(row.id));

  const toggleRowSelection = (rowId: number, checked: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedRowIds(new Set());
      return;
    }

    setSelectedRowIds(new Set(rows.map((row) => row.id)));
  };

  const clearSelection = () => setSelectedRowIds(new Set());

  const handleBulkDelete = () => {
    const ids = Array.from(selectedRowIds);
    if (ids.length === 0) return;

    deleteRows.mutate(ids, {
      onSuccess: () => {
        clearSelection();
        setBulkDeleteOpen(false);
      },
    });
  };

  const allColumnKeys = useMemo(() => {
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      if (columnOrder.length > 0) {
        const ordered = columnOrder.filter((c) => keys.includes(c));
        const remaining = keys.filter((c) => !ordered.includes(c));
        return [...ordered, ...remaining];
      }
      return [...keys].sort((a, b) => {
        const ai = DEFAULT_COLUMN_ORDER.indexOf(a);
        const bi = DEFAULT_COLUMN_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }
    return columnOrder.length > 0 ? columnOrder : DEFAULT_COLUMN_ORDER;
  }, [rows, columnOrder]);

  const visibleColumns = useMemo(
    () => allColumnKeys.filter((c) => !hiddenColumns.includes(c) && !HIDDEN_INTERNAL_COLUMNS.includes(c)),
    [allColumnKeys, hiddenColumns]
  );

  const columns = useMemo<ColumnDef<ContactRow, any>[]>(() => {
    const cols: ColumnDef<ContactRow, any>[] = visibleColumns.map((key) => ({
      id: key,
      accessorFn: (row: any) => row[key],
      header: key === 'id'
        ? () => (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                aria-label="Select all leads"
                className="border-border"
              />
              <span>{key}</span>
            </div>
          )
        : () => <ColumnHeaderCell column={key} />,
      cell: ({ row }) => {
        const rowData = row.original;
        const isEditing = editingCell?.rowId === rowData.id && editingCell?.column === key;
        const isReadonly = READONLY_COLUMNS.includes(key);
        const isSelected = selectedRowIds.has(rowData.id);

        if (isEditing && !isReadonly) {
          return <CellEditor rowId={rowData.id} column={key} value={(rowData as any)[key]} rowData={rowData as any} />;
        }

        if (key === 'id') {
          return (
            <div className="flex items-center gap-2">
              <div className="relative flex h-5 w-5 items-center justify-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(nextChecked) => toggleRowSelection(rowData.id, nextChecked === true)}
                  aria-label={`Select lead ${rowData.id}`}
                  className={`absolute inset-0 m-auto h-4 w-4 border-border bg-background transition-all ${
                    isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100'
                  }`}
                />
                <span
                  className={`text-sm text-foreground transition-opacity ${
                    isSelected ? 'opacity-0' : 'opacity-100 group-hover:opacity-0 group-focus-within:opacity-0'
                  }`}
                >
                  {(rowData as any)[key]}
                </span>
              </div>
            </div>
          );
        }

        return (
          <div
            className={`cursor-default min-h-[24px] ${!isReadonly ? 'cursor-pointer rounded px-1 -mx-1 hover:bg-muted/60' : ''}`}
            onDoubleClick={() => {
              if (!isReadonly) setEditingCell({ rowId: rowData.id, column: key });
            }}
          >
            <CellRenderer column={key} value={(rowData as any)[key]} rowId={rowData.id} />
          </div>
        );
      },
      size: key === 'id' ? 110 : key === 'Client name' ? 180 : key === 'Chat Summary' ? 220 : 140,
    }));

    cols.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={() => setDeleteId(row.original.id)}
          className="p-1 text-muted-foreground transition-colors hover:text-destructive"
          aria-label={`Delete row ${row.original.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
      size: 40,
    });

    return cols;
  }, [visibleColumns, editingCell, setEditingCell, allVisibleSelected, someVisibleSelected, selectedRowIds]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="font-medium text-destructive">Failed to load data</p>
        <button onClick={() => refetch()} className="text-sm text-primary underline">Retry</button>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/50">
                {hg.headers.map((header, i) => {
                  const isStickyFirstColumn = i === 0;

                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2.5 text-left text-xs font-semibold text-foreground whitespace-nowrap ${
                        isStickyFirstColumn ? 'sticky left-0 z-20 bg-muted/50' : ''
                      }`}
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {visibleColumns.map((column, j) => (
                      <td
                        key={column}
                        className={`px-3 py-2 ${j === 0 ? 'sticky left-0 z-20 bg-card' : ''}`}
                      >
                        {column === 'id' ? (
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded-sm" />
                            <Skeleton className="h-4 w-10" />
                          </div>
                        ) : (
                          <Skeleton className="h-4 w-full" />
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2"><Skeleton className="h-4 w-4" /></td>
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => {
                  const isSelected = selectedRowIds.has(row.original.id);

                  return (
                    <tr
                      key={row.id}
                      className={`group border-b border-border transition-colors ${
                        isSelected ? 'bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))] hover:bg-primary/10' : 'hover:bg-muted/30'
                      }`}
                    >
                      {row.getVisibleCells().map((cell, i) => {
                        const isStickyFirstColumn = i === 0;

                        return (
                          <td
                            key={cell.id}
                            className={`px-3 py-2 whitespace-nowrap ${
                              isStickyFirstColumn ? 'sticky left-0 z-20 bg-inherit' : ''
                            }`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="rounded border border-border px-2 py-1 disabled:opacity-30 hover:bg-muted"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="rounded border border-border px-2 py-1 disabled:opacity-30 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <BulkSelectionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        isDeleting={deleteRows.isPending}
      />

      <DeleteConfirmDialog
        open={deleteId !== null}
        onConfirm={() => {
          if (deleteId !== null) deleteRow.mutate(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
        title="Delete Selected Leads"
        description={`Delete ${selectedCount} selected lead${selectedCount === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmLabel="Delete Selected"
      />
    </>
  );
}
