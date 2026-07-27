import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border bg-card/50 p-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground" role="status">
        {label}
      </p>
    </div>
  );
}
