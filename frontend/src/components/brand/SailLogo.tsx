import React from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';

interface SailLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /**
   * Overrides the theme-based pick below — for a surface that's always dark
   * regardless of the site theme (the sidebar, the login page's branding panel),
   * where the white logo is the only one that's ever legible.
   */
  src?: string;
}

const LIGHT_LOGO = '/sail_logo.avif';
const DARK_LOGO = '/sail-logo-wt.avif';

export function SailLogo({ size = 'md', className, src }: SailLogoProps) {
  const { resolved } = useTheme();
  const resolvedSrc = src ?? (resolved === 'dark' ? DARK_LOGO : LIGHT_LOGO);
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center', sizeClasses[size], className)}>
      <img
        src={resolvedSrc}
        alt="SAIL Logo"
        className="w-full h-full object-contain drop-shadow-md"
      />
      {size === 'lg' && (
        <span className="text-[#4B8BBE] text-[8px] font-semibold uppercase tracking-widest mt-2 text-center leading-tight">
          Steel Authority
          <br />
          of India Limited
        </span>
      )}
    </div>
  );
}
