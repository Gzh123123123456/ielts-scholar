import React, { useMemo } from 'react';
import { CriteriaProfileChart } from '@/src/components/progress/CriteriaProfileChart';
import { CoverageChart } from '@/src/components/progress/CoverageChart';
import { PerformanceTrendChart } from '@/src/components/progress/PerformanceTrendChart';
import type { PracticeRecord } from '@/src/lib/practiceRecords';
import { buildProgressAnalytics } from '@/src/lib/progressAnalytics';

export type ProgressAnalyticsView = 'overview' | 'speaking' | 'writing';

export const ProgressAnalyticsDashboard: React.FC<{
  records: PracticeRecord[];
  view?: ProgressAnalyticsView;
}> = ({ records, view = 'overview' }) => {
  const analytics = useMemo(() => buildProgressAnalytics(records), [records]);

  if (view === 'speaking') {
    return (
      <section aria-label="Speaking learning analytics" className="grid gap-8 xl:grid-cols-2">
        <CriteriaProfileChart profiles={analytics.criteria} initialKind="speaking" />
        <CoverageChart groups={analytics.coverage} initialKind="speaking" />
      </section>
    );
  }

  if (view === 'writing') {
    return (
      <section aria-label="Writing learning analytics" className="space-y-8">
        <PerformanceTrendChart points={analytics.trajectory} />
        <div className="grid gap-8 xl:grid-cols-2">
          <CriteriaProfileChart profiles={analytics.criteria} initialKind="writingTask2" />
          <CoverageChart groups={analytics.coverage} initialKind="writingTask2" />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Learning analytics visualizations" className="space-y-8">
      <PerformanceTrendChart points={analytics.trajectory} />
      <div className="grid gap-8 xl:grid-cols-2">
        <CriteriaProfileChart profiles={analytics.criteria} />
        <CoverageChart groups={analytics.coverage} />
      </div>
    </section>
  );
};
