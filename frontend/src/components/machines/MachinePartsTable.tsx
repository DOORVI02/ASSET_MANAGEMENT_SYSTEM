import { Link } from 'wouter';
import { Package } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { partLifeState, replacementDueDate } from '@/lib/part-life';
import { formatDate } from '@/lib/utils';
import { partDetailPath } from '@/lib/routes';
import type { MachinePart } from '@/lib/types';

interface MachinePartsTableProps {
  parts: MachinePart[];
  machineCode: string;
}

/**
 * Components fitted to one machine, shown on the machine detail Parts tab.
 *
 * This is the same installed-part representation the `/parts` page uses, so the two
 * cannot drift: both derive replacement state from `fittedDate` plus
 * `expectedLifeMonths` rather than storing it.
 */
export function MachinePartsTable({ parts, machineCode }: MachinePartsTableProps) {
  if (parts.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No parts linked to this machine"
        description={`No installed components are recorded against ${machineCode} yet.`}
      />
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border bg-card lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">Components installed on machine {machineCode}</caption>
            <thead className="bg-muted/30">
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-3">
                  Part code
                </th>
                <th scope="col" className="px-4 py-3">
                  Part name
                </th>
                <th scope="col" className="px-4 py-3">
                  Category
                </th>
                <th scope="col" className="px-4 py-3">
                  Position
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Qty
                </th>
                <th scope="col" className="px-4 py-3">
                  Fitted
                </th>
                <th scope="col" className="px-4 py-3">
                  Replacement
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {parts.map((part) => {
                const due = replacementDueDate(part);
                return (
                  <tr key={part.id} className="transition-colors hover:bg-muted/10">
                    <td className="px-4 py-3 font-mono text-sm font-semibold">
                      <Link href={partDetailPath(part.id)} className="text-primary hover:underline">
                        {part.partCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">{part.partName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{part.category}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {part.positionOnMachine}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {part.quantity} {part.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(part.fittedDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={partLifeState(part)} />
                        {due ? (
                          <span className="text-xs text-muted-foreground">
                            due {formatDate(due)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-4 lg:hidden">
        {parts.map((part) => (
          <div key={part.id} className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={partDetailPath(part.id)}
                  className="font-mono text-sm font-bold text-primary hover:underline"
                >
                  {part.partCode}
                </Link>
                <p className="mt-1 font-medium">{part.partName}</p>
              </div>
              <StatusBadge status={partLifeState(part)} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{part.category}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Quantity</dt>
                <dd className="font-medium">
                  {part.quantity} {part.unit}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Position</dt>
                <dd className="font-medium">{part.positionOnMachine}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Fitted</dt>
                <dd className="font-medium">{formatDate(part.fittedDate)}</dd>
              </div>
            </dl>
            {part.notes ? (
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{part.notes}</p>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
