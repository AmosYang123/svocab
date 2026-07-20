import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Word, WordStatusMap, MarkedWordsMap } from '../types';
import { Icons } from './Icons';

interface WordSelectorModalProps {
  vocab: Word[];
  wordStatuses: WordStatusMap;
  markedWords: MarkedWordsMap;
  setCount: number;
  lastImportedNames?: string[];
  onClose: () => void;
  onSave: (name: string, selectedNames: string[]) => void;
}

const ITEMS_PER_PAGE = 100;

const WordSelectorModal: React.FC<WordSelectorModalProps> = ({
  vocab,
  wordStatuses,
  markedWords,
  setCount,
  lastImportedNames = [],
  onClose,
  onSave
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [setName, setSetName] = useState(`Set ${setCount + 1}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [showIndicators, setShowIndicators] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reviewWords = useMemo(() => {
    return vocab.filter(w => wordStatuses[w.name] === 'review');
  }, [vocab, wordStatuses]);

  const handleApplyReviewBatch = useCallback((setNum: number) => {
    if (setNum < 1) return;

    const startIndex = (setNum - 1) * 10;
    const batch = reviewWords.slice(startIndex, startIndex + 10);

    if (batch.length === 0) {
      setErrorMessage("No words marked review for this set");
      // Auto-clear after 15 seconds
      setTimeout(() => setErrorMessage(null), 15000);
      return;
    }

    setErrorMessage(null);
    const newSelected = new Set(selected);
    batch.forEach(w => newSelected.add(w.name));
    setSelected(newSelected);
    setSetName(`Review Batch ${setNum}`);
  }, [reviewWords, selected]);

  const filteredVocab = useMemo(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    if (!searchTerm.trim()) return vocab;
    const lowerSearch = searchTerm.toLowerCase();
    return vocab.filter(w =>
      w.name.toLowerCase().includes(lowerSearch) ||
      w.definition.toLowerCase().includes(lowerSearch)
    );
  }, [vocab, searchTerm]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 500) {
      if (visibleCount < filteredVocab.length) {
        setVisibleCount(prev => prev + ITEMS_PER_PAGE);
      }
    }
  }, [visibleCount, filteredVocab.length]);

  const handleToggle = useCallback((wordName: string, index: number, isShift: boolean) => {
    const newSelected = new Set(selected);
    if (isShift && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(filteredVocab[i].name);
      }
    } else {
      if (newSelected.has(wordName)) newSelected.delete(wordName);
      else newSelected.add(wordName);
    }
    setSelected(newSelected);
    setLastClickedIndex(index);
  }, [selected, lastClickedIndex, filteredVocab]);

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/40';
      case 'medium': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40';
      case 'easy': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40';
      case 'basic': return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/40';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background text-foreground flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex-1">
          <input
            type="text"
            className="text-2xl font-black text-foreground bg-transparent border-b-4 border-primary focus:border-primary/80 outline-none w-full max-w-sm px-2 py-1 transition-colors placeholder:text-muted-foreground/50"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder={`Set ${setCount + 1}`}
          />
        </div>
        <button onClick={onClose} className="p-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg active:scale-95 transition-all">
          <Icons.Close />
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-6 space-y-4 bg-muted/40 border-b border-border shadow-inner">
        <div className="relative">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground z-10">
            <Icons.Search />
          </span>
          <input
            type="text"
            placeholder="Search words..."
            className="w-full bg-card text-foreground border-primary/40 focus:border-primary border-2 rounded-lg pl-14 pr-6 py-3 text-base outline-none focus:ring-4 focus:ring-primary/20 shadow-sm placeholder:text-muted-foreground font-bold transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className={`relative flex items-center gap-2 bg-card px-4 py-1.5 rounded-lg border-2 shadow-sm transition-all ${errorMessage ? 'border-destructive animate-shake' : 'border-border'}`}>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Review Batch #</span>
              <input
                type="number"
                min="1"
                max={Math.max(1, Math.ceil(reviewWords.length / 10))}
                id="set-number-input"
                className="w-14 bg-muted text-foreground font-black px-2 py-0.5 rounded outline-none focus:ring-2 focus:ring-primary transition-all text-center text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const setNum = parseInt((e.target as HTMLInputElement).value);
                    handleApplyReviewBatch(setNum);
                  }
                }}
                placeholder="#"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('set-number-input') as HTMLInputElement;
                  const setNum = parseInt(input?.value || '0');
                  handleApplyReviewBatch(setNum);
                }}
                className="px-3 py-0.5 bg-primary text-primary-foreground rounded text-[10px] font-black hover:opacity-90 active:scale-95 transition-all outline-none"
              >
                GO
              </button>
              {errorMessage && (
                <div className="absolute top-full left-0 mt-3 px-3 py-1.5 bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-widest rounded-md shadow-lg animate-in fade-in slide-in-from-top-1 duration-200 z-[110] whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                    {errorMessage}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { const ns = new Set(selected); filteredVocab.forEach(w => ns.add(w.name)); setSelected(ns); }} className="px-6 py-1.5 bg-primary text-primary-foreground rounded-lg text-[11px] font-black shadow-sm hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest">SELECT ALL</button>
              {lastImportedNames.length > 0 && (
                <button
                  onClick={() => {
                    const ns = new Set(selected);
                    lastImportedNames.forEach(name => ns.add(name));
                    setSelected(ns);
                    setSetName(`Import ${new Date().toLocaleDateString()}`);
                  }}
                  className="px-6 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-[11px] font-black shadow-sm active:scale-95 transition-all uppercase tracking-widest flex items-center gap-2 hover:opacity-90"
                >
                  <Icons.Sparkles className="w-4 h-4" /> RECENT IMPORT
                </button>
              )}
              <button onClick={() => { const ns = new Set(selected); filteredVocab.forEach(w => ns.delete(w.name)); setSelected(ns); }} className="px-6 py-1.5 bg-secondary text-secondary-foreground border border-border rounded-lg text-[11px] font-black shadow-sm hover:bg-muted active:scale-95 transition-all uppercase tracking-widest">CLEAR</button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer group select-none">
              <div
                onClick={() => setShowIndicators(!showIndicators)}
                className={`w-10 h-5 rounded-full transition-colors relative ${showIndicators ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-card rounded-full transition-all ${showIndicators ? 'left-6' : 'left-1'}`} />
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">Show Indicators</span>
            </label>
          </div>

          <div className="text-primary font-black text-[12px] tracking-[0.2em] uppercase bg-primary/10 px-6 py-1.5 rounded-full border border-primary/20">
            {selected.size} WORDS SELECTED
          </div>
        </div>
      </div>

      {/* Grid */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar bg-background">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredVocab.slice(0, visibleCount).map((word, idx) => {
            const status = wordStatuses[word.name];
            const isMarked = markedWords[word.name];

            return (
              <div
                key={word.name}
                onClick={(e) => handleToggle(word.name, idx, e.shiftKey)}
                className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer shadow-xs ${selected.has(word.name) ? 'border-primary bg-primary/10 shadow-sm scale-[1.02]' : 'border-border bg-card hover:border-primary/40'}`}
              >
                {showIndicators && (
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    {/* Status Badge */}
                    <div className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${status === 'mastered' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' :
                      status === 'review' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' :
                        'bg-muted text-muted-foreground border-border'
                      }`}>
                      {status || 'new'}
                    </div>
                    {/* Difficulty Badge */}
                    <div className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${getDifficultyColor(word.difficulty)}`}>
                      {word.difficulty}
                    </div>
                    {/* Flag Badge */}
                    {isMarked && (
                      <div className="text-[8px] bg-destructive/10 text-destructive border border-destructive/30 px-1 py-0.5 rounded font-black">FLAGGED</div>
                    )}
                  </div>
                )}
                <div className="font-black text-foreground text-lg truncate mb-1 italic tracking-tighter">{word.name}</div>
                <p className="text-[11px] text-muted-foreground truncate opacity-80 font-medium">{word.definition}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border bg-card flex justify-center shadow-md">
        <button
          onClick={() => {
            if (selected.size > 0) {
              onSave(setName, Array.from(selected));
            }
          }}
          disabled={selected.size === 0}
          className="w-full max-w-md py-3 px-16 bg-primary text-primary-foreground rounded-lg font-black text-base hover:opacity-90 shadow-xl active:scale-[0.98] transition-all uppercase tracking-[0.3em] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          CREATE GROUP
        </button>
      </div>
    </div>
  );
};

export default WordSelectorModal;