export const ENUM_COLUMNS: Record<string, string[]> = {
  status: ['new', 'outreach_1', 'outreach_2', 'outreach_3', 'outreach_4', 'outreach_5', 'live', 'quit'],
  assigned_to: ['bot', 'Human_AccountExists', 'Human_DepositMade', 'Human_General', 'Human_Manually', 'Human_Trash'],
};

export const DATE_COLUMNS = [
  'first_contact_date',
  'next_contact_date',
  'ftd_date_mentioned',
  'ftd_date_actual',
  'created_at',
  'updated_at',
];

export const INTEGER_COLUMNS = ['id'];

export const READONLY_COLUMNS = ['id', 'contact_id', 'created_at', 'updated_at', 'first_contact_date'];

export const HIDDEN_INTERNAL_COLUMNS: string[] = [];

export const LINK_COLUMNS: string[] = [];

export const DEFAULT_COLUMN_ORDER = [
  'id',
  'name',
  'contact_id',
  'status',
  'assigned_to',
  'backoffice',
  'live',
  'first_contact_date',
  'next_contact_date',
  'ftd_date_mentioned',
  'ftd_date_actual',
  'created_at',
  'updated_at',
];

export function getColumnType(col: string): 'enum' | 'date' | 'integer' | 'text' | 'link' {
  if (ENUM_COLUMNS[col]) return 'enum';
  if (DATE_COLUMNS.includes(col)) return 'date';
  if (INTEGER_COLUMNS.includes(col)) return 'integer';
  if (LINK_COLUMNS.includes(col)) return 'link';
  return 'text';
}

export function getStatusBadgeClass(value: string | null): string {
  if (!value) return '';
  const map: Record<string, string> = {
    new: 'badge-gray',
    outreach_1: 'badge-blue',
    outreach_2: 'badge-purple',
    outreach_3: 'badge-amber',
    outreach_4: 'badge-orange',
    outreach_5: 'badge-red',
    live: 'badge-green',
    quit: 'badge-gray',
  };
  return map[value] ?? '';
}

export function getAssignedToBadgeClass(value: string | null): string {
  if (!value) return '';
  if (value === 'bot') return 'badge-blue';
  if (value === 'Human_AccountExists') return 'badge-teal';
  if (value === 'Human_DepositMade') return 'badge-green';
  if (value === 'Human_Trash') return 'badge-gray';
  return '';
}

export function getBooleanBadgeClass(value: boolean | null): string {
  return value ? 'badge-green' : 'badge-gray';
}
