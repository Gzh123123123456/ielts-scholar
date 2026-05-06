import React from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { useApp } from '@/src/context/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function Progress() {
  const { profile, sessions } = useApp();

  const chartData = profile.estimatedBandHistory.map((h, i) => ({
    session: i + 1,
    band: h.band,
    date: new Date(h.date).toLocaleDateString()
  }));

  const tagData = Object.entries(profile.errorTags)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const colors = ['#a64d32', '#3c2f2f', '#5c4f4f', '#8c7d7d', '#b19f9f'];

  return (
    <PageShell>
      <TopBar />
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <h2 className="text-3xl mb-2">Your Training Trajectory</h2>
        <p className="text-sm italic text-paper-ink/60">
          "The distance between where you are and where you want to be is determined by your daily output."
        </p>
      </div>

      {sessions.length === 0 ? (
        <PaperCard className="text-center py-20 bg-paper-ink/5 border-dashed">
          <p className="text-paper-ink/40 italic">No practice data recorded yet. Complete a session to see your growth.</p>
        </PaperCard>
      ) : (
        <div className="space-y-8">
          <div className="grid md:grid-cols-3 gap-8">
            <PaperCard className="text-center py-8">
              <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">Total Practices</div>
              <div className="text-4xl font-bold text-paper-ink">{profile.totalSessions}</div>
            </PaperCard>
            <PaperCard className="text-center py-8">
              <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">Latest Band Estimate</div>
              <div className="text-4xl font-bold text-accent-terracotta">
                {profile.estimatedBandHistory[profile.estimatedBandHistory.length - 1]?.band || 0}
              </div>
            </PaperCard>
            <PaperCard className="text-center py-8">
              <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">Last Active</div>
              <div className="text-sm font-bold uppercase tracking-widest text-paper-ink pt-2 font-sans">
                {profile.lastPracticed ? new Date(profile.lastPracticed).toLocaleDateString() : 'Today'}
              </div>
            </PaperCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <PaperCard className="h-80">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 border-b border-paper-ink/5 pb-2">Band Progression</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3c2f2f10" />
                  <XAxis dataKey="session" stroke="#3c2f2f40" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 9]} stroke="#3c2f2f40" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fdfaf6', border: '1px solid #3c2f2f10', fontSize: '12px', fontFamily: 'Georgia' }}
                    itemStyle={{ color: '#a64d32' }}
                  />
                  <Line type="monotone" dataKey="band" stroke="#a64d32" strokeWidth={2} dot={{ fill: '#a64d32', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </PaperCard>

            <PaperCard className="h-80">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 border-b border-paper-ink/5 pb-2">Top Difficulty Areas (Planned)</h3>
              <div className="h-full flex items-center justify-center italic text-xs text-paper-ink/40 p-12 text-center leading-relaxed">
                <p>
                  V2 will include automated error tag frequency tracking. <br/>
                  Currently, patterns are preserved in your individual Obsidian notes.
                </p>
              </div>
            </PaperCard>
          </div>

          <div>
            <h3 className="text-xl font-serif mb-4 ml-1">Recent Sessions</h3>
            <div className="space-y-4">
              {sessions.slice(0, 5).map((session) => (
                <PaperCard key={session.id} className="p-4 hover:bg-paper-50/50 transition-colors cursor-default">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded text-[10px] font-bold uppercase tracking-widest ${session.module === 'speaking' ? 'bg-blue-50 text-blue-800' : 'bg-orange-50 text-orange-800'}`}>
                        {session.module}
                      </div>
                      <div>
                        <div className="text-sm font-semibold truncate max-w-[200px] sm:max-w-md">{session.question}</div>
                        <div className="text-[10px] text-paper-ink/40 font-sans tracking-widest mt-1">
                          {new Date(session.date).toLocaleString()} • {session.mode}
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-accent-terracotta">
                      {(session.feedback?.bandEstimateExcludingPronunciation || session.feedback?.scores?.taskResponse || 0).toFixed(1)}
                    </div>
                  </div>
                </PaperCard>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
