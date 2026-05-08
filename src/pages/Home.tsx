import React from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { Mic, PenTool } from 'lucide-react';

export default function Home() {
  return (
    <PageShell size="wide">
      <TopBar />
      <div className="landing-workspace landing-workspace--centered">
        <div className="text-center mb-10">
          <h1 className="text-5xl text-paper-ink tracking-tighter">IELTS Scholar</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full">
          <Link to="/speaking" className="group">
            <PaperCard className="h-full hover:border-accent-terracotta/40 hover:bg-paper-50/80 transition-all cursor-pointer flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-terracotta/10 flex items-center justify-center mb-6 text-accent-terracotta group-hover:scale-110 transition-transform">
                <Mic className="w-8 h-8" />
              </div>
              <h2 className="text-2xl">Speaking</h2>
            </PaperCard>
          </Link>

          <Link to="/writing" className="group">
            <PaperCard className="h-full hover:border-accent-terracotta/40 hover:bg-paper-50/80 transition-all cursor-pointer flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-terracotta/10 flex items-center justify-center mb-6 text-accent-terracotta group-hover:scale-110 transition-transform">
                <PenTool className="w-8 h-8" />
              </div>
              <h2 className="text-2xl">Writing</h2>
            </PaperCard>
          </Link>
        </div>

      </div>
    </PageShell>
  );
}
