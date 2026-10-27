import { format, parseISO } from 'date-fns';
import { getColumnType } from '@/lib/columns';
import { useCRMStore } from '@/store/crmStore';
import { useBoostySchema } from '@/hooks/useBoostySchema';
import { normalizeColumnType, type BoostySchemaColumnType } from '@/lib/boostySchema';

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

function resolveColumnType(
  column: string,
  enumColumns: Record<string, string[]>,
  columnTypes: Record<string, BoostySchemaColumnType>
): "enum" | "date" | "integer" | "text" | "link" | "checkbox" {
  const dynType = normalizeColumnType(column, columnTypes[column], enumColumns);
  if (dynType === 'dropdown') return 'enum';
  if (dynType === 'checkbox') return 'checkbox';
  if (dynType === 'date') return 'date';
  if (dynType === 'number') return 'integer';
  return getColumnType(column);
}

interface CellRendererProps {
  column: string;
  value: any;
  rowId?: number;
}

export function CellRenderer({ column, value, rowId }: CellRendererProps) {
  const { enumColumns, columnTypes } = useBoostySchema();
  const _rowId = rowId; // kept for API compatibility

  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40">—</span>;
  }

  // Status badge
  if (column === 'status') {
    const cls = STATUS_COLORS[value] ?? 'bg-gray-100 text-gray-600';
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-medium ${cls}`}>{value}</span>;
  }

  // Assigned to badge
  if (column === 'assigned_to') {
    const cls = ASSIGNED_TO_COLORS[value] ?? 'bg-gray-100 text-gray-500';
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-medium ${cls}`}>{value}</span>;
  }

  const colType = resolveColumnType(column, enumColumns, columnTypes);

  // Boolean / checkbox
  if (colType === 'checkbox' || column === 'backoffice' || column === 'live') {
    const boolVal = value === true || value === 'true';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-medium ${
        boolVal ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
      }`}>
        {boolVal ? 'Yes' : 'No'}
      </span>
    );
  }

  // Date formatting
  if (colType === 'date' && value) {
    try {
      const withTime = column === 'created_at' || column === 'updated_at';
      return <span className="text-xs">{format(parseISO(value), withTime ? 'dd MMM yyyy HH:mm' : 'dd MMM yyyy')}</span>;
    } catch {
      return <span>{value}</span>;
    }
  }

  // Inbox link — clickable
  if (column === 'inbox_link' && value) {
    return (
      <a
        href={String(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
        title={String(value)}
      >
        Link
      </a>
    );
  }

  // Name — bold
  if (column === 'name') {
    return <span className="font-semibold">{value}</span>;
  }

  return <span>{String(value)}</span>;
}
