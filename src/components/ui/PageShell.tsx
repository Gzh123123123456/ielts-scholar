/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '@/src/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export const PageShell: React.FC<PageShellProps> = ({ children, className }) => {
  return (
    <div className={cn("min-h-screen flex flex-col max-w-6xl mx-auto px-4 py-8 md:px-8", className)}>
      {children}
    </div>
  );
};
