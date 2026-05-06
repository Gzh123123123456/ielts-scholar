import React from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';

export default function WritingTask1Placeholder() {
  return (
    <PageShell>
      <TopBar />
      <PaperCard className="text-center py-20">
        <h2 className="text-2xl mb-4">Writing Task 1 (Academic/GT)</h2>
        <p className="text-paper-ink/60 italic mb-8">Planned for V3 (Claude Code implementation phase)</p>
        <div className="max-w-md mx-auto text-left space-y-4 text-sm font-sans opacity-80 border-t border-paper-ink/10 pt-8">
          <p className="font-bold uppercase tracking-widest text-accent-terracotta">V3 Features Plan:</p>
          <ul className="list-disc list-inside space-y-2 italic">
            <li>Dynamic chart rendering with Recharts.</li>
            <li>Task 1 Academic: Line graphs, Bar charts, Pie charts, Tables, Processes.</li>
            <li>General Training: Letter writing prompts.</li>
            <li>Vocabulary focus: describing trends, comparison, and formal tone.</li>
          </ul>
        </div>
      </PaperCard>
    </PageShell>
  );
}
