import React from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { Mic, PenTool, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <PageShell className="justify-center py-20">
      <div className="text-center mb-16">
        <h1 className="text-5xl mb-4 text-paper-ink tracking-tighter">IELTS Scholar</h1>
        <p className="text-paper-ink-muted italic font-serif opacity-70">
          The quiet, local-first output transformation agent.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full px-4">
        <Link to="/speaking" className="group">
          <PaperCard className="h-full hover:border-accent-terracotta/40 hover:bg-paper-50/80 transition-all cursor-pointer flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-accent-terracotta/10 flex items-center justify-center mb-6 text-accent-terracotta group-hover:scale-110 transition-transform">
              <Mic className="w-8 h-8" />
            </div>
            <h2 className="text-2xl mb-2">Speaking</h2>
            <p className="text-sm text-paper-ink/50 px-8">
              Transform your spoken English into natural, high-band IELTS responses.
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
              Refine your academic essays with structured framework guidance.
            </p>
          </PaperCard>
        </Link>
      </div>

      <div className="mt-16 flex justify-center">
        <Link to="/progress" className="flex items-center gap-2 text-paper-ink/40 hover:text-accent-terracotta transition-colors group text-sm italic">
          View your progress <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </PageShell>
  );
}
