import { useCRMStore } from '@/store/useCRMStore';
import { DEFAULT_COLUMN_ORDER } from '@/lib/columns';
import { useBoostySchema } from '@/hooks/useBoostySchema';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

const ENUM_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

const ASSIGNED_TO_QUICK_FILTERS = [
  { label: 'Bot',               value: 'bot' },
  { label: 'Account Exists',    value: 'Human_AccountExists' },
  { label: 'Deposit Made',      value: 'Human_DepositMade' },
  { label: 'General',            value: 'Human_General' },
  { label: 'Manually',           value: 'Human_Manually' },
  { label: 'Trash',              value: 'Human_Trash' },
];

export function FilterBar() {
  const { filters, addFilter, removeFilter, updateFilter, clearFilters } = useCRMStore();
  const { enumColumns } = useBoostySchema();

  const handleAdd = () => {
    addFilter({
      id: crypto.randomUUID(),
      column: 'name',
      operator: 'contains',
      value: '',
    });
  };

  const noValueOps = ['is_empty', 'is_not_empty'];

  const toggleAssignedTo = (value: string) => {
    const existing = filters.find(
      (f) => f.column === 'assigned_to' && f.operator === 'equals' && f.value === value,
    );
    if (existing) {
      removeFilter(existing.id);
    } else {
      addFilter({ id: crypto.randomUUID(), column: 'assigned_to', operator: 'equals', value });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {ASSIGNED_TO_QUICK_FILTERS.map((qf) => {
          const active = filters.some(
            (f) => f.column === 'assigned_to' && f.operator === 'equals' && f.value === qf.value,
          );
          return (
            <button
              key={qf.value}
              onClick={() => toggleAssignedTo(qf.value)}
              className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary hover:text-foreground'
              }`}
            >
              {qf.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => {
        const enumOptions = enumColumns[f.column] ?? [];
        const isEnumColumn = enumOptions.length > 0;

        return (
          <div key={f.id} className="flex items-center gap-1 bg-card border border-border rounded-md px-2 py-1 text-sm">
            <select
              value={f.column}
              onChange={(e) => {
                const newCol = e.target.value;
                const newIsEnum = (enumColumns[newCol] ?? []).length > 0;
                const opIsTextOnly = f.operator === 'contains' || f.operator === 'starts_with';
                updateFilter(f.id, {
                  column: newCol,
                  value: '',
                  ...(newIsEnum && opIsTextOnly ? { operator: 'equals' } : {}),
                });
              }}
              className="bg-transparent border-none text-xs focus:outline-none"
            >
              {DEFAULT_COLUMN_ORDER.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            <select
              value={f.operator}
              onChange={(e) => updateFilter(f.id, { operator: e.target.value })}
              className="bg-transparent border-none text-xs focus:outline-none"
            >
              {(isEnumColumn ? ENUM_OPERATORS : OPERATORS).map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            {!noValueOps.includes(f.operator) && (
              isEnumColumn ? (
                <select
                  value={f.value}
                  onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                  className="bg-transparent border-none text-xs focus:outline-none min-w-[80px]"
                >
                  <option value="">Select...</option>
                  {enumOptions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={f.value}
                  onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                  placeholder="value"
                  className="bg-transparent border-none text-xs focus:outline-none min-w-[80px]"
                />
              )
            )}
            <button onClick={() => removeFilter(f.id)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={handleAdd} className="text-xs gap-1 h-7">
        <Plus className="h-3 w-3" /> Filter
      </Button>
      {filters.length > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 text-muted-foreground">
          Clear all
        </Button>
      )}
    </div>
    </div>
  );
}
