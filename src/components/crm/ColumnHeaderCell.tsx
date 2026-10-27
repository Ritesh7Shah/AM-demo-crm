import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';

const SYSTEM_COLUMNS = new Set([
  'id', 'Client name', 'Contact ID', 'Country', 'Lead Source',
  'Lead Status', 'Bot Status', 'Change Agent Status', 'Broker',
  'First qualification date', 'deposit_completed', 'current_stage',
  'Inbox Link', 'Chat Summary', 'QFTD',
  'Send Upsell 1 Message', 'Upsell 1 Status',
  '2QFTD', 'Send Upsell 2 Message', 'Upsell 2 Status',
  '3QFTD', 'Send Upsell 3 Message', 'Upsell 3 Status',
  '4QFTD', 'Send Upsell 4 Message', 'Upsell 4 Status',
  'created_at',
  'Client_Premium',
  'Premium_Clients',
  'Chat_History',
  // Premium section system columns
  'Qualified__CPA', 'Qualified_CPA', 'Closed_By', 'Status',
  'Date_FTD', 'Account_ID', 'First_deposit', 'Net_deposit',
  'Position_count', 'Lot_size', 'First_message', 'Action_done',
  'Date_action', 'Notes',
]);

interface ColumnHeaderCellProps {
  column: string;
}

export function ColumnHeaderCell({ column }: ColumnHeaderCellProps) {
  const { sortBy, toggleSort } = useCRMStore();
  const isSorted = sortBy.column === column;

  const SortIcon = isSorted
    ? sortBy.direction === 'asc' ? ArrowUp : ArrowDown
    : ArrowUpDown;

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
      onClick={() => toggleSort(column)}
    >
      <span>{column}</span>
      <SortIcon className={`h-3 w-3 ${isSorted ? 'text-primary' : 'opacity-40'}`} />
    </button>
  );
}
