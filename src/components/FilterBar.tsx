import { useCallback } from 'react';
import { Filter, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCRMStore } from '@/store/useCRMStore';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ── Column metadata ──

const ALL_COLUMNS = [
  'Client name', 'Contact ID', 'First qualification date',
  'Lead Status', 'Bot Status', 'deposit_completed', 'current_stage',
  'Inbox Link', 'Chat Summary', 'Broker', 'QFTD', 'Country',
  'Lead Source', 'Send Upsell 1 Message', 'Upsell 1 Status',
  '2QFTD', 'Send Upsell 2 Message', 'Upsell 2 Status',
  '3QFTD', 'Send Upsell 3 Message', 'Upsell 3 Status',
  '4QFTD', 'Send Upsell 4 Message', 'Upsell 4 Status',
  'Premium_Clients', 'signup_steps_sent', 'created_at',
];

const ENUM_OPTIONS: Record<string, string[]> = {
  Premium_Clients: ['Premium', 'null'],
  signup_steps_sent: ['Yes', 'No'],
  Broker: ['Vantage', 'AXI'],
  QFTD: ['Triggered', 'Manual Trigger', 'Negative Net Deposit'],
  '2QFTD': ['Triggered', 'Manual Trigger', 'Negative Net Deposit'],
  '3QFTD': ['Triggered', 'Manual Trigger', 'Negative Net Deposit'],
  '4QFTD': ['Triggered', 'Manual Trigger', 'Negative Net Deposit'],
  'Lead Status': ['Hot', 'Warm', 'Cold'],
  'Bot Status': ['Bot', 'Human-Manually', 'Human-Deposit Made', 'Human-account_exist', 'Human-🗑️'],
  deposit_completed: ['Yes', 'No'],
};

const DATE_COLUMNS = ['First qualification date', 'created_at'];

type ColType = 'enum' | 'date' | 'text';

function getColType(col: string): ColType {
  if (ENUM_OPTIONS[col]) return 'enum';
  if (DATE_COLUMNS.includes(col)) return 'date';
  return 'text';
}

const OPERATORS: Record<ColType, { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  enum: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  date: [
    { value: 'is', label: 'is' },
    { value: 'is_before', label: 'is before' },
    { value: 'is_after', label: 'is after' },
    { value: 'is_between', label: 'is between' },
    { value: 'is_empty', label: 'is empty' },
  ],
};

const NO_VALUE_OPS = ['is_empty', 'is_not_empty'];

// ── Filter row interface (local with id) ──

interface LocalFilter {
  id: string;
  column: string;
  operator: string;
  value: string;
}

// ── Component ──

