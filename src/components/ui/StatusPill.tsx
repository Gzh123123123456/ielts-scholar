import React from 'react';
import { cn } from '@/src/lib/utils';

interface StatusPillProps {
  status: 'active' | 'upcoming' | 'completed' | 'fatal';
  label: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label }) => {
  const styles = {
    active: 'bg-accent-terracotta/10 text-accent-terracotta border-accent-terracotta/20',
    upcoming: 'bg-paper-ink/5 text-paper-ink/40 border-paper-ink/10',
    completed: 'bg-green-100 text-green-800 border-green-200',
    fatal: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider",
      styles[status]
    )}>
      {label}
    </span>
  );
};
