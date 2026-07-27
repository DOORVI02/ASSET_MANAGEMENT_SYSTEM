import type { ReactNode } from 'react';
import { SearchBar } from '@/components/shared/SearchBar';

interface ListToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  summary?: ReactNode;
}

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  summary,
}: ListToolbarProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <SearchBar
        value={searchValue}
        placeholder={searchPlaceholder}
        onSearch={onSearchChange}
        className="max-w-full sm:w-80"
      />
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        {filters}
        {summary}
      </div>
    </div>
  );
}
