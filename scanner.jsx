import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Link2, MessageSquare, ScanLine, ShieldCheck, ShieldAlert, Loader2, Sparkles, Brain, FileCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { analyzeHeuristic, verdictFromScore, mergeFlags } from '@/lib/heuristic';
import { SAMPLES } from '@/lib/samples';
import { cn } from '@/lib/utils';

const TAB_CONFIG = [
  { id: 'email', label: 'Email', icon: Mail, fields: ['sender', 'subject', 'content'] },
  { id: 'url', label: 'URL', icon: Link2, fields: ['content'] },
  { id: 'sms', label: 'SMS', icon: MessageSquare, fields: ['sender', 'content'] },
];

const STEPS = [
  { id: 0, label: 'Analyzing patterns', icon: ScanLine },
  { id: 1, label: 'AI threat evaluation', icon: Brain },
  { id: 2, label: 'Compiling report', icon: FileCheck },
];

export default function Scanner() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('email');
  const [form, setForm] = useState({ sender: '', subject: '', content: '' });
  const [errors, setErrors] = useState({});
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState(-1);

  const config = TAB_CONFIG.find((t) => t.id === tab);

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, content: undefined }));
  };

  const loadSample = (type) => {
    const sample = SAMPLES[tab]?.[type];
    if (sample) {
      setForm({ sender: sample.sender || '', subject: sample.subject || '', content: sample.content || '' });
      setErrors({});
      toast.success(type === 'phishing' ? 'Phishing sample loaded' : 'Safe sample loaded');
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.content || form.content.trim().length < 10) {
      errs.content = 'Content must be at least 10 characters';
    }
    if (tab === 'email' && !form.sender) {
      errs.sender = 'Sender is required for email scans';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleScan = async () => {
    if (!validate()) {
      toast.error('Please fix the errors before scanning');
      return;
    }

    setScanning(true);

    try {
      // Step 1: Heuristic analysis
      setStep(0);
      await delay(600);

      // Optional: RDAP lookup for URL/email
      let rdapDomainAgeDays = null;
      if (tab === 'url' || tab === 'email') {
        try {
          const rdapRes = await base44.functions.invoke('rdapLookup', { url: form.content || form.sender });
          if (rdapRes.data?.found) {
            rdapDomainAgeDays = rdapRes.data.domain_age_days;
          }
        } catch {
          // RDAP is optional — continue without it
        }
      }

      const heuristicResult = analyzeHeuristic({
        type: tab,
        sender: form.sender,
        subject: form.subject,
        content: form.content,
        rdapDomainAgeDays,
      });

      // Step 2: AI analysis
      setStep(1);
      await delay(400);

      let aiResult = null;
      let llmFallback = false;
      try {
        const response = await base44.functions.invoke('analyzePhishing', {
          type: tab,
          sender: form.sender,
          subject: form.subject,
          content: form.content,
        });
        aiResult = response.data;
      } catch (aiErr) {
        llmFallback = true;
      }

      // Step 3: Combine
      setStep(2);
      await delay(500);

      let finalScore, finalVerdict, finalFlags, explanationEli12, recommendedActions;

      if (aiResult && !llmFallback) {
        const aiScore = Math.min(100, Math.max(0, aiResult.ai_score ?? 0));
        finalScore = Math.round(heuristicResult.score * 0.4 + aiScore * 0.6);
        const aiFlags = (aiResult.ai_flags || []).map((f) => ({
          source: 'ai',
          category: 'ai',
          description: f,
          snippet: '',
        }));
        finalFlags = mergeFlags(heuristicResult.flags, aiFlags);
        explanationEli12 = aiResult.explanation_eli12 || '';
        recommendedActions = aiResult.recommended_actions || [];
      } else {
        // Fallback: heuristic only
        finalScore = heuristicResult.score;
        finalFlags = heuristicResult.flags;
        explanationEli12 = '';
        recommendedActions = [];
      }

      finalVerdict = verdictFromScore(finalScore);

      // Save to Scan entity
      const scan = await base44.entities.Scan.create({
        type: tab,
        sender: form.sender,
        subject: form.subject,
        content: form.content,
        score: finalScore,
        verdict: finalVerdict,
        flags: finalFlags,
        ai_score: aiResult?.ai_score ?? null,
        heuristic_score: heuristicResult.score,
        ai_flags: aiResult?.ai_flags || [],
        heuristic_flags: heuristicResult.flags.map((f) => f.description),
        explanation_eli12: explanationEli12,
        llm_fallback: llmFallback,
      });

      if (llmFallback) {
        toast.warning('AI analysis unavailable — showing heuristic-only results', { duration: 4000 });
      }

      navigate(`/result/${scan.id}`);
    } catch (error) {
      toast.error('Scan failed: ' + (error.message || 'Unknown error'));
      setScanning(false);
      setStep(-1);
    }
  };

  if (scanning) {
    return <ScanStepper step={step} steps={STEPS} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
      <div className="mb-8 animate-fade-in">
        <h1 className="font-heading text-3xl font-bold mb-2">Threat Scanner</h1>
        <p className="text-muted-foreground">Paste a suspicious message and let the hybrid engine analyze it.</p>
      </div>

      {/* Sample loader buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Quick samples:</span>
        <Button size="sm" variant="outline" onClick={() => loadSample('phishing')} className="gap-1.5 text-phishing border-phishing/30 hover:bg-phishing/10">
          <ShieldAlert className="w-3.5 h-3.5" /> Phishing
        </Button>
        <Button size="sm" variant="outline" onClick={() => loadSample('safe')} className="gap-1.5 text-safe border-safe/30 hover:bg-safe/10">
          <ShieldCheck className="w-3.5 h-3.5" /> Safe
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          {TAB_CONFIG.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} className="gap-2">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TAB_CONFIG.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
              {t.fields.includes('sender') && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {t.id === 'sms' ? 'Sender / Phone number' : 'Sender email'}
                  </label>
                  <Input
                    value={form.sender}
                    onChange={(e) => handleChange('sender', e.target.value)}
                    placeholder={t.id === 'sms' ? '+1-800-555-0199' : 'security@paypa1-support.tk'}
                    className={errors.sender ? 'border-destructive' : ''}
                  />
                  {errors.sender && <p className="text-xs text-destructive mt-1">{errors.sender}</p>}
                </div>
              )}
              {t.fields.includes('subject') && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Subject</label>
                  <Input
                    value={form.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    placeholder="URGENT: Your account will be suspended"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t.id === 'url' ? 'URL to analyze' : 'Message content'}
                </label>
                <Textarea
                  value={form.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  placeholder={t.id === 'url' ? 'https://example.com/verify' : 'Paste the full message text here...'}
                  className={cn('min-h-[180px] font-mono text-sm', errors.content && 'border-destructive')}
                />
                {errors.content && <p className="text-xs text-destructive mt-1">{errors.content}</p>}
                <p className="text-xs text-muted-foreground mt-1.5">
                  {form.content.length} characters {form.content.length < 10 && '· minimum 10 required'}
                </p>
              </div>

              <Button onClick={handleScan} size="lg" className="w-full gap-2 group">
                <ScanLine className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                Scan for threats
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ScanStepper({ step, steps }) {
  return (
    <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center animate-pulse-glow">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
      <div className="w-full space-y-4">
        {steps.map((s) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isDone = step > s.id;
          return (
            <div
              key={s.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300',
                isActive ? 'glass-card border-primary/30 scale-[1.02]' : isDone ? 'opacity-50' : 'opacity-30'
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                isActive ? 'bg-primary/15 text-primary' : isDone ? 'bg-safe/15 text-safe' : 'bg-muted text-muted-foreground'
              )}>
                {isDone ? <ShieldCheck className="w-4 h-4" /> : <Icon className={cn('w-4 h-4', isActive && 'animate-pulse')} />}
              </div>
              <span className="text-sm font-medium">{s.label}</span>
              {isActive && <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}