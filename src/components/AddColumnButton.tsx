import { useMemo, useState } from 'react';
import { Calendar, CheckSquare, Hash, List, Plus, Type, X, ArrowLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCRMStore } from '@/store/useCRMStore';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ColumnType = 'text' | 'number' | 'date' | 'checkbox' | 'dropdown';
type Step = 'config' | 'options' | 'confirm';

interface AddColumnDialogProps {
  existingColumns: string[];
}

const COLUMN_TYPE_OPTIONS: Array<{
  label: string;
  value: ColumnType;
  description: string;
  icon: typeof Type;
}> = [
  { label: 'Text', value: 'text', description: 'Free-form text values', icon: Type },
  { label: 'Number', value: 'number', description: 'Numeric values only', icon: Hash },
  { label: 'Date', value: 'date', description: 'Calendar date values', icon: Calendar },
  { label: 'Checkbox', value: 'checkbox', description: 'True / false values', icon: CheckSquare },
  { label: 'Dropdown', value: 'dropdown', description: 'Select from fixed options', icon: List },
];

export function AddColumnButton({ existingColumns }: AddColumnDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('config');
  const [name, setName] = useState('');
  const [columnType, setColumnType] = useState<ColumnType>('text');
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { columnOrder, setColumnOrder } = useCRMStore();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setOpen(false);
    setStep('config');
    setName('');
    setColumnType('text');
    setOptions([]);
    setOptionInput('');
    setError('');
  };

  const validateConfig = () => {
    const trimmed = name.trim();
    if (!trimmed) return 'Column name is required';
    if (trimmed.length > 50) return 'Column name must be 50 characters or less';
    if (existingColumns.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return 'Column already exists';
    if (!/^[a-zA-Z0-9 _\-]+$/.test(trimmed)) return 'Only letters, numbers, spaces, underscores, and hyphens allowed';
    return '';
  };

  const handleNext = () => {
    const err = validateConfig();
    if (err) { setError(err); return; }
    setError('');
    if (columnType === 'dropdown') {
      setStep('options');
    } else {
      setStep('confirm');
    }
  };

  const addOption = () => {
    const trimmed = optionInput.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) { setError('Each option must be 50 characters or less'); return; }
    if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) { setError('Option already exists'); return; }
    setOptions([...options, trimmed]);
    setOptionInput('');
    setError('');
  };

  const removeOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    setError('');
    setLoading(true);

    try {
      const payload = {
        column_name: trimmed,
        data_type: columnType,
        options: columnType === 'dropdown' ? options : undefined,
      };
      console.log('[AddColumn] Sending payload to edge function:', JSON.stringify(payload));
      const { data, error: fnError } = await supabase.functions.invoke('add-column', {
        body: payload,
      });

      console.log('[AddColumn] Response from edge function:', JSON.stringify(data), 'Error:', fnError);
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      // Custom column metadata is now saved server-side by the edge function

      // Eagerly update the local schema cache so the column renders correctly
      // even if get-boosty-schema fetch fails
      queryClient.setQueryData<{ enumColumns: Record<string, string[]>; columnTypes: Record<string, string> } | undefined>(
        ['boosty-schema'],
        (old) => {
          const prev = old ?? { enumColumns: {}, columnTypes: {} };
          const nextEnumColumns = { ...prev.enumColumns };
          const nextColumnTypes = { ...prev.columnTypes };

          if (columnType === 'dropdown' && options.length > 0) {
            nextEnumColumns[trimmed] = [...options];
            nextColumnTypes[trimmed] = 'dropdown';
          } else {
            nextColumnTypes[trimmed] = columnType as string;
          }

          return { enumColumns: nextEnumColumns, columnTypes: nextColumnTypes };
        }
      );

      const newOrder = [...(columnOrder.length > 0 ? columnOrder : existingColumns), trimmed];
      setColumnOrder(newOrder);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['boosty'] }),
        queryClient.invalidateQueries({ queryKey: ['boosty-schema'] }),
      ]);

      toast.success('Column added successfully');
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add column. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const typeLabel = COLUMN_TYPE_OPTIONS.find((o) => o.value === columnType)?.label ?? columnType;
  const TypeIcon = COLUMN_TYPE_OPTIONS.find((o) => o.value === columnType)?.icon ?? Type;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-card px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Add column"
      >
        <Plus className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); }}>
        <DialogContent className="max-w-md gap-0 overflow-hidden border-border p-0">

          {/* ── STEP 1: Config ── */}
          {step === 'config' && (
            <>
              <DialogHeader className="border-b border-border px-6 py-5">
                <DialogTitle className="flex items-center gap-2 text-foreground">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Plus className="h-4 w-4" />
                  </span>
                  Add new column
                </DialogTitle>
                <DialogDescription>Choose a column name and data type.</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 px-6 py-5">
                <div className="space-y-2">
                  <Label htmlFor="col-name">Column name</Label>
                  <Input
                    id="col-name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
                    placeholder="Enter column name..."
                    maxLength={50}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">{name.length}/50 characters</p>
                </div>

                <div className="space-y-2">
                  <Label>Data type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLUMN_TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = opt.value === columnType;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { setColumnType(opt.value); setError(''); }}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            active
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border bg-card text-foreground hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                            {opt.label}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <DialogFooter className="border-t border-border px-6 py-4">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={handleNext} disabled={!name.trim()}>
                  {columnType === 'dropdown' ? 'Next' : 'Review'}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── STEP 2: Dropdown options ── */}
          {step === 'options' && (
            <>
              <DialogHeader className="border-b border-border px-6 py-5">
                <DialogTitle className="flex items-center gap-2 text-foreground">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <List className="h-4 w-4" />
                  </span>
                  Add dropdown options
                </DialogTitle>
                <DialogDescription>
                  Define the fixed options for <span className="font-medium text-foreground">"{name.trim()}"</span>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-6 py-5">
                <div className="flex gap-2">
                  <Input
                    value={optionInput}
                    onChange={(e) => { setOptionInput(e.target.value); setError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                    placeholder="Type an option..."
                    maxLength={50}
                    autoFocus
                  />
                  <Button size="sm" onClick={addOption} disabled={!optionInput.trim()} className="shrink-0">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                {options.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground"
                      >
                        {opt}
                        <button
                          onClick={() => removeOption(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No options added yet. Add at least one option to continue.
                  </p>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <DialogFooter className="border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => { setStep('config'); setError(''); }}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={() => { setError(''); setStep('confirm'); }} disabled={options.length === 0}>
                  Confirm Options
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── STEP 3: Confirmation ── */}
          {step === 'confirm' && (
            <>
              <DialogHeader className="border-b border-border px-6 py-5">
                <DialogTitle className="flex items-center gap-2 text-foreground">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Check className="h-4 w-4" />
                  </span>
                  Confirm new column
                </DialogTitle>
                <DialogDescription>Review the details before creating.</DialogDescription>
              </DialogHeader>

              <div className="px-6 py-5 space-y-4">
                <div className="rounded-lg border border-border bg-muted/50 divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Column name</span>
                    <span className="text-sm font-medium text-foreground">{name.trim()}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Data type</span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <TypeIcon className="h-3.5 w-3.5 text-primary" />
                      {typeLabel}
                    </span>
                  </div>
                  {columnType === 'dropdown' && options.length > 0 && (
                    <div className="px-4 py-3">
                      <p className="text-sm text-muted-foreground mb-2">Options</p>
                      <div className="flex flex-wrap gap-1.5">
                        {options.map((opt, i) => (
                          <span key={i} className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground">
                            {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <DialogFooter className="border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => { setError(''); setStep(columnType === 'dropdown' ? 'options' : 'config'); }}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Column'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
