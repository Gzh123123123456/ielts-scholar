import React from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';

export default function WritingTask2Mock() {
  return (
    <PageShell>
      <TopBar />
      <PaperCard className="text-center py-20">
        <h2 className="text-2xl mb-4">Writing Task 2 Mock Exam</h2>
        <p className="text-paper-ink/65 mb-8">Planned for V2 (Claude Code implementation phase)</p>
        <div className="max-w-md mx-auto text-left space-y-4 text-sm font-sans opacity-80 border-t border-paper-ink/10 pt-8">
          <p className="font-bold uppercase tracking-widest text-accent-terracotta">Mock Mode Behavior Design:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>40-minute strict timer.</li>
            <li>Full screen focus mode (recommended).</li>
            <li>No framework discussion or AI coaching.</li>
            <li>Structured feedback and band score only after submission.</li>
          </ul>
        </div>
      </PaperCard>
    </PageShell>
  );
}
