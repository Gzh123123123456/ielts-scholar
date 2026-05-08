/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '@/src/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  size?: 'medium' | 'wide';
}

export const PageShell: React.FC<PageShellProps> = ({ children, className, size = 'medium' }) => {
  return (
    <div className={cn('page-shell', size === 'wide' ? 'page-shell--wide' : 'page-shell--medium', className)}>
      {children}
    </div>
  );
};
