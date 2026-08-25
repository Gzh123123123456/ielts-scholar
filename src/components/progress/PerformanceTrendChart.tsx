import React from 'react';
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PaperCard } from '@/src/components/ui/PaperCard';
import type { PerformancePoint, PerformanceSeries } from '@/src/lib/progressAnalytics';

const series: { key: PerformanceSeries; label: string; color: string; shape: 'circle' | 'triangle' | 'diamond' }[] = [
  { key: 'speaking', label: 'Speaking', color: '#a64d32', shape: 'circle' },
  { key: 'writingTask1', label: 'Writing Task 1', color: '#53736b', shape: 'triangle' },
  { key: 'writingTask2', label: 'Writing Task 2', color: '#765b78', shape: 'diamond' },
];

const shortDate = (value: number | string) => new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric',
}).format(new Date(typeof value === 'number' ? value : Date.parse(value)));

const longDate = (value: string) => new Intl.DateTimeFormat('en', {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

export const PerformanceTrendChart: React.FC<{ points: PerformancePoint[] }> = ({ points }) => (
  <PaperCard className="overflow-hidden" id="performance-trajectory">
    <div data-testid="performance-trajectory-chart" aria-labelledby="performance-trajectory-heading">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 id="performance-trajectory-heading" className="text-sm font-bold uppercase tracking-widest">
            Performance Trajectory
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-paper-ink/60">
            Each marker is one analyzed local attempt. Marker shapes distinguish modules as well as colour.
          </p>
        </div>
        <span className="text-xs font-sans text-paper-ink/45">{points.length} observed estimates</span>
      </div>

      {points.length < 2 ? (
        <div className="grid min-h-64 place-items-center border border-dashed border-paper-ink/15 bg-paper-100/35 px-6 text-center">
          <p className="max-w-md text-sm leading-7 text-paper-ink/55">
            At least two analyzed attempts are needed to show a trajectory. No values are inferred between missing sessions.
          </p>
        </div>
      ) : (
        <>
          <div className="h-[360px] w-full" role="img" aria-label="Chronological IELTS training-band estimates for Speaking, Writing Task 1, and Writing Task 2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 20, bottom: 12, left: 0 }} accessibilityLayer>
                <CartesianGrid stroke="#3c2f2f" strokeOpacity={0.08} vertical={false} />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  domain={['dataMin', 'dataMax']}
                  scale="time"
                  tickFormatter={shortDate}
                  tick={{ fill: '#5c4f4f', fontSize: 11 }}
                  axisLine={{ stroke: '#3c2f2f', strokeOpacity: 0.2 }}
                  tickLine={false}
                  minTickGap={34}
                />
                <YAxis
                  type="number"
                  dataKey="score"
                  domain={[0, 9]}
                  ticks={[0, 3, 4, 5, 6, 7, 8, 9]}
                  tick={{ fill: '#5c4f4f', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  label={{ value: 'Band', angle: -90, position: 'insideLeft', fill: '#5c4f4f', fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ stroke: '#a64d32', strokeOpacity: 0.25, strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as PerformancePoint | undefined;
                    if (!active || !point) return null;
                    return (
                      <div className="max-w-72 border border-paper-ink/15 bg-paper-50 px-4 py-3 shadow-sm">
                        <p className="text-xs font-sans font-bold uppercase tracking-wider text-accent-terracotta">{point.seriesLabel}</p>
                        <p className="mt-1 text-lg font-bold text-paper-ink">Band {point.score.toFixed(1)}</p>
                        <p className="mt-1 text-xs text-paper-ink/55">{longDate(point.dateIso)}</p>
                        <p className="mt-2 text-sm leading-5 text-paper-ink/70">{point.context}</p>
                      </div>
                    );
                  }}
                />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {series.map(item => (
                  <Scatter
                    key={item.key}
                    name={item.label}
                    data={points.filter(point => point.series === item.key)}
                    fill={item.color}
                    line={{ stroke: item.color, strokeWidth: 1.5, strokeOpacity: 0.55 }}
                    shape={item.shape}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid gap-2 border-t border-paper-ink/10 pt-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Recent trajectory values">
            {points.slice(-6).reverse().map(point => (
              <p key={point.id} className="text-xs leading-5 text-paper-ink/60">
                <span className="font-bold text-paper-ink">{point.seriesLabel} {point.score.toFixed(1)}</span> · {shortDate(point.timestamp)}
              </p>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-xs leading-5 text-paper-ink/45">
        Local AI-assisted training estimates, not official IELTS results. Connecting strokes show the order of observed attempts; they do not create missing sessions.
      </p>
    </div>
  </PaperCard>
);
