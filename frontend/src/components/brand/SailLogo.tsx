import React from 'react';
import { cn } from '@/lib/utils';

interface SailLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  src?: string;
}

export function SailLogo({ size = 'md', className, src = '/sail_logo.avif' }: SailLogoProps) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center', sizeClasses[size], className)}>
      <img src={src} alt="SAIL Logo" className="w-full h-full object-contain drop-shadow-md" />
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
