import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PaperCard } from '@/src/components/ui/PaperCard';
import type { CoverageGroup, CoverageKind } from '@/src/lib/progressAnalytics';

const options: { key: CoverageKind; label: string }[] = [
  { key: 'speaking', label: 'Speaking' },
  { key: 'writingTask1', label: 'Task 1' },
  { key: 'writingTask2', label: 'Task 2' },
];

export const CoverageChart: React.FC<{
  groups: Record<CoverageKind, CoverageGroup>;
  initialKind?: CoverageKind;
}> = ({ groups, initialKind = 'speaking' }) => {
  const [kind, setKind] = useState<CoverageKind>(initialKind);
  const group = groups[kind];
  const height = Math.max(330, group.data.length * 34);
  const max = Math.max(1, ...group.data.map(item => item.attempts));

  return (
    <PaperCard className="overflow-hidden">
      <div data-testid="practice-coverage-chart" aria-labelledby="practice-coverage-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="practice-coverage-heading" className="text-sm font-bold uppercase tracking-widest">Practice Coverage</h3>
            <p className="mt-2 text-sm leading-6 text-paper-ink/60">Recorded attempts by preparation category, including zero-count gaps.</p>
          </div>
          <div className="flex border border-paper-ink/10" aria-label="Coverage module">
            {options.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => setKind(option.key)}
                aria-pressed={kind === option.key}
                className={`px-3 py-2 text-[10px] font-sans font-bold uppercase tracking-wider transition-colors ${kind === option.key ? 'bg-paper-ink text-paper-50' : 'text-paper-ink/55 hover:text-accent-terracotta'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs font-sans font-bold uppercase tracking-wider text-accent-terracotta">{group.label}</p>
        <div style={{ height }} className="mt-2 min-w-0" role="img" aria-label={`${group.label} attempt counts`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={group.data} layout="vertical" margin={{ top: 8, right: 34, bottom: 8, left: 8 }} accessibilityLayer>
              <CartesianGrid stroke="#3c2f2f" strokeOpacity={0.07} horizontal={false} />
              <XAxis type="number" domain={[0, Math.max(2, max)]} allowDecimals={false} tick={{ fill: '#5c4f4f', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" width={142} interval={0} tick={{ fill: '#3c2f2f', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#a64d32', fillOpacity: 0.05 }}
                formatter={(value) => [`${Number(value)} attempt${Number(value) === 1 ? '' : 's'}`, 'Recorded']}
                contentStyle={{ background: '#fdfaf6', border: '1px solid rgba(60,47,47,.15)', borderRadius: 0, fontSize: 12 }}
              />
              <Bar dataKey="attempts" name="Attempts" fill="#a64d32" fillOpacity={0.78} minPointSize={2} radius={0}>
                <LabelList dataKey="attempts" position="right" fill="#3c2f2f" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs leading-5 text-paper-ink/45">{group.provenance} These are preparation categories, not an official IELTS syllabus.</p>
      </div>
    </PaperCard>
  );
};
