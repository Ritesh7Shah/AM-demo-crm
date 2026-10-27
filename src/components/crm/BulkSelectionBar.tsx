import { CheckSquare2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BulkSelectionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function BulkSelectionBar({ selectedCount, onClear, onDelete, isDeleting = false }: BulkSelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-sm font-medium text-foreground">
          <CheckSquare2 className="h-4 w-4 text-primary" />
          <span>{selectedCount} lead{selectedCount === 1 ? '' : 's'} selected</span>
        </div>

        <Button variant="outline" size="sm" onClick={onClear}>
          <X className="h-4 w-4" />
          Deselect All
        </Button>

        <Button variant="destructive" size="sm" onClick={onDelete} disabled={isDeleting}>
          <Trash2 className="h-4 w-4" />
          Delete Selected
        </Button>
      </div>
    </div>
  );
}
