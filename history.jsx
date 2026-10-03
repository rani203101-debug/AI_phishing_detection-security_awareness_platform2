import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { History as HistoryIcon, Search, Trash2, Mail, Link2, MessageSquare, Filter, ChevronRight, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import VerdictBadge from '@/components/VerdictBadge';
import EmptyState from '@/components/EmptyState';
import { ListSkeleton } from '@/components/Skeleton';
import { formatDate } from '@/lib/format';

const TYPE_ICONS = { email: Mail, url: Link2, sms: MessageSquare };

export default function HistoryPage() {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadScans = useCallback(async () => {
    setLoading(true);
    try {
      const query = {};
      if (verdictFilter !== 'all') query.verdict = verdictFilter;
      if (typeFilter !== 'all') query.type = typeFilter;
      if (search.trim()) {
        query.$or = [
          { subject: { $regex: search.trim(), $options: 'i' } },
          { sender: { $regex: search.trim(), $options: 'i' } },
          { content: { $regex: search.trim(), $options: 'i' } },
        ];
      }
      const page = await base44.entities.Scan.filter(query, { sort: '-created_date', limit: 50 });
      setScans(page.items || []);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [verdictFilter, typeFilter, search]);

  useEffect(() => {
    const t = setTimeout(loadScans, 300);
    return () => clearTimeout(t);
  }, [loadScans]);

  const handleDelete = async (id) => {
    try {
      await base44.entities.Scan.delete(id);
      setScans((s) => s.filter((sc) => sc.id !== id));
      toast.success('Scan deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
      <div className="mb-6 animate-fade-in">
        <h1 className="font-heading text-3xl font-bold mb-2 flex items-center gap-2">
          <HistoryIcon className="w-7 h-7 text-primary" />
          Scan History
        </h1>
        <p className="text-muted-foreground">Review your past scans and their verdicts.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by sender, subject, or content..."
            className="pl-9"
          />
        </div>
        <Select value={verdictFilter} onValueChange={setVerdictFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Verdict" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verdicts</SelectItem>
            <SelectItem value="safe">Safe</SelectItem>
            <SelectItem value="suspicious">Suspicious</SelectItem>
            <SelectItem value="phishing">Phishing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="url">URL</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <ListSkeleton count={4} />
      ) : scans.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No scans found"
          description={search || verdictFilter !== 'all' || typeFilter !== 'all'
            ? 'Try adjusting your filters or search terms.'
            : 'Start by scanning your first suspicious message.'}
          action={<Button onClick={() => navigate('/scanner')} className="gap-2">Scan a message</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {scans.map((scan) => {
            const Icon = TYPE_ICONS[scan.type] || Mail;
            return (
              <div
                key={scan.id}
                className="glass-card rounded-xl p-4 hover:border-primary/30 transition-all duration-200 group animate-fade-in"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <Link to={`/result/${scan.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <VerdictBadge verdict={scan.verdict} score={scan.score} size="sm" />
                      <span className="text-xs text-muted-foreground">{formatDate(scan.created_date)}</span>
                    </div>
                    <p className="text-sm font-medium truncate">
                      {scan.subject || scan.sender || scan.content?.substring(0, 50) || 'Untitled scan'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {scan.sender && `${scan.sender} · `}
                      {scan.content?.substring(0, 80)}...
                    </p>
                  </Link>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(scan.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link to={`/result/${scan.id}`} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}