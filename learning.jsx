import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Clock, ChevronRight, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import EmptyState from '@/components/EmptyState';
import { ListSkeleton } from '@/components/Skeleton';
import { cn } from '@/lib/utils';

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Beginner', classes: 'bg-safe/10 text-safe border-safe/30' },
  intermediate: { label: 'Intermediate', classes: 'bg-suspicious/10 text-suspicious border-suspicious/30' },
  advanced: { label: 'Advanced', classes: 'bg-phishing/10 text-phishing border-phishing/30' },
};

const CATEGORY_ICONS = {
  email: '📧', url: '🔗', sms: '💬', social: '👥', passwords: '🔐', general: '🛡️',
};

export default function Learn() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = {};
      if (category !== 'all') query.category = category;
      if (search.trim()) {
        query.title = { $regex: search.trim(), $options: 'i' };
      }
      const page = await base44.entities.LearnTopic.filter(query, { sort: '-created_date', limit: 50 });
      setTopics(page.items || []);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
      <div className="mb-6 animate-fade-in">
        <h1 className="font-heading text-3xl font-bold mb-2 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-primary" />
          Learn Hub
        </h1>
        <p className="text-muted-foreground">Bite-sized lessons to sharpen your phishing radar.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search topics..."
          className="flex-1"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="url">URL</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="social">Social</SelectItem>
            <SelectItem value="passwords">Passwords</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ListSkeleton key={i} count={1} />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No topics found"
          description="Try a different search or category filter."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((topic, i) => {
            const diff = DIFFICULTY_CONFIG[topic.difficulty] || DIFFICULTY_CONFIG.beginner;
            return (
              <button
                key={topic.id}
                onClick={() => setSelected(topic)}
                className="glass-card rounded-2xl p-5 text-left hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 animate-fade-in group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                    {CATEGORY_ICONS[topic.category] || '🛡️'}
                  </div>
                  <span className={cn('text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border', diff.classes)}>
                    {diff.label}
                  </span>
                </div>
                <h3 className="font-heading font-semibold mb-1.5 group-hover:text-primary transition-colors">{topic.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2">{topic.summary}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {topic.read_time || 3} min read
                  </span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                    {CATEGORY_ICONS[selected.category] || '🛡️'}
                  </div>
                  <div>
                    <DialogTitle className="font-heading">{selected.title}</DialogTitle>
                    <DialogDescription>{selected.summary}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{selected.content || selected.summary}</ReactMarkdown>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}