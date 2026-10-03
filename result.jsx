import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, ShieldAlert, ArrowLeft, Download, ScanLine, Share2, Lightbulb, Flag, Info, Loader2, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import RiskGauge from '@/components/RiskGauge';
import VerdictBadge from '@/components/VerdictBadge';
import HighlightedText from '@/components/HighlightedText';
import { maskSender } from '@/lib/heuristic';
import { cn } from '@/lib/utils';

const VERDICT_CONFIG = {
  safe: {
    icon: ShieldCheck,
    color: 'text-safe',
    bg: 'bg-safe/10',
    border: 'border-safe/30',
    label: 'This message appears safe',
    description: 'No significant phishing indicators were detected. Always stay vigilant.',
  },
  suspicious: {
    icon: AlertTriangle,
    color: 'text-suspicious',
    bg: 'bg-suspicious/10',
    border: 'border-suspicious/30',
    label: 'This message is suspicious',
    description: 'Several phishing indicators were found. Exercise caution and verify independently.',
  },
  phishing: {
    icon: ShieldAlert,
    color: 'text-phishing',
    bg: 'bg-phishing/10',
    border: 'border-phishing/30',
    label: 'This message is a phishing attempt',
    description: 'Multiple strong phishing indicators detected. Do not click links or share information.',
  },
};

