import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PaperCard } from '@/src/components/ui/PaperCard';
import type { CriterionProfile, CriterionProfileKind } from '@/src/lib/progressAnalytics';

const options: { key: CriterionProfileKind; label: string }[] = [
  { key: 'speaking', label: 'Speaking' },
  { key: 'writingTask2', label: 'Writing Task 2' },
];

export const CriteriaProfileChart: React.FC<{
  profiles: Partial<Record<CriterionProfileKind, CriterionProfile>>;
  initialKind?: CriterionProfileKind;
}> = ({ profiles, initialKind = 'speaking' }) => {
  const [kind, setKind] = useState<CriterionProfileKind>(initialKind);
  const profile = profiles[kind];

  return (
    <PaperCard className="overflow-hidden">
      <div data-testid="criterion-profile-chart" aria-labelledby="criterion-profile-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="criterion-profile-heading" className="text-sm font-bold uppercase tracking-widest">Criterion Profile</h3>
            <p className="mt-2 text-sm leading-6 text-paper-ink/60">Criterion-level view of the latest complete analyzed attempt.</p>
          </div>
          <div className="flex border border-paper-ink/10" aria-label="Criterion profile module">
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

        {!profile ? (
          <div className="mt-6 grid min-h-72 place-items-center border border-dashed border-paper-ink/15 bg-paper-100/35 px-6 text-center">
            <p className="max-w-sm text-sm leading-7 text-paper-ink/55">No complete {kind === 'speaking' ? 'Speaking' : 'Writing Task 2'} criterion record is available yet.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 h-[270px]" role="img" aria-label={`${profile.label} criterion values on the IELTS band scale`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profile.criteria} layout="vertical" margin={{ top: 8, right: 36, bottom: 8, left: 6 }} accessibilityLayer>
                  <CartesianGrid stroke="#3c2f2f" strokeOpacity={0.08} horizontal={false} />
                  <XAxis type="number" domain={[0, 9]} ticks={[0, 3, 5, 7, 9]} tick={{ fill: '#5c4f4f', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="shortLabel" width={92} tick={{ fill: '#3c2f2f', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      const datum = payload?.[0]?.payload as CriterionProfile['criteria'][number] | undefined;
                      if (!active || !datum) return null;
                      return (
                        <div className="border border-paper-ink/15 bg-paper-50 px-3 py-2 shadow-sm">
                          <p className="text-sm font-bold text-paper-ink">{datum.label}</p>
                          <p className="text-xs text-accent-terracotta">Band {datum.value.toFixed(1)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" name="Band estimate" fill="#a64d32" fillOpacity={0.78} radius={0}>
                    <LabelList dataKey="value" position="right" fill="#3c2f2f" fontSize={11} formatter={(value: number) => value.toFixed(1)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2 border-t border-paper-ink/10 pt-4 sm:grid-cols-2">
              {profile.criteria.map(datum => (
                <div key={datum.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-paper-ink/65">{datum.label}</span>
                  <span className="font-bold text-paper-ink">{datum.value.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-paper-ink/45">
              {profile.label} · {new Date(profile.dateIso).toLocaleDateString()} · {profile.context}
            </p>
            <p className="mt-1 text-xs leading-5 text-paper-ink/55">{profile.note}</p>
          </>
        )}
      </div>
    </PaperCard>
  );
};
