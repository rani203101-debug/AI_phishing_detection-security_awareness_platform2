import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, ScanLine, ShieldCheck, AlertTriangle, ShieldAlert, TrendingUp, Trophy, Loader2, Users, Crown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import EmptyState from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const VERDICT_COLORS = {
  safe: 'hsl(var(--safe))',
  suspicious: 'hsl(var(--suspicious))',
  phishing: 'hsl(var(--phishing))',
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, safe: 0, suspicious: 0, phishing: 0 });
  const [timeline, setTimeline] = useState([]);
  const [verdictData, setVerdictData] = useState([]);
  const [typeData, setTypeData] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = isAdmin ? {} : { created_by_id: user?.id };

      // Aggregate by verdict
      const verdictAgg = await base44.entities.Scan.aggregate({
        query,
        groupBy: 'verdict',
      });
      const verdictMap = {};
      let total = 0;
      for (const row of verdictAgg.rows || []) {
        verdictMap[row.verdict] = row.count;
        total += row.count;
      }
      setStats({
        total,
        safe: verdictMap.safe || 0,
        suspicious: verdictMap.suspicious || 0,
        phishing: verdictMap.phishing || 0,
      });

      setVerdictData([
        { name: 'Safe', value: verdictMap.safe || 0, color: VERDICT_COLORS.safe },
        { name: 'Suspicious', value: verdictMap.suspicious || 0, color: VERDICT_COLORS.suspicious },
        { name: 'Phishing', value: verdictMap.phishing || 0, color: VERDICT_COLORS.phishing },
      ].filter(d => d.value > 0));

      // Aggregate by type
      const typeAgg = await base44.entities.Scan.aggregate({
        query,
        groupBy: 'type',
      });
      setTypeData((typeAgg.rows || []).map(row => ({
        type: row.type,
        count: row.count,
      })));

      // Timeline by day (last 14 days)
      const dateAgg = await base44.entities.Scan.aggregate({
        query,
        dateBucket: { field: 'created_date', unit: 'day' },
        sort: '_id',
      });
      const rows = dateAgg.rows || [];
      setTimeline(rows.map(row => ({
        date: formatShortDate(row._id),
        scans: row.count,
      })));

      // Leaderboard: top users by quiz score (admin only)
      if (isAdmin) {
        try {
          const progressPage = await base44.entities.UserProgress.filter({}, { sort: '-total_score', limit: 10 });
          setLeaderboard(progressPage || []);
        } catch {
          setLeaderboard([]);
        }
      } else {
        // Personal: just show own progress
        try {
          const myProgress = await base44.entities.UserProgress.filter({ created_by_id: user?.id });
          setLeaderboard(myProgress || []);
        } catch {
          setLeaderboard([]);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8 space-y-6">
        <div className="h-8 w-48 bg-muted/30 rounded animate-shimmer" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton />
        </div>
      </div>
    );
  }

  const hasData = stats.total > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
      <div className="mb-6 animate-fade-in">
        <h1 className="font-heading text-3xl font-bold mb-2 flex items-center gap-2">
          <LayoutDashboard className="w-7 h-7 text-primary" />
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Team-wide phishing awareness overview.' : 'Your personal phishing awareness overview.'}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ScanLine} label="Total Scans" value={stats.total} color="text-primary" bg="bg-primary/10" />
        <StatCard icon={ShieldCheck} label="Safe" value={stats.safe} color="text-safe" bg="bg-safe/10" />
        <StatCard icon={AlertTriangle} label="Suspicious" value={stats.suspicious} color="text-suspicious" bg="bg-suspicious/10" />
        <StatCard icon={ShieldAlert} label="Phishing" value={stats.phishing} color="text-phishing" bg="bg-phishing/10" />
      </div>

      {!hasData ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No scan data yet"
          description="Start scanning messages to see your analytics here."
        />
      ) : (
        <>
          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            {/* Line chart */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-heading font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Scan activity
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line type="monotone" dataKey="scans" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Donut chart */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-heading font-semibold mb-4">Verdict distribution</h3>
              {verdictData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={verdictData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                      {verdictData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No data</div>
              )}
            </div>
          </div>

          {/* Bar chart */}
          <div className="glass-card rounded-2xl p-5 mb-6">
            <h3 className="font-heading font-semibold mb-4">Scans by type</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-heading font-semibold mb-4 flex items-center gap-2">
            {isAdmin ? <Users className="w-4 h-4 text-primary" /> : <Trophy className="w-4 h-4 text-primary" />}
            {isAdmin ? 'Awareness leaderboard' : 'Your progress'}
          </h3>
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                  i === 0 ? 'bg-amber-500/20 text-amber-500' : i === 1 ? 'bg-slate-400/20 text-slate-400' : i === 2 ? 'bg-orange-700/20 text-orange-700' : 'bg-muted text-muted-foreground'
                )}>
                  {i < 3 ? <Crown className="w-4 h-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {isAdmin ? `User ${entry.created_by_id?.substring(0, 8) || 'Unknown'}` : 'You'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.questions_answered || 0} questions · {entry.best_streak || 0} best streak
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-heading font-bold text-lg">{entry.total_score || 0}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="glass-card rounded-xl p-4 animate-fade-in">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', bg)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className="font-heading text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}