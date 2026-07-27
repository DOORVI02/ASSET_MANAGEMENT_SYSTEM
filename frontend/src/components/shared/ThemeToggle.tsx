import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ThemePreference } from '@/lib/theme-storage';

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

interface ThemeToggleProps {
  className?: string;
  /**
   * `menu` offers all three preferences including System, for the app header.
   * `button` is a plain light/dark flip for the auth pages, which sit outside the
   * shell and only need the one control.
   */
  variant?: 'menu' | 'button';
}

export function ThemeToggle({ className, variant = 'menu' }: ThemeToggleProps) {
  const { preference, resolved, setPreference, toggle } = useTheme();

  const triggerClasses = cn(
    'rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className,
  );

  // The icon shows what is currently rendered, not what was chosen: under `system`
  // a moon means "it is dark right now", which is the thing the user can see.
  const CurrentIcon = resolved === 'dark' ? Moon : Sun;

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggle}
        className={triggerClasses}
        aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
        title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
      >
        <CurrentIcon size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClasses}
          aria-label={`Theme: ${preference}. Change theme`}
          title="Change theme"
        >
          <CurrentIcon size={20} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setPreference(option.value)}
            className="cursor-pointer"
            // `aria-checked` alone is not valid on a plain menuitem; the radio role
            // is what makes "one of three" announce correctly.
            role="menuitemradio"
            aria-checked={preference === option.value}
          >
            <option.icon className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{option.label}</span>
            {preference === option.value && (
              <span aria-hidden="true" className="ml-auto text-xs text-muted-foreground">
                ✓
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
