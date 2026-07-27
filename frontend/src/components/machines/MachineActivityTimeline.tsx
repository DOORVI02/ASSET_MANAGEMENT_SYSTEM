import { History } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog, UserProfile } from '@/lib/types';

interface MachineActivityTimelineProps {
  events: AuditLog[];
  /** Resolves `performedBy` actor IDs to display names. */
  users: UserProfile[];
}

const actionLabels: Record<string, string> = {
  created: 'Machine created',
  updated: 'Machine details updated',
  archived: 'Machine archived',
  restored: 'Machine restored',
  status_changed: 'Status changed',
  image_added: 'Image added',
  image_removed: 'Image removed',
  main_image_changed: 'Main image changed',
  gallery_reordered: 'Gallery reordered',
};

const actionAccents: Record<string, string> = {
  created: 'bg-emerald-500',
  updated: 'bg-primary',
  archived: 'bg-muted-foreground',
  restored: 'bg-emerald-500',
  status_changed: 'bg-blue-500',
  image_added: 'bg-blue-500',
  image_removed: 'bg-amber-500',
  main_image_changed: 'bg-blue-500',
  gallery_reordered: 'bg-blue-500',
};

function humanizeAction(action: string): string {
  return (
    actionLabels[action] ??
    action.replace(/_/g, ' ').replace(/^\w/, (character) => character.toUpperCase())
  );
}

/** Audit timeline for one machine, driven by typed repository events. */
export function MachineActivityTimeline({ events, users }: MachineActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No recorded activity"
        description="Changes made to this machine during the preview session appear here."
      />
    );
  }

  const nameFor = (actorId: string): string =>
    users.find((user) => user.id === actorId)?.name ?? 'System';

  return (
    <div className="rounded-lg border bg-card p-5">
      <ol className="space-y-5">
        {events.map((event) => (
          <li key={event.id} className="flex items-start gap-3">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                actionAccents[event.action] ?? 'bg-muted-foreground'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{humanizeAction(event.action)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{event.changes}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                by {nameFor(event.performedBy)} ·{' '}
                <time dateTime={event.performedAt}>{formatDateTime(event.performedAt)}</time>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
