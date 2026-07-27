import { CheckCircle2, CircleAlert } from 'lucide-react';
import type { FeedbackMessage as FeedbackMessageModel } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FeedbackMessageProps {
  feedback: FeedbackMessageModel;
  className?: string;
}

export function FeedbackMessage({ feedback, className }: FeedbackMessageProps) {
  const isSuccess = feedback.state === 'success';
  const Icon = isSuccess ? CheckCircle2 : CircleAlert;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-sm',
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
        className,
      )}
      role={isSuccess ? 'status' : 'alert'}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{feedback.title}</p>
        {feedback.description ? <p className="mt-1 opacity-80">{feedback.description}</p> : null}
      </div>
    </div>
  );
}
