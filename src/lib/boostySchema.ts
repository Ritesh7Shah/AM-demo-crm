export type BoostyColumnType = 'text' | 'number' | 'date' | 'checkbox' | 'dropdown';
export type BoostySchemaColumnType =
  | BoostyColumnType
  | 'numeric'
  | 'integer'
  | 'float'
  | 'int4'
  | 'int8'
  | 'float8'
  | 'boolean'
  | 'bool'
  | 'timestamp'
  | 'timestamptz';

export const STATIC_ENUM_COLUMNS: Record<string, string[]> = {
  status: ['new', 'outreach_1', 'outreach_2', 'outreach_3', 'outreach_4', 'outreach_5', 'live', 'quit'],
  assigned_to: ['bot', 'Human_AccountExists', 'Human_DepositMade', 'Human_General', 'Human_Manually', 'Human_Trash'],
};

export const STATIC_UI_ENUM_COLUMNS: Record<string, string[]> = {
  ...STATIC_ENUM_COLUMNS,
};

export const STATIC_COLUMN_TYPES: Record<string, BoostyColumnType> = {
  id: 'number',
  first_contact_date: 'date',
  next_contact_date: 'date',
  ftd_date_mentioned: 'date',
  ftd_date_actual: 'date',
  created_at: 'date',
  updated_at: 'date',
  backoffice: 'checkbox',
  live: 'checkbox',
  status: 'dropdown',
  assigned_to: 'dropdown',
};

const NUMBER_COLUMN_TYPES = new Set(['number', 'numeric', 'integer', 'float', 'int4', 'int8', 'float8']);
const BOOLEAN_COLUMN_TYPES = new Set(['checkbox', 'boolean', 'bool']);
const DATE_COLUMN_TYPES = new Set(['date', 'timestamp', 'timestamptz']);

export function normalizeColumnType(
  column: string,
  columnType: BoostySchemaColumnType | undefined,
  enumColumns: Record<string, string[]> = {}
): BoostyColumnType {
  if ((enumColumns[column] ?? []).length > 0) return 'dropdown';

  const normalized = String(columnType ?? 'text').toLowerCase();

  if (NUMBER_COLUMN_TYPES.has(normalized)) return 'number';
  if (BOOLEAN_COLUMN_TYPES.has(normalized)) return 'checkbox';
  if (DATE_COLUMN_TYPES.has(normalized)) return 'date';
  if (normalized === 'dropdown') return 'dropdown';

  return 'text';
}

export function getBootstrappedEnumColumns() {
  return { ...STATIC_UI_ENUM_COLUMNS };
}

export function mergeEnumColumns(dynamicEnumColumns?: Record<string, string[]>) {
  return {
    ...STATIC_UI_ENUM_COLUMNS,
    ...(dynamicEnumColumns ?? {}),
  };
}

export function mergeColumnTypes(
  dynamicColumnTypes?: Record<string, BoostySchemaColumnType>,
  enumColumns: Record<string, string[]> = getBootstrappedEnumColumns()
) {
  const normalizedDynamicTypes = Object.fromEntries(
    Object.entries(dynamicColumnTypes ?? {}).map(([column, type]) => [
      column,
      normalizeColumnType(column, type, enumColumns),
    ])
  ) as Record<string, BoostyColumnType>;

  return {
    ...STATIC_COLUMN_TYPES,
    ...normalizedDynamicTypes,
  };
}

export function getBootstrappedSchema() {
  const enumColumns = getBootstrappedEnumColumns();

  return {
    enumColumns,
    columnTypes: mergeColumnTypes(undefined, enumColumns),
  };
}
