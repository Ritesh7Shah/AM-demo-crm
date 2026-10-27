import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DEFAULT_COLUMN_ORDER, READONLY_COLUMNS } from '@/lib/columns';
import { useAddRow } from '@/hooks/useBoostyData';
import { useBoostySchema } from '@/hooks/useBoostySchema';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddRowDialog({ open, onClose }: Props) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const addRow = useAddRow();
  const { enumColumns, columnTypes } = useBoostySchema();

  const editableColumns = DEFAULT_COLUMN_ORDER.filter((c) => !READONLY_COLUMNS.includes(c));

  const handleSave = () => {
    const row: Record<string, any> = {};
    editableColumns.forEach((col) => {
      const val = formData[col]?.trim();
      if (val) row[col] = val;
    });
    addRow.mutate(row as any, {
      onSuccess: () => {
        setFormData({});
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {editableColumns.map((col) => {
            const options = enumColumns[col];
            const isEnum = (options ?? []).length > 0 || columnTypes[col] === 'dropdown';
            const isDate = columnTypes[col] === 'date';

            return (
              <div key={col} className="grid grid-cols-[140px_1fr] gap-2 items-center">
                <label className="text-xs font-medium text-foreground truncate">{col}</label>
                {isEnum && options ? (
                  <select
                    value={formData[col] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                    className="border border-input rounded px-2 py-1.5 text-sm bg-card"
                  >
                    <option value="">—</option>
                    {options.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : isDate ? (
                  <input
                    type="date"
                    value={formData[col] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                    className="border border-input rounded px-2 py-1.5 text-sm bg-card"
                  />
                ) : (
                  <input
                    type="text"
                    value={formData[col] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                    className="border border-input rounded px-2 py-1.5 text-sm bg-card"
                  />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={addRow.isPending}>
            {addRow.isPending ? 'Adding...' : 'Add Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
