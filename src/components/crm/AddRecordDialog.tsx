import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoostySchema } from '@/hooks/useBoostySchema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const DEFAULT_FIELD_DEFS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'contact_id', label: 'Contact ID (CBB)', type: 'text' },
  { key: 'status', label: 'Status', type: 'enum' },
  { key: 'assigned_to', label: 'Assigned To', type: 'enum' },
  { key: 'backoffice', label: 'Backoffice', type: 'enum' },
  { key: 'live', label: 'Live', type: 'enum' },
  { key: 'next_contact_date', label: 'Next Contact Date', type: 'date' },
  { key: 'ftd_date_actual', label: 'FTD Date (Actual)', type: 'date' },
] as const;

const READONLY = new Set(['id', 'created_at', 'updated_at', 'first_contact_date']);
const TEXTAREA_FIELDS = new Set<string>([]);
const BOOLEAN_FIELDS = new Set(['backoffice', 'live']);

interface AddRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  /** When provided, the dialog renders only these columns (in order) using live schema. */
  visibleFields?: string[] | null;
  /** Initial values applied on open (e.g. Premium_Clients='Premium' in Premium view). */
  initialValues?: Record<string, any>;
  title?: string;
}

export function AddRecordDialog({
  open,
  onOpenChange,
  onSubmit,
  visibleFields,
  initialValues,
  title,
}: AddRecordDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>(
    initialValues ?? {}
  );
  const [saving, setSaving] = useState(false);
  const { enumColumns, columnTypes } = useBoostySchema();

  // Reset whenever opened with new initial values
  useMemo(() => {
    if (open) setFormData(initialValues ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fields = useMemo(() => {
    if (visibleFields && visibleFields.length > 0) {
      return visibleFields
        .filter((k) => !READONLY.has(k))
        .map((key) => {
          const options = enumColumns[key] ?? [];
          let type: 'text' | 'enum' | 'date' | 'number' | 'textarea' = 'text';
          if (options.length > 0) type = 'enum';
          else if (columnTypes[key] === 'date') type = 'date';
          else if (columnTypes[key] === 'number') type = 'number';
          else if (TEXTAREA_FIELDS.has(key)) type = 'textarea';
          return { key, label: key, type, options };
        });
    }
    return DEFAULT_FIELD_DEFS.map((field) => ({
      ...field,
      options: BOOLEAN_FIELDS.has(field.key)
        ? ['true', 'false']
        : (enumColumns[field.key] ?? []),
    }));
  }, [visibleFields, enumColumns, columnTypes]);

  const setValue = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const cleaned: Record<string, any> = { ...(initialValues ?? {}) };
    for (const [k, v] of Object.entries(formData)) {
      if (v === '' || v === null || v === undefined) continue;
      if (BOOLEAN_FIELDS.has(k)) {
        cleaned[k] = v === 'true';
      } else {
        cleaned[k] = v;
      }
    }
    setSaving(true);
    try {
      await onSubmit(cleaned);
      setFormData({});
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({});
    onOpenChange(false);
  };

  const inputCls = 'w-full h-9 rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

  const fullWidthKeys = new Set<string>([]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[520px] p-0 gap-0 rounded-xl overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle className="font-display text-[16px] font-bold text-foreground flex items-center gap-2">
            <span className="h-7 w-7 rounded-md bg-primary/[0.12] flex items-center justify-center">
              <Plus className="h-4 w-4 text-primary" />
            </span>
            {title ?? 'New Record'}
          </DialogTitle>
          <p className="text-[12px] text-muted-foreground mt-1">Fill in the details below to create a new contact record.</p>
        </DialogHeader>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto crm-scroll space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.filter((f) => f.type !== 'textarea').map((field) => (
              <div key={field.key} className={cn('space-y-1.5', fullWidthKeys.has(field.key) && 'col-span-2')}>
                <label className="text-[10px] font-semibold uppercase tracking-[0.7px] text-muted-foreground">
                  {field.label}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    value={formData[field.key] ?? ''}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    className={inputCls}
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    value={formData[field.key] ?? ''}
                    onChange={(e) => setValue(field.key, e.target.value ? Number(e.target.value) : '')}
                    placeholder="0"
                    className={inputCls}
                  />
                )}

                {field.type === 'enum' && (
                  <select
                    value={formData[field.key] ?? ''}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    className={cn(inputCls, !formData[field.key] && 'text-muted-foreground')}
                  >
                    <option value="">Select...</option>
                    {field.options.map((o) => (
                      <option key={o} value={o}>
                        {BOOLEAN_FIELDS.has(field.key) ? (o === 'true' ? 'Yes' : 'No') : o}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === 'date' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn(inputCls, 'text-left', !formData[field.key] && 'text-muted-foreground')}>
                        {formData[field.key] ? format(new Date(formData[field.key]), 'dd MMM yyyy') : 'Pick a date...'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                      <Calendar
                        mode="single"
                        selected={formData[field.key] ? new Date(formData[field.key]) : undefined}
                        onSelect={(d) => setValue(field.key, d ? format(d, 'yyyy-MM-dd') : '')}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            ))}
          </div>

          {fields.filter((f) => f.type === 'textarea').map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.7px] text-muted-foreground">
                {field.label}
              </label>
              <textarea
                value={formData[field.key] ?? ''}
                onChange={(e) => setValue(field.key, e.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}...`}
                rows={3}
                className={cn(inputCls, 'h-auto py-2 resize-none')}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-card">
          <p className="text-[11px] text-muted-foreground">
            Record will be synced instantly.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={handleCancel}
              className="h-[32px] px-3.5 rounded-lg border border-border bg-card text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="h-[32px] px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold flex items-center gap-[5px] transition-all disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create Record
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
