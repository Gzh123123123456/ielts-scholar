import React from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { Mic, PenTool, ArrowRight, History } from 'lucide-react';

export default function Home() {
  return (
    <PageShell size="wide">
      <TopBar />
      <div className="landing-workspace">
        <div className="text-center mb-12 mt-6">
          <h1 className="text-5xl mb-3 text-paper-ink tracking-tighter">IELTS Scholar</h1>
          <p className="text-paper-ink-muted italic font-serif opacity-60">
            Local IELTS practice for Speaking and Writing.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full">
          <Link to="/speaking" className="group">
            <PaperCard className="h-full hover:border-accent-terracotta/40 hover:bg-paper-50/80 transition-all cursor-pointer flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-terracotta/10 flex items-center justify-center mb-6 text-accent-terracotta group-hover:scale-110 transition-transform">
                <Mic className="w-8 h-8" />
              </div>
              <h2 className="text-2xl mb-2">Speaking</h2>
              <p className="text-sm text-paper-ink/50 px-8">
                Practice Part 1, Part 2, and Part 3 with structured feedback.
              </p>
            </PaperCard>
          </Link>

          <Link to="/writing" className="group">
            <PaperCard className="h-full hover:border-accent-terracotta/40 hover:bg-paper-50/80 transition-all cursor-pointer flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-terracotta/10 flex items-center justify-center mb-6 text-accent-terracotta group-hover:scale-110 transition-transform">
                <PenTool className="w-8 h-8" />
              </div>
              <h2 className="text-2xl mb-2">Writing</h2>
              <p className="text-sm text-paper-ink/50 px-8">
                Train Academic Task 1 reports and Task 2 essays.
              </p>
            </PaperCard>
          </Link>
        </div>

        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link to="/practice-history" className="flex items-center gap-2 text-paper-ink/50 hover:text-accent-terracotta transition-colors group text-sm italic">
            Practice history <History className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/progress" className="flex items-center gap-2 text-paper-ink/40 hover:text-accent-terracotta transition-colors group text-sm italic">
            View your progress <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
