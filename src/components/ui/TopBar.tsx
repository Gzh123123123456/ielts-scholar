import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Mic, PenTool, LayoutDashboard } from 'lucide-react';

export const TopBar: React.FC = () => {
  const location = useLocation();

  const links = [
    { name: 'Home', path: '/', icon: BookOpen },
    { name: 'Speaking', path: '/speaking', icon: Mic },
    { name: 'Writing', path: '/writing', icon: PenTool },
    { name: 'Progress', path: '/progress', icon: LayoutDashboard },
  ];

  return (
    <nav className="flex items-center justify-between mb-12 border-b border-paper-ink/10 pb-4">
      <Link to="/" className="text-xl font-serif font-bold tracking-tight text-paper-ink hover:text-accent-terracotta transition-colors duration-200">
        IELTS Scholar
      </Link>
      <div className="flex gap-6">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`flex items-center gap-2 text-sm font-medium transition-all duration-200 border-b-2 ${
              location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path))
                ? 'text-accent-terracotta border-accent-terracotta'
                : 'text-paper-ink/60 hover:text-paper-ink border-transparent hover:border-paper-ink/20'
            } pb-0.5`}
          >
            <link.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{link.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};
