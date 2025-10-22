'use client';

import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  fullPage?: boolean;
  message?: string;
  size?: SpinnerSize;
  className?: string;
}

export function LoadingSpinner({ fullPage = false, message, size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClass = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const skeletonWidth = size === 'sm' ? 'w-16' : size === 'lg' ? 'w-32' : 'w-24';
  const container = fullPage ? 'min-h-screen flex items-center justify-center p-8' : 'p-8 flex items-center justify-center';

  return (
    <div className={`${container} ${className}`.trim()}>
      <div className="flex flex-col items-center gap-3 font-mono">
        <svg className={`animate-spin ${sizeClass}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2C5.373 2 2 5.373 2 12h2zm2 5.291A7.962 7.962 0 014 12H2c0 3.042 1.135 5.824 3 7.938l1-2.647z"></path>
        </svg>
        <div className={`h-px ${skeletonWidth} bg-foreground animate-pulse`} aria-hidden="true"></div>
        {message && <p className="text-xs uppercase tracking-wider opacity-60">{message}</p>}
        <span className="sr-only">{message || 'Loading'}</span>
      </div>
    </div>
  );
}

export default LoadingSpinner;


