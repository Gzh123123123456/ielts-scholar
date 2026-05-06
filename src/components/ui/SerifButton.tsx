import React from 'react';
import { cn } from '@/src/lib/utils';

interface SerifButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const SerifButton: React.FC<SerifButtonProps> = ({ 
  children, 
  className, 
  variant = 'primary',
  ...props 
}) => {
  const variants = {
    primary: 'accent-button',
    secondary: 'bg-paper-ink text-paper-50 hover:bg-paper-ink/80 p-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
    outline: 'border border-accent-terracotta text-accent-terracotta hover:bg-accent-terracotta/5 px-4 py-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  };

  return (
    <button
      className={cn(variants[variant], "font-serif transition-all duration-200 active:scale-[0.98] disabled:active:scale-100", className)}
      {...props}
    >
      {children}
    </button>
  );
};
