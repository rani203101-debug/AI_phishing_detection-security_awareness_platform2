import React, { useState, useEffect, useCallback } from 'react';
import { GraduationCap, CheckCircle2, XCircle, ChevronRight, RotateCcw, Trophy, Flame, Zap, ShieldCheck, Sparkles, Loader2, Award } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { BADGES, checkNewBadges } from '@/lib/badges';
import { cn } from '@/lib/utils';

const BADGE_ICONS = { Sparkles, GraduationCap, Trophy, Flame, Zap, ShieldCheck, Award };

export default function Train() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('intro'); // intro | question | feedback | summary
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [sessionAnswers, setSessionAnswers] = useState([]);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [newBadge, setNewBadge] = useState(null);

  const load = useCallback(async () => {
    try {
      const [qPage, progPage] = await Promise.all([
        base44.entities.QuizQuestion.filter({}, { sort: '-created_date', limit: 10 }),
        base44.entities.UserProgress.filter({ created_by_id: user?.id }),
      ]);
      setQuestions(qPage.items || []);
      let prog = progPage?.[0] || null;
      if (!prog) {
        prog = await base44.entities.UserProgress.create({
          total_score: 0,
          streak: 0,
          best_streak: 0,
          badges: [],
          quizzes_completed: 0,
          questions_answered: 0,
        });
      }
      setProgress(prog);
    } catch {
      toast.error('Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const startQuiz = () => {
    setPhase('question');
    setCurrentIdx(0);
    setSessionAnswers([]);
    setSessionScore(0);
    setSelectedIdx(null);
  };

  const handleAnswer = async (idx) => {
    if (selectedIdx !== null) return;
    setSelectedIdx(idx);
    const question = questions[currentIdx];
    const correct = idx === question.correct_index;

    setSessionAnswers((a) => [...a, { correct }]);
    if (correct) setSessionScore((s) => s + 1);

    const newStreak = correct ? sessionStreak + 1 : 0;
    setSessionStreak(newStreak);

    // Save QuizAttempt
    try {
      await base44.entities.QuizAttempt.create({
        question_id: question.id,
        question_text: question.question,
        selected_index: idx,
        correct_index: question.correct_index,
        correct,
        category: question.category,
      });
    } catch { /* non-critical */ }

    // Update UserProgress incrementally so awareness score updates in real-time
    if (progress) {
      try {
        const updated = {
          total_score: (progress.total_score || 0) + (correct ? 1 : 0),
          questions_answered: (progress.questions_answered || 0) + 1,
          best_streak: Math.max(progress.best_streak || 0, newStreak),
          last_quiz_date: new Date().toISOString(),
        };

        const tempProgress = { ...progress, ...updated };
        const newBadges = checkNewBadges(tempProgress);
        if (newBadges.length > 0) {
          updated.badges = [...(progress.badges || []), ...newBadges.map(b => b.id)];
        }

        const result = await base44.entities.UserProgress.update(progress.id, updated);
        setProgress(result);

        if (newBadges.length > 0) {
          setNewBadge(newBadges[0]);
          setTimeout(() => setNewBadge(null), 4000);
        }
      } catch { /* non-critical */ }
    }

    setPhase('feedback');
  };

  const nextQuestion = async () => {
    if (currentIdx + 1 >= questions.length) {
      // Summary — update quiz completion streak (total_score already updated per-question)
      try {
        const correctCount = sessionAnswers.filter(a => a.correct).length + (selectedIdx === questions[currentIdx].correct_index ? 1 : 0);
        const perfectQuiz = correctCount === questions.length;
        const updated = {
          streak: perfectQuiz ? (progress.streak || 0) + 1 : 0,
          quizzes_completed: (progress.quizzes_completed || 0) + 1,
        };
        const result = await base44.entities.UserProgress.update(progress.id, updated);
        setProgress(result);
      } catch {
        toast.error('Failed to save progress');
      }
      setPhase('summary');
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedIdx(null);
      setPhase('question');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No quiz questions yet</h2>
        <p className="text-muted-foreground">Quiz questions are being prepared. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
      {/* Badge animation */}
      {newBadge && <BadgePopup badge={newBadge} />}

      {/* Progress bar */}
      {phase !== 'intro' && phase !== 'summary' && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Question {currentIdx + 1} of {questions.length}</span>
            <span>Score: {sessionScore}</span>
          </div>
          <Progress value={((currentIdx + (phase === 'feedback' ? 1 : 0)) / questions.length) * 100} className="h-1.5" />
        </div>
      )}

      {/* Intro */}
      {phase === 'intro' && (
        <div className="animate-fade-in-up text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6 glow-primary">
            <GraduationCap className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold mb-3">Phishing Awareness Quiz</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Test your ability to spot phishing. {questions.length} questions — can you get them all right?
          </p>

          {/* Stats */}
          {progress && (
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-8">
              <StatBox icon={Trophy} label="Total Score" value={progress.total_score || 0} />
              <StatBox icon={Flame} label="Best Streak" value={progress.best_streak || 0} />
              <StatBox icon={ShieldCheck} label="Badges" value={progress.badges?.length || 0} />
            </div>
          )}

          {/* Badges earned */}
          {progress?.badges?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {progress.badges.map((badgeId) => {
                const badge = BADGES.find(b => b.id === badgeId);
                if (!badge) return null;
                const Icon = BADGE_ICONS[badge.icon] || Award;
                return (
                  <div key={badgeId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    {badge.name}
                  </div>
                );
              })}
            </div>
          )}

          <Button onClick={startQuiz} size="lg" className="gap-2 group">
            Start quiz
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      )}

      {/* Question */}
      {phase === 'question' && (
        <QuestionCard
          question={questions[currentIdx]}
          selectedIdx={selectedIdx}
          onSelect={handleAnswer}
        />
      )}

      {/* Feedback */}
      {phase === 'feedback' && (
        <FeedbackCard
          question={questions[currentIdx]}
          selectedIdx={selectedIdx}
          onNext={nextQuestion}
          isLast={currentIdx + 1 >= questions.length}
        />
      )}

      {/* Summary */}
      {phase === 'summary' && (
        <SummaryCard
          score={sessionScore}
          total={questions.length}
          onRestart={startQuiz}
          progress={progress}
        />
      )}
    </div>
  );
}

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="glass-card rounded-xl p-3 text-center">
      <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
      <div className="font-heading text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function QuestionCard({ question, selectedIdx, onSelect }) {
  return (
    <div className="animate-fade-in-up">
      <div className="text-xs font-mono uppercase tracking-wider text-primary mb-3">
        {question.category}
      </div>
      <h2 className="font-heading text-xl font-semibold mb-6 leading-relaxed">{question.question}</h2>
      <div className="space-y-2.5">
        {question.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            disabled={selectedIdx !== null}
            className={cn(
              'w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-3',
              'hover:border-primary/30 hover:bg-primary/5',
              selectedIdx === idx && 'border-primary bg-primary/10'
            )}
          >
            <div className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
              selectedIdx === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {String.fromCharCode(65 + idx)}
            </div>
            <span className="text-sm">{option}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackCard({ question, selectedIdx, onNext, isLast }) {
  const correct = selectedIdx === question.correct_index;
  return (
    <div className="animate-fade-in">
      <div className={cn(
        'rounded-2xl p-5 border mb-4',
        correct ? 'bg-safe/10 border-safe/30' : 'bg-phishing/10 border-phishing/30'
      )}>
        <div className="flex items-center gap-3 mb-3">
          {correct ? <CheckCircle2 className="w-7 h-7 text-safe" /> : <XCircle className="w-7 h-7 text-phishing" />}
          <h3 className="font-heading text-lg font-bold">
            {correct ? 'Correct!' : 'Not quite'}
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground mb-3">{question.explanation}</p>
        <div className="text-xs space-y-1">
          <p><span className="text-muted-foreground">Your answer:</span> {question.options[selectedIdx]}</p>
          {!correct && <p><span className="text-muted-foreground">Correct answer:</span> {question.options[question.correct_index]}</p>}
        </div>
      </div>
      <Button onClick={onNext} className="w-full gap-2" size="lg">
        {isLast ? 'See results' : 'Next question'}
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function SummaryCard({ score, total, onRestart, progress }) {
  const percentage = Math.round((score / total) * 100);
  const message = percentage === 100 ? 'Perfect score! 🎉' : percentage >= 70 ? 'Great job!' : percentage >= 50 ? 'Good effort!' : 'Keep practicing!';

  return (
    <div className="animate-fade-in-up text-center">
      <div className={cn(
        'w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6',
        percentage >= 70 ? 'bg-safe/10 border-2 border-safe/30' : 'bg-suspicious/10 border-2 border-suspicious/30'
      )}>
        <span className="font-heading text-3xl font-bold">{percentage}%</span>
      </div>
      <h2 className="font-heading text-2xl font-bold mb-2">{message}</h2>
      <p className="text-muted-foreground mb-6">You got {score} out of {total} correct</p>

      {progress && (
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-8">
          <StatBox icon={Trophy} label="Total Score" value={progress.total_score || 0} />
          <StatBox icon={Flame} label="Streak" value={progress.streak || 0} />
          <StatBox icon={ShieldCheck} label="Badges" value={progress.badges?.length || 0} />
        </div>
      )}

      <Button onClick={onRestart} variant="outline" size="lg" className="gap-2">
        <RotateCcw className="w-4 h-4" /> Try again
      </Button>
    </div>
  );
}

function BadgePopup({ badge }) {
  const Icon = BADGE_ICONS[badge.icon] || Award;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-badge-pop">
      <div className="glass-card rounded-2xl p-5 border-2 border-primary/40 glow-primary flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center">
          <Icon className="w-7 h-7 text-primary" />
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-primary">Badge unlocked!</div>
          <div className="font-heading font-bold text-lg">{badge.name}</div>
          <div className="text-xs text-muted-foreground">{badge.description}</div>
        </div>
      </div>
    </div>
  );
}