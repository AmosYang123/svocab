import React from 'react';
import { BookOpen, GraduationCap, Layers, Sparkles, Check } from 'lucide-react';

interface DeckSelectionModalProps {
  currentShowDefault: boolean;
  currentShowSat: boolean;
  onSelectDeck: (showDefault: boolean, showSat: boolean) => void;
}

export default function DeckSelectionModal({
  currentShowDefault,
  currentShowSat,
  onSelectDeck
}: DeckSelectionModalProps) {
  const options = [
    {
      id: 'ssat',
      title: 'SSAT Vocabulary',
      subtitle: '~1,000 Essential Words',
      description: 'Curated specifically for Middle & Upper Level SSAT preparation.',
      badge: 'SSAT Focus',
      icon: BookOpen,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
      showDefault: true,
      showSat: false,
    },
    {
      id: 'sat',
      title: 'SAT Vocabulary',
      subtitle: '~3,000 High-Frequency Words',
      description: 'Extensive high-frequency words tailored for the Digital SAT exam.',
      badge: 'SAT Focus',
      icon: GraduationCap,
      color: 'from-indigo-500/20 to-blue-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      showDefault: false,
      showSat: true,
    },
    {
      id: 'both',
      title: 'Both Decks (Combined)',
      subtitle: '~4,000 Total Words',
      description: 'Combine all SSAT & SAT words for maximum vocabulary mastery.',
      badge: 'All-In-One',
      icon: Layers,
      color: 'from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
      showDefault: true,
      showSat: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 md:p-8 text-center border-b border-border bg-muted/30">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4 shadow-sm">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight mb-2">
            Select Your Vocabulary Goal
          </h2>
          <p className="text-sm text-muted-foreground font-medium max-w-lg mx-auto">
            Choose which vocabulary deck you want to study.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-xs font-semibold">
            <span>💡 Don't worry, you can easily change this anytime later in Settings!</span>
          </div>
        </div>

        {/* Deck Cards */}
        <div className="p-6 md:p-8 space-y-4 overflow-y-auto custom-scrollbar">
          {options.map((opt) => {
            const isSelected = 
              (opt.id === 'ssat' && currentShowDefault && !currentShowSat) ||
              (opt.id === 'sat' && !currentShowDefault && currentShowSat) ||
              (opt.id === 'both' && currentShowDefault && currentShowSat);
            const Icon = opt.icon;

            return (
              <div
                key={opt.id}
                onClick={() => onSelectDeck(opt.showDefault, opt.showSat)}
                className={`group relative p-5 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-5 ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md scale-[1.01]'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${opt.color} border shadow-xs group-hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-foreground text-base tracking-tight">
                      {opt.title}
                    </h3>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${opt.color}`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">
                    {opt.description}
                  </p>
                  <span className="text-[11px] font-mono text-primary font-semibold">
                    {opt.subtitle}
                  </span>
                </div>

                <div className="shrink-0">
                  <button
                    className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Choose'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
