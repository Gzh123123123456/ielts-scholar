import React, { useState } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { QuestionBankItem, QuestionBankModal } from '@/src/components/practice/QuestionBankModal';
import { writingTask1Academic, writingTask2 } from '@/src/data/questions/bank';
import { useNavigate } from 'react-router-dom';

export default function Writing() {
  const navigate = useNavigate();
  const [openBank, setOpenBank] = useState<'task1' | 'task2' | null>(null);

  const task1Items: QuestionBankItem[] = writingTask1Academic.map(prompt => ({
    id: prompt.id,
    title: prompt.instruction,
    metadata: `${prompt.taskType} · ${prompt.topic}`,
    tags: [prompt.taskType, prompt.topic, ...prompt.tags].filter(Boolean),
    questionText: prompt.instruction,
    module: 'writing_task1',
    task: 'task1',
  }));

  const task2Items: QuestionBankItem[] = writingTask2.map(question => ({
    id: question.id,
    title: question.question,
    metadata: `${question.type}${question.topicCategory ? ` · ${question.topicCategory}` : ''}`,
    tags: [question.type, question.topicCategory, ...(question.tags || [])].filter((value): value is string => Boolean(value)),
    questionText: question.question,
    module: 'writing',
    task: 'task2',
  }));

  return (
    <PageShell size="medium">
      <TopBar />
      <QuestionBankModal
        isOpen={openBank === 'task1'}
        title="Writing Task 1 Bank"
        items={task1Items}
        onClose={() => setOpenBank(null)}
        onSelect={(item) => {
          setOpenBank(null);
          navigate('/writing/task1', { state: { selectedWritingTask1PromptId: item.id } });
        }}
      />
      <QuestionBankModal
        isOpen={openBank === 'task2'}
        title="Writing Task 2 Bank"
        items={task2Items}
        onClose={() => setOpenBank(null)}
        onSelect={(item) => {
          setOpenBank(null);
          navigate('/writing/task2/practice', { state: { selectedWritingTask2QuestionId: item.id } });
        }}
      />
      <div className="landing-workspace landing-workspace--centered">
        <div>
          <section>
            <h2 className="text-xl font-serif mb-4">Writing Modules</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div onClick={() => navigate('/writing/task1')} role="link" tabIndex={0} onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') navigate('/writing/task1');
              }}>
                <PaperCard className="hover:border-accent-terracotta/30 transition-all cursor-pointer group">
                  <h3 className="text-lg mb-2">Task 1: Academic Visual Report</h3>
                  <p className="text-sm text-paper-ink/65 leading-7">
                    Summarize text-based charts, tables, processes, and maps. 150+ words.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[10px] uppercase font-sans tracking-widest text-paper-ink/40">
                      Bank: {writingTask1Academic.length} prompts
                    </span>
                    <SerifButton
                      type="button"
                      variant="outline"
                      className="text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenBank('task1');
                      }}
                    >
                      Browse Bank
                    </SerifButton>
                  </div>
                </PaperCard>
              </div>

              <div onClick={() => navigate('/writing/task2/practice')} role="link" tabIndex={0} onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') navigate('/writing/task2/practice');
              }}>
                <PaperCard className="hover:border-accent-terracotta/30 transition-all cursor-pointer group mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg">Task 2: Academic Essay</h3>
                    <span className="text-[10px] uppercase font-sans tracking-widest text-accent-terracotta font-bold">Higher weight / Recommended</span>
                  </div>
                  <p className="text-sm text-paper-ink/65 mb-4 leading-7">
                    Discuss views, argue a point, or propose solutions. 250+ words.
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[10px] uppercase font-sans tracking-widest text-paper-ink/40">
                      Bank: {writingTask2.length} prompts
                    </span>
                    <SerifButton
                      type="button"
                      variant="outline"
                      className="text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenBank('task2');
                      }}
                    >
                      Browse Bank
                    </SerifButton>
                  </div>
                </PaperCard>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
