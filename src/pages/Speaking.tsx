import React from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { StatusPill } from '@/src/components/ui/StatusPill';
import { History, PlayCircle } from 'lucide-react';

export default function Speaking() {
  return (
    <PageShell size="medium">
      <TopBar />
      
      <div className="landing-workspace landing-workspace--centered">
        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif">Mode Selection</h2>
            </div>
            <div className="space-y-4">
              <Link to="/speaking/practice">
                <PaperCard className="hover:border-accent-terracotta/30 transition-all cursor-pointer group mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent-terracotta/10 text-accent-terracotta rounded">
                        <PlayCircle className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg">Practice Mode</h3>
                    </div>
                    <StatusPill status="active" label="Active" />
                  </div>
                </PaperCard>
              </Link>

              <div className="relative opacity-60">
                <PaperCard className="border-dashed border-paper-ink/20">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-paper-ink/5 text-paper-ink/40 rounded">
                        <History className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg">Mock Exam</h3>
                    </div>
                    <StatusPill status="upcoming" label="V2 Planned" />
                  </div>
                </PaperCard>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-serif mb-4">Parts Covered</h2>
            <div className="space-y-3">
              {[
                { title: 'Part 1: Personal Questions', duration: '4-5 mins' },
                { title: 'Part 2: Long Turn', duration: '3-4 mins' },
                { title: 'Part 3: Discussion', duration: '4-5 mins' },
              ].map((part, i) => (
                <div key={i} className="flex justify-between items-center p-3 border-b border-paper-ink/5">
                  <span className="text-sm">{part.title}</span>
                  <span className="text-xs text-paper-ink/40 font-sans">{part.duration}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
