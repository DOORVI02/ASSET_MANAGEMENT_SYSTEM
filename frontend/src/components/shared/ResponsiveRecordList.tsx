import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveRecordListProps {
  /** Desktop presentation. Pass the `<table>` itself; the scroll and border shell is supplied. */
  table: ReactNode;
  /**
   * Mobile presentation, normally a list of linked cards.
   *
   * Omit it only for a narrow table that stays readable on a phone by scrolling — the
   * maintenance *plans* table is the one such case. Every record list that a user
   * browses should provide cards.
   */
  cards?: ReactNode;
  /**
   * When true nothing renders, so the page's `EmptyState` stands alone rather than
   * sitting under an empty bordered box.
   */
  isEmpty?: boolean;
  className?: string;
}

/**
 * The single responsive list layout for every record page.
 *
 * Before this existed, machines, parts, and maintenance used
 * `hidden lg:block` + `overflow-x-auto` while repairs used a stricter
 * `hidden md:block` + `md:hidden` with no horizontal scroll and no `bg-card`. That meant
 * repairs switched to cards at a different width from every other list and its wide
 * table clipped instead of scrolling. Phase 7 asks for one standard; this is it, and
 * the majority `lg` breakpoint won because a six-column table is unreadable on a tablet.
 */
export function ResponsiveRecordList({
  table,
  cards,
  isEmpty = false,
  className,
}: ResponsiveRecordListProps) {
  if (isEmpty) return null;

  return (
    <div className={className}>
      <div
        className={cn(
          'overflow-hidden rounded-lg border bg-card shadow-sm',
          // Only hide the table on small screens when there is a card view to replace it.
          cards !== undefined && 'hidden lg:block',
        )}
      >
        <div className="custom-scrollbar overflow-x-auto">{table}</div>
      </div>
      {cards !== undefined ? <div className="space-y-4 lg:hidden">{cards}</div> : null}
    </div>
  );
}