export function FilterBar() {
  const { filters, setFilters, setCurrentPage } = useCRMStore();

  const localFilters: LocalFilter[] = filters.map((f, i) => ({
    ...f,
    id: `filter-${i}`,
  }));

  const pushFilters = useCallback(
    (next: LocalFilter[]) => {
      const cleaned = next.map(({ column, operator, value }) => ({ column, operator, value }));
      setFilters(cleaned);
      setCurrentPage(1);
    },
    [setFilters, setCurrentPage]
  );

  const addFilter = () => {
    pushFilters([
      ...localFilters,
      { id: '', column: 'Client name', operator: 'contains', value: '' },
    ]);
  };

  const removeFilter = (index: number) => {
    pushFilters(localFilters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, patch: Partial<LocalFilter>) => {
    const next = localFilters.map((f, i) => {
      if (i !== index) return f;
      const updated = { ...f, ...patch };

      if (patch.column) {
        const newType = getColType(patch.column);
        const validOps = OPERATORS[newType].map((o) => o.value);
        if (!validOps.includes(updated.operator)) {
          updated.operator = validOps[0];
        }
        updated.value = '';
      }

      if (patch.operator && NO_VALUE_OPS.includes(patch.operator)) {
        updated.value = '';
      }

      return updated;
    });
    pushFilters(next);
  };

  const clearAll = () => {
    setFilters([]);
    setCurrentPage(1);
  };

  const activeCount = filters.length;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const SAVED_FILTERS: { label: string; filter: { column: string; operator: string; value: string } }[] = [
    { label: 'Sign Up Steps', filter: { column: 'signup_steps_sent', operator: 'is', value: 'Yes' } },
    { label: 'Account Transfer Needed', filter: { column: 'Bot Status', operator: 'is', value: 'Human-account_exist' } },
    { label: 'Deposit Made', filter: { column: 'Bot Status', operator: 'is', value: 'Human-Deposit Made' } },
    { label: 'Premium', filter: { column: 'Premium_Clients', operator: 'is', value: 'Premium' } },
    { label: 'Created At', filter: { column: 'created_at', operator: 'is', value: todayStr } },
  ];

  const isSavedActive = (sf: typeof SAVED_FILTERS[number]) =>
    filters.some(
      (f) => f.column === sf.filter.column && f.operator === sf.filter.operator && f.value === sf.filter.value
    );

  const toggleSavedFilter = (sf: typeof SAVED_FILTERS[number]) => {
    const exists = isSavedActive(sf);
    if (exists) {
      const next = filters.filter(
        (f) => !(f.column === sf.filter.column && f.operator === sf.filter.operator && f.value === sf.filter.value)
      );
      setFilters(next);
    } else {
      setFilters([...filters, sf.filter]);
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-2">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={addFilter}
          className="h-8 gap-1.5 text-xs border-border bg-secondary text-foreground hover:bg-muted"
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
          {activeCount > 0 && (
            <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {activeCount}
            </span>
          )}
        </Button>

        {/* Saved filter quick-buttons */}
        <div className="flex flex-wrap items-center gap-1.5 border-l border-border pl-2 ml-1">
          {SAVED_FILTERS.map((sf) => {
            const active = isSavedActive(sf);
            return (
              <Button
                key={sf.label}
                variant="outline"
                size="sm"
                onClick={() => toggleSavedFilter(sf)}
                className={cn(
                  'h-8 text-xs border-border transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                    : 'bg-secondary text-foreground hover:bg-muted'
                )}
              >
                {sf.label}
              </Button>
            );
          })}
        </div>

        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Filter rows */}
      {localFilters.length > 0 && (
        <div className="space-y-1.5">
          {localFilters.map((f, index) => {
            const colType = getColType(f.column);
            const operators = OPERATORS[colType];
            const needsValue = !NO_VALUE_OPS.includes(f.operator);

            return (
              <div
                key={f.id}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5"
              >
                {/* Where label */}
                <span className="text-xs text-muted-foreground font-medium shrink-0">
                  {index === 0 ? 'Where' : 'and'}
                </span>

                {/* Column selector */}
                <select
                  value={f.column}
                  onChange={(e) => updateFilter(index, { column: e.target.value })}
                  className="h-7 rounded border border-border bg-secondary px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
                >
                  {ALL_COLUMNS.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>

                {/* Operator selector */}
                <select
                  value={f.operator}
                  onChange={(e) => updateFilter(index, { operator: e.target.value })}
                  className="h-7 rounded border border-border bg-secondary px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[100px]"
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                {/* Value input */}
                {needsValue && (
                  <FilterValueInput
                    column={f.column}
                    colType={colType}
                    operator={f.operator}
                    value={f.value}
                    onChange={(val) => updateFilter(index, { value: val })}
                  />
                )}

                {/* Remove */}
                <button
                  onClick={() => removeFilter(index)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Value input sub-component ──

function FilterValueInput({
  column,
  colType,
  operator,
  value,
  onChange,
}: {
  column: string;
  colType: ColType;
  operator: string;
  value: string;
  onChange: (val: string) => void;
}) {
  if (colType === 'enum') {
    const options = ENUM_OPTIONS[column] ?? [];
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded border border-border bg-secondary px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (colType === 'date') {
    if (operator === 'is_between') {
      const [startStr = '', endStr = ''] = value.split('|');
      const startDate = startStr ? new Date(startStr) : undefined;
      const endDate = endStr ? new Date(endStr) : undefined;
      const setRange = (s: string, e: string) => onChange(s || e ? `${s}|${e}` : '');
      return (
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'h-7 rounded border border-border bg-secondary px-2 text-xs text-left min-w-[120px] focus:outline-none focus:ring-1 focus:ring-ring',
                  !startStr && 'text-muted-foreground'
                )}
              >
                {startStr ? format(new Date(startStr), 'dd MMM yyyy') : 'Start date'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => setRange(d ? format(d, 'yyyy-MM-dd') : '', endStr)}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'h-7 rounded border border-border bg-secondary px-2 text-xs text-left min-w-[120px] focus:outline-none focus:ring-1 focus:ring-ring',
                  !endStr && 'text-muted-foreground'
                )}
              >
                {endStr ? format(new Date(endStr), 'dd MMM yyyy') : 'End date'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => setRange(startStr, d ? format(d, 'yyyy-MM-dd') : '')}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    const dateValue = value ? new Date(value) : undefined;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'h-7 rounded border border-border bg-secondary px-2 text-xs text-left min-w-[140px] focus:outline-none focus:ring-1 focus:ring-ring',
              !value && 'text-muted-foreground'
            )}
          >
            {value ? format(new Date(value), 'dd MMM yyyy') : 'Pick date...'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    );
  }
  // Text
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter value..."
      className="h-7 rounded border border-border bg-secondary px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px] flex-1"
    />
  );
}
