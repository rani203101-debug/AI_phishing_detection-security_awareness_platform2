import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Flame, ShieldAlert, Loader2, TrendingUp, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { ListSkeleton } from '@/components/Skeleton';
import { maskSender } from '@/lib/heuristic';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const SEVERITY_CONFIG = {
  low: { classes: 'bg-safe/10 text-safe border-safe/30', label: 'Low' },
  medium: { classes: 'bg-suspicious/10 text-suspicious border-suspicious/30', label: 'Medium' },
  high: { classes: 'bg-phishing/10 text-phishing border-phishing/30', label: 'High' },
  critical: { classes: 'bg-phishing/20 text-phishing border-phishing/40', label: 'Critical' },
};

const ATTACK_LABELS = {
  phishing_email: 'Phishing Email',
  phishing_url: 'Phishing URL',
  smishing: 'SMS Phishing',
  vishing: 'Voice Phishing',
  spoofing: 'Spoofing',
  other: 'Other',
};

export default function Community() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    attack_type: 'phishing_email',
    sender: '',
    subject: '',
    content_snippet: '',
    severity: 'medium',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.CommunityReport.filter({}, { sort: '-created_date', limit: 50 });
      setReports(page.items || []);
    } catch {
      toast.error('Failed to load community feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.sender.trim() && !form.content_snippet.trim()) {
      toast.error('Please provide a sender or content snippet');
      return;
    }
    setSubmitting(true);
    try {
      const maskedSender = maskSender(form.sender.trim());
      // Check for existing report
      const existing = await base44.entities.CommunityReport.filter({
        attack_type: form.attack_type,
        masked_sender: maskedSender,
      });

      if (existing && existing.length > 0) {
        const match = existing[0];
        await base44.entities.CommunityReport.update(match.id, {
          report_count: (match.report_count || 1) + 1,
        });
        toast.success('Report count updated');
      } else {
        await base44.entities.CommunityReport.create({
          attack_type: form.attack_type,
          masked_sender: maskedSender,
          subject: form.subject.trim(),
          content_snippet: form.content_snippet.trim().substring(0, 300),
          report_count: 1,
          severity: form.severity,
          status: 'reported',
        });
        toast.success('Report submitted to community');
      }
      setForm({ attack_type: 'phishing_email', sender: '', subject: '', content_snippet: '', severity: 'medium' });
      setShowForm(false);
      load();
    } catch {
      toast.error('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
      <div className="flex items-start justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-3xl font-bold mb-2 flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />
            Community Feed
          </h1>
          <p className="text-muted-foreground">Crowd-sourced phishing reports from the community.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" /> Report
        </Button>
      </div>

      {loading ? (
        <ListSkeleton count={4} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No reports yet"
          description="Be the first to report a phishing attempt to the community."
          action={<Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Report a phishing attempt</Button>}
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => {
            const sev = SEVERITY_CONFIG[report.severity] || SEVERITY_CONFIG.medium;
            return (
              <div key={report.id} className="glass-card rounded-xl p-4 animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-phishing/10 flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-5 h-5 text-phishing" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-medium">{ATTACK_LABELS[report.attack_type] || report.attack_type}</span>
                      <span className={cn('text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border', sev.classes)}>
                        {sev.label}
                      </span>
                      {report.report_count > 1 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Flame className="w-3 h-3 text-suspicious" />
                          {report.report_count} reports
                        </span>
                      )}
                    </div>
                    {report.masked_sender && (
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        From: {report.masked_sender}
                      </div>
                    )}
                    {report.subject && (
                      <div className="text-sm font-medium truncate mb-0.5">{report.subject}</div>
                    )}
                    {report.content_snippet && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{report.content_snippet}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1.5">{formatRelative(report.created_date)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a phishing attempt</DialogTitle>
            <DialogDescription>
              Share a suspicious message with the community. Sender details are automatically masked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Attack type</label>
              <Select value={form.attack_type} onValueChange={(v) => setForm(f => ({ ...f, attack_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phishing_email">Phishing Email</SelectItem>
                  <SelectItem value="phishing_url">Phishing URL</SelectItem>
                  <SelectItem value="smishing">SMS Phishing</SelectItem>
                  <SelectItem value="vishing">Voice Phishing</SelectItem>
                  <SelectItem value="spoofing">Spoofing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Sender (will be masked)</label>
              <Input
                value={form.sender}
                onChange={(e) => setForm(f => ({ ...f, sender: e.target.value }))}
                placeholder="spoofed@paypa1-support.tk"
              />
              {form.sender && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">→ {maskSender(form.sender)}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Input
                value={form.subject}
                onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="URGENT: Verify your account"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Content snippet</label>
              <Textarea
                value={form.content_snippet}
                onChange={(e) => setForm(f => ({ ...f, content_snippet: e.target.value }))}
                placeholder="Paste the suspicious message content..."
                className="min-h-[100px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Severity</label>
              <Select value={form.severity} onValueChange={(v) => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}