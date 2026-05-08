import React from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { Mic, PenTool } from 'lucide-react';

export default function Home() {
  return (
    <PageShell size="medium">
      <TopBar />
      <div className="landing-workspace landing-workspace--centered">
        <div className="text-center mb-8">
          <h1 className="text-4xl text-paper-ink tracking-tighter">IELTS Scholar</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6 w-full">
          <Link to="/speaking" className="group">
            <PaperCard className="h-full hover:border-accent-terracotta/40 hover:bg-paper-50/80 transition-all cursor-pointer flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-accent-terracotta/10 flex items-center justify-center mb-5 text-accent-terracotta group-hover:scale-110 transition-transform">
                <Mic className="w-7 h-7" />
              </div>
              <h2 className="text-2xl">Speaking</h2>
            </PaperCard>
          </Link>

          <Link to="/writing" className="group">
            <PaperCard className="h-full hover:border-accent-terracotta/40 hover:bg-paper-50/80 transition-all cursor-pointer flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-accent-terracotta/10 flex items-center justify-center mb-5 text-accent-terracotta group-hover:scale-110 transition-transform">
                <PenTool className="w-7 h-7" />
              </div>
              <h2 className="text-2xl">Writing</h2>
            </PaperCard>
          </Link>
        </div>

      </div>
    </PageShell>
  );
}
