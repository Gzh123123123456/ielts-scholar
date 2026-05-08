import React from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { Link } from 'react-router-dom';

export default function Writing() {
  return (
    <PageShell size="medium">
      <TopBar />
      <div className="landing-workspace landing-workspace--centered">
        <div>
          <section>
            <h2 className="text-xl font-serif mb-4">Writing Modules</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Link to="/writing/task1">
                <PaperCard className="hover:border-accent-terracotta/30 transition-all cursor-pointer group">
                  <h3 className="text-lg mb-2">Task 1: Academic Visual Report</h3>
                  <p className="text-sm text-paper-ink/65 leading-7">
                    Summarize text-based charts, tables, processes, and maps. 150+ words.
                  </p>
                  <div className="mt-4 text-[10px] uppercase font-sans tracking-widest text-paper-ink/40">
                    Academic practice
                  </div>
                </PaperCard>
              </Link>

              <Link to="/writing/task2/practice">
                <PaperCard className="hover:border-accent-terracotta/30 transition-all cursor-pointer group mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg">Task 2: Academic Essay</h3>
                    <span className="text-[10px] uppercase font-sans tracking-widest text-accent-terracotta font-bold">Higher weight / Recommended</span>
                  </div>
                  <p className="text-sm text-paper-ink/65 mb-4 leading-7">
                    Discuss views, argue a point, or propose solutions. 250+ words.
                  </p>
                  <div className="text-xs font-sans text-paper-ink/40 uppercase tracking-widest">
                    Framework & essay practice
                  </div>
                </PaperCard>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
