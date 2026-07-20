import React from 'react';
import { BookOpen, GraduationCap, Layers, Check } from 'lucide-react';

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
      id: 'sat',
      title: 'SAT',
      subtitle: '~3,000 Words',
      description: 'Digital SAT high-frequency vocabulary.',
      icon: GraduationCap,
      showDefault: false,
      showSat: true,
    },
    {
      id: 'ssat',
      title: 'SSAT',
      subtitle: '~1,000 Words',
      description: 'Middle & Upper Level SSAT preparation.',
      icon: BookOpen,
      showDefault: true,
      showSat: false,
    },
    {
      id: 'both',
      title: 'Combined',
      subtitle: '~4,000 Words',
      description: 'All SSAT & SAT words together.',
      icon: Layers,
      showDefault: true,
      showSat: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-xl overflow-hidden p-6 text-foreground">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold tracking-tight mb-1">
            Choose Study Target
          </h2>
          <p className="text-xs text-muted-foreground font-medium">
            Select your primary vocabulary deck to start studying.
          </p>
        </div>

        {/* Horizontal Deck Cards (SAT -> SSAT -> Combined) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {options.map((opt) => {
            const isSelected =
              (opt.id === 'ssat' && currentShowDefault && !currentShowSat) ||
              (opt.id === 'sat' && !currentShowDefault && currentShowSat) ||
              (opt.id === 'both' && currentShowDefault && currentShowSat);
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectDeck(opt.showDefault, opt.showSat)}
                className={`relative flex flex-col items-center text-center p-4 rounded-lg border text-left transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground shadow-xs ring-1 ring-primary'
                    : 'border-border bg-card hover:border-primary/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className={`w-9 h-9 rounded-md flex items-center justify-center mb-2.5 transition-colors ${
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="font-bold text-sm text-foreground tracking-tight mb-0.5">
                  {opt.title}
                </div>

                <div className="text-[10px] font-mono text-primary font-semibold mb-1.5">
                  {opt.subtitle}
                </div>

                <div className="text-[11px] text-muted-foreground leading-tight">
                  {opt.description}
                </div>

                {isSelected && (
                  <div className="mt-3 text-[10px] font-mono font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" /> Active
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Minimalist Reassurance Footnote */}
        <p className="text-center text-[11px] text-muted-foreground font-mono">
          Note: You can change your deck selection anytime in <span className="text-foreground font-semibold">Settings</span>.
        </p>
      </div>
    </div>
  );
}
