import React from 'react';
import { cn } from '@/lib/utils';
import {
  DueState,
  MachineStatus,
  MaintenanceStatus,
  PartLifeState,
  RepairStatus,
} from '@/lib/types';

interface StatusBadgeProps {
  status: MachineStatus | MaintenanceStatus | RepairStatus | PartLifeState | DueState;
  className?: string;
}

// Light-mode tints were previously written as `bg-emerald-100/15` and friends: 15%
// of an already-pale 100-step colour renders as effectively white, so every badge
// read as plain text on a white card. These are solid 50-step tints with a matching
// 200-step border, which keeps the restrained industrial palette but makes the
// status legible at a glance. Dark mode already worked and is unchanged.
export function StatusBadge({ status, className }: StatusBadgeProps) {
  let colorClass =
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700';
  const partLabels: Partial<Record<string, string>> = {
    ok: 'In service',
    due_soon: 'Due soon',
    unknown: 'No life set',
    not_applicable: 'N/A',
  };
  let label = partLabels[status] ?? status.replace(/_/g, ' ');

  switch (status) {
    case 'active':
    case 'completed':
    case 'ok':
      colorClass =
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900';
      break;
    case 'inactive':
    case 'cancelled':
    case 'retired':
    case 'unknown':
    case 'not_applicable':
      colorClass =
        'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700';
      break;
    case 'under_maintenance':
    case 'in_progress':
    case 'scheduled':
      colorClass =
        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900';
      break;
    case 'under_repair':
    case 'reported':
    case 'waiting_for_parts':
    case 'due_soon':
      colorClass =
        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900';
      break;
    case 'overdue':
      colorClass =
        'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900';
      break;
  }

  // Sentence case, not title case.
  //
  // This used to capitalise every word, so a badge announced "Waiting For Parts" while
  // `repair-record.ts` defined the label "Waiting for parts" — one status with two
  // spellings depending on which component rendered it. Sentence case is the convention
  // the label maps in `repair-record.ts` and `maintenance-record.ts`,
  // and `MachineForm.tsx` now all follow.
  label = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
