import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ScanLine, GraduationCap, Users, ArrowRight, ShieldCheck, AlertTriangle, Activity, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

const FEATURES = [
  {
    icon: ScanLine,
    title: 'AI Threat Scanner',
    description: 'Paste any email, URL, or SMS. Our hybrid engine combines heuristics with AI to detect phishing in seconds.',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  {
    icon: GraduationCap,
    title: 'Awareness Training',
    description: 'Interactive quizzes and bite-sized lessons that build real-world phishing detection skills.',
    color: 'text-chart-2',
    bg: 'bg-chart-2/10',
    border: 'border-chart-2/20',
  },
  {
    icon: Users,
    title: 'Community Intelligence',
    description: 'Crowd-sourced threat reports keep everyone ahead of emerging phishing campaigns.',
    color: 'text-chart-4',
    bg: 'bg-chart-4/10',
    border: 'border-chart-4/20',
  },
];

export default function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ scans: null, reports: null, loading: true });

  useEffect(() => {
    (async () => {
      try {
        const [scanCount, reportCount, safeCount, phishingCount] = await Promise.all([
          base44.entities.Scan.count({}),
          base44.entities.CommunityReport.count({}),
          base44.entities.Scan.count({ verdict: 'safe' }),
          base44.entities.Scan.count({ verdict: 'phishing' }),
        ]);
        setStats({ scans: scanCount, reports: reportCount, safe: safeCount, threats: phishingCount, loading: false });
      } catch {
        setStats({ scans: 0, reports: 0, safe: 0, threats: 0, loading: false });
      }
    })();
  }, []);

  return (
    <div className="relative">
      {/* Background grid */}
      <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 lg:px-8 py-12 lg:py-20">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono text-primary mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI-POWERED PHISHING DEFENSE
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Stop phishing attacks
            <br />
            <span className="text-gradient">before they reach you</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
            PhishGuard AI analyzes emails, URLs, and text messages using a hybrid detection engine —
            combining rule-based heuristics with AI to catch what humans miss.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/scanner">
              <Button size="lg" className="gap-2 group">
                <ScanLine className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                Scan a message now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/train">
              <Button size="lg" variant="outline" className="gap-2">
                <GraduationCap className="w-4 h-4" />
                Train your skills
              </Button>
            </Link>
          </div>
        </div>

        {/* Live stats strip */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
          <StatCard icon={Activity} label="Total Scans" value={stats.loading ? '—' : stats.scans?.toLocaleString()} />
          <StatCard icon={ShieldCheck} label="Safe Detected" value={stats.loading ? '—' : stats.safe?.toLocaleString()} />
          <StatCard icon={AlertTriangle} label="Threats Found" value={stats.loading ? '—' : stats.threats?.toLocaleString()} />
          <StatCard icon={Users} label="Community Reports" value={stats.loading ? '—' : stats.reports?.toLocaleString()} />
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid md:grid-cols-3 gap-5">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="glass-card rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl ${feat.bg} border ${feat.border} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${feat.color}`} />
                </div>
                <h3 className="font-heading text-lg font-semibold mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <div className="glass-card rounded-2xl p-8 max-w-2xl mx-auto">
            <Zap className="w-8 h-8 text-primary mx-auto mb-4" />
            <h2 className="font-heading text-2xl font-bold mb-3">Ready to test your phishing radar?</h2>
            <p className="text-muted-foreground mb-6">
              Try a real phishing sample and see the engine break down every red flag in seconds.
            </p>
            <Link to="/scanner">
              <Button className="gap-2">
                Start scanning
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="glass-card rounded-xl p-4 text-center">
      <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
      <div className="font-heading text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}