import React, { useState, memo } from 'react';
import { Word, StudyMode, WordStatusMap, MarkedWordsMap, StudySet } from '../types';
import { Icons } from './Icons';

interface ModeSelectorProps {
  currentMode: StudyMode;
  activeSetId: string | null;
  vocab: Word[];
  wordStatuses: WordStatusMap;
  markedWords: MarkedWordsMap;
  savedSets: StudySet[];
  onModeChange: (mode: StudyMode, setId?: string) => void;
  onOpenCustomSelector: () => void;
  onDeleteSet: (id: string) => void;
  onRenameSet: (id: string, newName: string) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = memo(({
  currentMode,
  activeSetId,
  vocab,
  wordStatuses,
  markedWords,
  savedSets,
  onModeChange,
  onOpenCustomSelector,
  onDeleteSet,
  onRenameSet
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const counts = React.useMemo(() => ({
    all: vocab.length,
    mastered: vocab.filter(w => wordStatuses[w.name] === 'mastered').length,
    review: vocab.filter(w => wordStatuses[w.name] === 'review').length,
    marked: vocab.filter(w => markedWords[w.name]).length,
    random: Math.min(vocab.length, 50),
    basic: vocab.filter(w => w.difficulty === 'basic').length,
    easy: vocab.filter(w => w.difficulty === 'easy').length,
    medium: vocab.filter(w => w.difficulty === 'medium').length,
    hard: vocab.filter(w => w.difficulty === 'hard').length,
  }), [vocab, wordStatuses, markedWords]);

  const statusModes = React.useMemo(() => [
    { id: 'all' as StudyMode, label: 'All Total', count: counts.all },
    { id: 'random' as StudyMode, label: 'Mix 50', count: counts.random },
    { id: 'mastered' as StudyMode, label: 'Mastered', count: counts.mastered, disabled: counts.mastered === 0 },
    { id: 'review' as StudyMode, label: 'Review', count: counts.review, disabled: counts.review === 0 },
    { id: 'marked' as StudyMode, label: 'Marked', count: counts.marked, disabled: counts.marked === 0 },
  ], [counts]);

  const difficultyModes = React.useMemo(() => [
    { id: 'basic' as StudyMode, label: 'Basic', count: counts.basic, color: 'teal' },
    { id: 'easy' as StudyMode, label: 'Easy', count: counts.easy, color: 'green' },
    { id: 'medium' as StudyMode, label: 'Medium', count: counts.medium, color: 'yellow' },
    { id: 'hard' as StudyMode, label: 'Hard', count: counts.hard, color: 'red' },
  ], [counts]);

  const handleStartRename = (set: StudySet) => {
    setEditingId(set.id);
    setEditValue(set.name);
  };

  const handleFinishRename = (id: string) => {
    if (editValue.trim()) {
      onRenameSet(id, editValue.trim());
    }
    setEditingId(null);
  };

  const renderModeButton = (mode: { id: StudyMode; label: string; count: number; color?: string; disabled?: boolean }) => {
    const isActive = currentMode === mode.id && !activeSetId;

    return (
      <button
        key={mode.id}
        disabled={mode.disabled}
        onClick={() => onModeChange(mode.id)}
        className={`px-4 py-1.5 rounded-none text-xs font-mono transition-all border uppercase tracking-wider disabled:opacity-30 ${
          isActive
            ? 'bg-primary text-primary-foreground border-primary font-semibold'
            : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
        }`}
      >
        {mode.label} <span className="opacity-60 ml-1">[{mode.count}]</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Unified Status Modes */}
      <div className="flex flex-wrap gap-2 justify-center">
        {statusModes.map(mode => renderModeButton(mode))}
      </div>

      {/* Difficulty Levels (Unified) */}
      <div className="flex flex-wrap gap-2 justify-center">
        {difficultyModes.map(mode => renderModeButton(mode))}
      </div>

      {/* Custom Sets */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-3 px-2">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em]">Groups</h3>
          <button
            onClick={onOpenCustomSelector}
            className="text-[10px] font-semibold text-primary bg-card border border-border px-8 py-1.5 rounded-lg hover:bg-muted transition-colors shadow-xs active:scale-[0.98] uppercase tracking-widest"
          >
            + Create Group
          </button>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {savedSets.map(set => (
            <div
              key={set.id}
              className="relative flex items-center h-9 group"
              onDoubleClick={() => handleStartRename(set)}
            >
              {editingId === set.id ? (
                <div className="flex items-center bg-card border-2 border-primary rounded-lg px-4 h-full shadow-sm z-50">
                  <input
                    autoFocus
                    type="text"
                    className="text-xs font-semibold text-foreground outline-none w-32 bg-transparent"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFinishRename(set.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename(set.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                </div>
              ) : (
                <div className={`flex items-center rounded-lg overflow-hidden border-2 transition-all shadow-xs
                  ${activeSetId === set.id
                    ? 'border-primary bg-primary shadow-sm'
                    : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <button
                    onClick={() => onModeChange('custom', set.id)}
                    className={`px-6 h-full text-left flex items-center gap-2 max-w-[180px]
                      ${activeSetId === set.id ? 'text-primary-foreground' : 'text-foreground'}`}
                  >
                    <span className="text-[10px] font-semibold truncate uppercase tracking-tighter">{set.name}</span>
                    <span className={`text-[9px] font-semibold ${activeSetId === set.id ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {set.wordNames.length}
                    </span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteSet(set.id);
                    }}
                    className={`w-9 h-full flex items-center justify-center border-l transition-colors
                      ${activeSetId === set.id
                        ? 'border-primary-foreground/20 text-primary-foreground/40 hover:bg-destructive hover:text-primary-foreground'
                        : 'border-border text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive'
                      }`}
                  >
                    <Icons.Close />
                  </button>
                </div>
              )}
            </div>
          ))}
          {savedSets.length === 0 && (
            <div className="text-[10px] text-muted-foreground font-mono py-2 px-2 uppercase tracking-[0.3em]">
              No Custom Groups
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ModeSelector;