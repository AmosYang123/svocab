import React, { memo } from 'react';
import { ArrowUpRight, ArrowDownRight, Award, Brain, Bookmark, BookOpen } from 'lucide-react';

interface StatsDashboardProps {
  stats: {
    mastered: number;
    review: number;
    marked: number;
    notStudied: number;
    total: number;
  };
  onMasteredClick: () => void;
  onReviewClick: () => void;
  onMarkedClick: () => void;
}

const StatsDashboard: React.FC<StatsDashboardProps> = memo(({ stats, onMasteredClick, onReviewClick, onMarkedClick }) => {
  const masteredPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
  const reviewPct = stats.total > 0 ? Math.round((stats.review / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {/* Card 1: Mastered */}
      <button
        onClick={onMasteredClick}
        className="bg-muted/30 hover:bg-muted/60 border border-border/80 rounded-xl md:rounded-2xl p-4 flex flex-col justify-between text-left transition-all group active:scale-[0.99]"
      >
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-xs font-medium text-muted-foreground">Mastered Words</span>
          <span className="flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ArrowUpRight className="w-3 h-3 mr-0.5" />
            {masteredPct}%
          </span>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-1">
          {stats.mastered.toLocaleString()}
        </div>
        <div className="text-[11px] text-muted-foreground font-medium truncate">
          Fully memorized & retained
        </div>
      </button>

      {/* Card 2: Review Needed */}
      <button
        onClick={onReviewClick}
        className="bg-muted/30 hover:bg-muted/60 border border-border/80 rounded-xl md:rounded-2xl p-4 flex flex-col justify-between text-left transition-all group active:scale-[0.99]"
      >
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-xs font-medium text-muted-foreground">Review Needed</span>
          <span className="flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Brain className="w-3 h-3 mr-0.5" />
            {reviewPct}%
          </span>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-1">
          {stats.review.toLocaleString()}
        </div>
        <div className="text-[11px] text-muted-foreground font-medium truncate">
          Requires active drill
        </div>
      </button>

      {/* Card 3: Marked Bookmarks */}
      <button
        onClick={onMarkedClick}
        className="bg-muted/30 hover:bg-muted/60 border border-border/80 rounded-xl md:rounded-2xl p-4 flex flex-col justify-between text-left transition-all group active:scale-[0.99]"
      >
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-xs font-medium text-muted-foreground">Marked Words</span>
          <span className="flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            <Bookmark className="w-3 h-3 mr-0.5 fill-current" />
            Saved
          </span>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-1">
          {stats.marked.toLocaleString()}
        </div>
        <div className="text-[11px] text-muted-foreground font-medium truncate">
          Starred for high priority
        </div>
      </button>

      {/* Card 4: Total & Unstudied */}
      <div className="bg-muted/30 border border-border/80 rounded-xl md:rounded-2xl p-4 flex flex-col justify-between text-left">
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-xs font-medium text-muted-foreground">New / Unstudied</span>
          <span className="flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            <BookOpen className="w-3 h-3 mr-0.5" />
            Deck
          </span>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-1">
          {stats.notStudied.toLocaleString()}
        </div>
        <div className="text-[11px] text-muted-foreground font-medium truncate">
          Total deck size: {stats.total.toLocaleString()}
        </div>
      </div>
    </div>
  );
});

export default StatsDashboard;