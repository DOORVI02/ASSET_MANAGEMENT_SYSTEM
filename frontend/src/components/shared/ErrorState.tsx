import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred while loading this data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-red-100 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/50 rounded-lg">
      <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-1">{title}</h3>
      <p className="text-sm text-red-600/80 dark:text-red-400/80 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
