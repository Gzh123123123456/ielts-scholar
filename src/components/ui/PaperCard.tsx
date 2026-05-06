import React from 'react';
import { cn } from '@/src/lib/utils';

interface PaperCardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const PaperCard: React.FC<PaperCardProps> = ({ children, className, id }) => {
  return (
    <div id={id} className={cn("paper-card", className)}>
      {children}
    </div>
  );
};
