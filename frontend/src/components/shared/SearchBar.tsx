import React from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
  className?: string;
}

export function SearchBar({ onSearch, className, ...props }: SearchBarProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.onChange) {
      props.onChange(e);
    }
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  return (
    <div className={cn('relative w-full max-w-sm', className)}>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search..."
        className="pl-9 bg-card border-border"
        onChange={handleChange}
        {...props}
      />
    </div>
  );
}
