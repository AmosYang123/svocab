import React, { useState } from 'react';
import { BookOpen, GraduationCap, Layers, Check } from 'lucide-react';

interface DeckSelectionModalProps {
  currentShowDefault: boolean;
  currentShowSat: boolean;
  onSelectDeck: (showDefault: boolean, showSat: boolean) => void;
}

export default function DeckSelectionModal({
  onSelectDeck
}: DeckSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<'sat' | 'ssat' | 'both' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const options = [
    {
      id: 'sat' as const,
      title: 'SAT',
      subtitle: '~1,270 Words',
      description: 'Digital SAT high-frequency vocabulary.',
      icon: GraduationCap,
      showDefault: false,
      showSat: true,
    },
    {
      id: 'ssat' as const,
      title: 'SSAT',
      subtitle: '~625 Words',
      description: 'Middle & Upper Level SSAT preparation.',
      icon: BookOpen,
      showDefault: true,
      showSat: false,
    },
    {
      id: 'both' as const,
      title: 'Combined',
      subtitle: '~1,895 Words',
      description: 'All SSAT & SAT words together.',
      icon: Layers,
      showDefault: true,
      showSat: true,
    },
  ];

  const handleSubmit = () => {
    if (!selectedId || isSubmitting) return;
    const selectedOption = options.find(o => o.id === selectedId);
    if (!selectedOption) return;

    setIsSubmitting(true);
    setIsSubmitted(true);

    setTimeout(() => {
      onSelectDeck(selectedOption.showDefault, selectedOption.showSat);
    }, 450);
  };

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
            const isSelected = selectedId === opt.id;
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedId(opt.id)}
                className={`relative flex flex-col items-center text-center p-4 rounded-lg border transition-all cursor-pointer select-none ${
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

                <div className="mt-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 bg-transparent'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Submit Action & Footnote */}
        <div className="space-y-3 pt-3 border-t border-border">
          <button
            type="button"
            disabled={!selectedId || isSubmitting}
            onClick={handleSubmit}
            className={`w-full py-2.5 px-6 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm ${
              isSubmitted
                ? 'bg-emerald-600 text-white'
                : selectedId
                  ? 'bg-primary text-primary-foreground hover:opacity-95 active:scale-[0.99]'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
            }`}
          >
            {isSubmitted ? (
              <>
                <Check className="w-4 h-4 stroke-[3] animate-in zoom-in-50" />
                <span>Submitted</span>
              </>
            ) : (
              <span>Submit Selection</span>
            )}
          </button>

          <p className="text-center text-[11px] text-muted-foreground font-mono">
            Note: You can change your deck selection anytime in <span className="text-foreground font-semibold">Settings</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
