import React from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';

export default function SpeakingMock() {
  return (
    <PageShell>
      <TopBar />
      <PaperCard className="text-center py-20">
        <h2 className="text-2xl mb-4">Speaking Mock Exam</h2>
        <p className="text-paper-ink/65 mb-8">Planned for V2 (Claude Code implementation phase)</p>
        <div className="max-w-md mx-auto text-left space-y-4 text-sm font-sans opacity-80 border-t border-paper-ink/10 pt-8">
          <p className="font-bold uppercase tracking-widest text-accent-terracotta">Mock Mode Behavior Design:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Strict timers matching official IELTS standards.</li>
            <li>No transcript editing allowed.</li>
            <li>No coaching panel or feedback during the exam.</li>
            <li>Part 1 (3 questions) → Part 2 (1 question, 1 min prep) → Part 3 (3 questions).</li>
            <li>Comprehensive report and score generated only after completion.</li>
          </ul>
        </div>
      </PaperCard>
    </PageShell>
  );
}