export default function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEli12, setShowEli12] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Scan.get(id);
        setScan(data);
      } catch {
        toast.error('Scan not found');
        navigate('/history');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!scan) return null;

  const config = VERDICT_CONFIG[scan.verdict] || VERDICT_CONFIG.safe;
  const VerdictIcon = config.icon;
  const flags = scan.flags || [];

  const handleReport = async () => {
    setReporting(true);
    try {
      const maskedSender = maskSender(scan.sender || '');
      const attackType = scan.type === 'email' ? 'phishing_email' : scan.type === 'url' ? 'phishing_url' : 'smishing';

      // Check for existing report with same attack_type + masked_sender
      const existing = await base44.entities.CommunityReport.filter({
        attack_type: attackType,
        masked_sender: maskedSender,
      });

      if (existing && existing.length > 0) {
        const match = existing[0];
        await base44.entities.CommunityReport.update(match.id, {
          report_count: (match.report_count || 1) + 1,
        });
        toast.success('Report count updated in community feed');
      } else {
        await base44.entities.CommunityReport.create({
          attack_type: attackType,
          masked_sender: maskedSender,
          subject: scan.subject || '',
          content_snippet: scan.content?.substring(0, 200) || '',
          report_count: 1,
          severity: scan.verdict === 'phishing' ? 'high' : scan.verdict === 'suspicious' ? 'medium' : 'low',
          status: 'reported',
        });
        toast.success('Reported to community feed');
      }
    } catch {
      toast.error('Failed to report');
    } finally {
      setReporting(false);
    }
  };

  const handleDownload = () => {
    const printHTML = generatePrintHTML(scan);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(printHTML);
      w.document.close();
      setTimeout(() => w.print(), 300);
    } else {
      toast.error('Please allow popups to download the report');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
      {/* Back link */}
      <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to history
      </Link>

      {scan.llm_fallback && (
        <div className="mb-4 p-3 rounded-lg bg-suspicious/10 border border-suspicious/30 text-sm text-suspicious flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          AI analysis was unavailable — showing heuristic-only results.
        </div>
      )}

      {/* Verdict banner + gauge */}
      <div className={cn('glass-card rounded-2xl p-6 sm:p-8 border', config.border, 'animate-scale-in')}>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <RiskGauge score={scan.score} verdict={scan.verdict} size={180} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
              <VerdictBadge verdict={scan.verdict} score={scan.score} />
            </div>
            <h1 className={cn('font-heading text-2xl font-bold mb-2 flex items-center gap-2 justify-center sm:justify-start', config.color)}>
              <VerdictIcon className="w-6 h-6" />
              {config.label}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{config.description}</p>

            {/* Score breakdown */}
            <div className="mt-4 grid grid-cols-2 gap-3 max-w-xs mx-auto sm:mx-0">
              <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                <div className="text-xs text-muted-foreground mb-0.5">Heuristic</div>
                <div className="font-heading font-bold text-lg">{scan.heuristic_score ?? '—'}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                <div className="text-xs text-muted-foreground mb-0.5">AI</div>
                <div className="font-heading font-bold text-lg">{scan.ai_score ?? '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Red flag cards */}
      {flags.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-phishing" />
            Red flags detected ({flags.length})
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {flags.map((flag, i) => (
              <div key={i} className="glass-card rounded-xl p-4 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-phishing/10 flex items-center justify-center flex-shrink-0">
                    <Flag className="w-4 h-4 text-phishing" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {flag.source}
                      </span>
                      <span className="text-xs font-medium text-primary">{flag.category}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{flag.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Original message with highlights */}
      <div className="mt-8">
        <h2 className="font-heading text-lg font-semibold mb-4">Original message</h2>
        <div className="glass-card rounded-2xl p-5 overflow-x-auto">
          {scan.sender && (
            <div className="mb-3 pb-3 border-b border-border">
              <div className="text-xs text-muted-foreground mb-1">From</div>
              <div className="font-mono text-sm">{scan.sender}</div>
            </div>
          )}
          {scan.subject && (
            <div className="mb-3 pb-3 border-b border-border">
              <div className="text-xs text-muted-foreground mb-1">Subject</div>
              <div className="font-mono text-sm">{scan.subject}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground mb-2">Content</div>
            <HighlightedText content={scan.content} flags={flags} />
          </div>
        </div>
      </div>

      {/* Explain like I'm 12 */}
      {scan.explanation_eli12 && (
        <div className="mt-6">
          <button
            onClick={() => setShowEli12(!showEli12)}
            className="w-full glass-card rounded-xl p-4 flex items-center gap-3 hover:border-primary/30 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Explain like I'm 12</div>
              <div className="text-xs text-muted-foreground">Tap to {showEli12 ? 'hide' : 'show'} a simple explanation</div>
            </div>
            <RotateCcw className={cn('w-4 h-4 text-muted-foreground transition-transform', showEli12 && 'rotate-180')} />
          </button>
          {showEli12 && (
            <div className="mt-2 glass-card rounded-xl p-4 text-sm leading-relaxed animate-fade-in">
              {scan.explanation_eli12}
            </div>
          )}
        </div>
      )}

      {/* Recommended actions */}
      {flags.length > 0 && (
        <div className="mt-6">
          <h2 className="font-heading text-lg font-semibold mb-4">Recommended actions</h2>
          <div className="glass-card rounded-2xl p-5 space-y-2.5">
            {getRecommendedActions(scan.verdict).map((action, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{i + 1}</span>
                </div>
                <p className="text-sm leading-relaxed">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button onClick={() => navigate('/scanner')} variant="default" size="lg" className="flex-1 gap-2">
          <ScanLine className="w-4 h-4" /> Scan another
        </Button>
        <Button onClick={handleDownload} variant="outline" size="lg" className="flex-1 gap-2">
          <Download className="w-4 h-4" /> Download report
        </Button>
        <Button onClick={handleReport} disabled={reporting} variant="outline" size="lg" className="flex-1 gap-2">
          {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Report to community
        </Button>
      </div>
    </div>
  );
}

function getRecommendedActions(verdict) {
  if (verdict === 'safe') {
    return [
      'No action needed — this message appears legitimate.',
      'Continue to be cautious with any links or attachments.',
      'If anything feels off, verify through an official channel.',
    ];
  }
  if (verdict === 'suspicious') {
    return [
      'Do not click any links or download attachments.',
      'Verify the sender through an independent channel (official website, phone number).',
      'Report the message to your IT/security team if at work.',
      'Delete the message after reporting.',
    ];
  }
  return [
    'Do NOT click any links, download attachments, or reply.',
    'Do not enter any credentials or personal information.',
    'Report this message to your IT/security team immediately.',
    'Block the sender and delete the message.',
    'If you already clicked or entered info, change your password and enable 2FA now.',
  ];
}

function generatePrintHTML(scan) {
  const date = new Date(scan.created_date).toLocaleString();
  const flags = (scan.flags || []).map((f) => `<li><strong>${f.category}:</strong> ${f.description}</li>`).join('');
  return `<!doctype html>
<html><head><title>PhishGuard Report — ${scan.verdict}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #1a1a2e; }
  h1 { color: ${scan.verdict === 'phishing' ? '#dc2626' : scan.verdict === 'suspicious' ? '#d97706' : '#16a34a'}; }
  .meta { background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0; font-size: 14px; }
  .score { font-size: 48px; font-weight: bold; }
  pre { background: #f4f4f5; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 13px; }
  ul { padding-left: 20px; } li { margin: 8px 0; }
  .verdict { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
</style></head>
<body>
  <h1>🛡️ PhishGuard AI Report</h1>
  <div class="meta">
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Type:</strong> ${scan.type.toUpperCase()}</p>
    <p><strong>Verdict:</strong> <span class="verdict" style="background:${scan.verdict === 'phishing' ? '#fee2e2' : scan.verdict === 'suspicious' ? '#fef3c7' : '#dcfce7'};color:${scan.verdict === 'phishing' ? '#dc2626' : scan.verdict === 'suspicious' ? '#d97706' : '#16a34a'}">${scan.verdict.toUpperCase()}</span></p>
    <p><strong>Risk Score:</strong> <span class="score">${scan.score}</span>/100</p>
    <p><strong>Heuristic Score:</strong> ${scan.heuristic_score ?? 'N/A'}</p>
    <p><strong>AI Score:</strong> ${scan.ai_score ?? 'N/A'}</p>
  </div>
  ${scan.sender ? `<p><strong>From:</strong> ${scan.sender}</p>` : ''}
  ${scan.subject ? `<p><strong>Subject:</strong> ${scan.subject}</p>` : ''}
  <h3>Content</h3>
  <pre>${(scan.content || '').replace(/</g, '&lt;')}</pre>
  <h3>Red Flags (${(scan.flags || []).length})</h3>
  <ul>${flags || '<li>No flags detected.</li>'}</ul>
  <p style="margin-top:32px;color:#888;font-size:12px;">Generated by PhishGuard AI</p>
</body></html>`;
}