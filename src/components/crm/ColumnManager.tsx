import { useCRMStore } from '@/store/crmStore';
import { DEFAULT_COLUMN_ORDER } from '@/lib/columns';
import { Columns, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function ColumnManager({ allColumns }: { allColumns: string[] }) {
  const { hiddenColumns, toggleColumnVisibility } = useCRMStore();

  const columns = allColumns.length > 0 ? allColumns : DEFAULT_COLUMN_ORDER;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1 h-8">
          <Columns className="h-3.5 w-3.5" /> Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 max-h-80 overflow-y-auto" align="end">
        {columns.map((col) => {
          const visible = !hiddenColumns.includes(col);
          return (
            <button
              key={col}
              onClick={() => toggleColumnVisibility(col)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${visible ? 'bg-primary border-primary' : 'border-border'}`}>
                {visible && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </span>
              <span className="truncate">{col}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
