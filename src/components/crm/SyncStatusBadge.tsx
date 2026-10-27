import { useCRMStore } from '@/store/crmStore';

export function SyncStatusBadge() {
  const status = useCRMStore((s) => s.syncStatus);

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-2 w-2 rounded-full ${
          status === 'live' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
        }`}
      />
      <span className={status === 'live' ? 'text-green-700' : 'text-amber-700'}>
        {status === 'live' ? 'Live' : 'Reconnecting...'}
      </span>
    </div>
  );
}
