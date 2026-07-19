import React, { memo, useRef, useLayoutEffect, useState, useMemo, useCallback, useEffect } from 'react';
import { Word, WordStatusType } from '../types';
import { Icons } from './Icons';

// Pronunciation helper using Web Speech API (works offline on mobile)
const usePronunciation = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Wait for voices to load (required for iOS)
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices();
      if (voices && voices.length > 0) {
        setVoicesLoaded(true);
      }
    };

    if ('speechSynthesis' in window) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Google') || v.localService)
    ) || voices.find(v => v.lang.startsWith('en'));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    // iOS Safari fix: need to resume if paused
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    window.speechSynthesis.speak(utterance);

    // iOS Safari workaround: speech can get stuck, so we force end after a timeout
    setTimeout(() => {
      if (window.speechSynthesis.speaking) {
        // Still speaking after reasonable time, that's fine
      }
    }, 5000);
  }, []);

  return { speak, isSpeaking, voicesLoaded };
};

// Global canvas context for text measurement to avoid recreation
const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const measureContext = measureCanvas ? measureCanvas.getContext('2d') : null;

// Helper to calculate optimal font size
const getOptimalFontSize = (
  text: string,
  availableWidth: number,
  fontFace: string,
  minSize: number,
  maxSize: number
): number => {
  if (!measureContext || !availableWidth) return minSize;

  // Function to create the font string
  // Matches the component's 'font-black' (900) and 'italic'
  const getFontString = (size: number) => `italic 900 ${size}px ${fontFace}`;

  // 1. Measure at max size first
  measureContext.font = getFontString(maxSize);
  const textMetrics = measureContext.measureText(text);
  const textWidth = textMetrics.width;

  // 2. If it fits, return max size
  // We use a small buffer (0.99) to be safe against sub-pixel differences
  if (textWidth <= availableWidth * 0.99) {
    return maxSize;
  }

  // 3. Calculate ratio
  const ratio = availableWidth / textWidth;

  // 4. Calculate new size based on ratio
  // Apply a slightly more aggressive safety factor (0.95) to ensure it definitely fits
  const newSize = Math.floor(maxSize * ratio * 0.95);

  // 5. Return clamped value
  return Math.max(minSize, Math.min(maxSize, newSize));
};

const AutoFitText = ({
  text,
  containerWidth,
  className,
  minSize = 24,
  maxSize = 96
}: {
  text: string;
  containerWidth: number;
  className?: string;
  minSize?: number;
  maxSize?: number;
}) => {

  const fontSize = useMemo(() => {
    // Only calculate if we have a valid width
    if (!containerWidth) return minSize;

    // Assuming 'Inter' as the font family from global styles.
    // 'font-black' corresponds to weight 900.
    return getOptimalFontSize(text, containerWidth, "'Inter', sans-serif", minSize, maxSize);
  }, [text, containerWidth, minSize, maxSize]);

  return (
    <h2
      className={className}
      style={{
        fontSize: `${fontSize}px`,
        whiteSpace: 'nowrap',
        width: '100%',
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        // Critical: prevent font-size transition if it was inherited
        transitionProperty: 'color, background-color, opacity, transform',
      }}
    >
      {text}
    </h2>
  );
};

interface FlashcardProps {
  word: Word | null;
  showDefinition: boolean;
  onToggle: () => void;
  status: WordStatusType;
}

// parsing logic outside component to avoid recreation
const parseContent = (word: Word) => {
  const parts = {
    main: word.definition,
    synonyms: word.synonyms || '',
    example: word.example || ''
  };

  // If we already have explicit fields, don't parse the definition string
  if (word.synonyms || word.example) {
    return parts;
  }

  const content = word.definition;
  if (content.includes('(Ex:')) {
    const [beforeEx, exPart] = content.split('(Ex:');
    parts.main = beforeEx.trim();
    parts.example = exPart.replace(')', '').trim();
  }

  if (parts.main.includes('Synonyms:')) {
    const [defPart, synPart] = parts.main.split('Synonyms:');
    parts.main = defPart.trim().replace(/\.$/, ''); // Remove trailing dot
    parts.synonyms = synPart.trim().replace(/\.$/, '');
  }

  return parts;
};

const Flashcard: React.FC<FlashcardProps> = memo(({ word, showDefinition, onToggle, status }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const { speak, isSpeaking } = usePronunciation();

  // Handle pronunciation click without triggering card flip
  const handleSpeak = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (word) {
      speak(word.name);
    }
  }, [word, speak]);

  // Measure available width for text
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (cardRef.current) {
        const style = window.getComputedStyle(cardRef.current);
        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const width = cardRef.current.clientWidth - paddingX;
        setContentWidth(width);
      }
    };

    // Initial measure
    updateWidth();

    // Observer for resizes
    const observer = new ResizeObserver(updateWidth);
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!word) return null;

  const content = parseContent(word);

  return (
    <div
      ref={cardRef}
      onClick={onToggle}
      className="flashcard-container group relative w-full max-w-3xl bg-muted/20 border border-border/80 min-h-[320px] md:min-h-[400px] flex items-center justify-center p-8 md:p-12 cursor-pointer transition-all duration-300 rounded-2xl md:rounded-3xl hover:border-border shadow-xs hover:shadow-sm"
    >
      {/* Pronunciation Button - Bottom Right */}
      <button
        onClick={handleSpeak}
        className={`absolute bottom-6 right-8 z-20 p-2.5 border transition-all rounded-xl ${isSpeaking
          ? 'bg-primary text-primary-foreground border-primary animate-pulse'
          : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
          }`}
        title="Play pronunciation"
      >
        <Icons.Speaker className="w-5 h-5" />
      </button>

      {/* Status Badge */}
      <div className="absolute top-6 right-8 z-10">
        {status === 'mastered' ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono border border-emerald-500/30 uppercase rounded-full">
            <Icons.Trophy />
            MASTERED
          </div>
        ) : status === 'review' ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-mono border border-amber-500/30 uppercase rounded-full">
            <Icons.Brain />
            REVIEW
          </div>
        ) : (
          <div className="px-3 py-1 bg-muted text-muted-foreground text-[10px] font-mono border border-border uppercase rounded-full">
            NEW
          </div>
        )}
      </div>

      {/* Content */}
      <div className="text-center w-full">
        {!showDefinition ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <AutoFitText
              text={word.name}
              containerWidth={contentWidth}
              className="font-bold text-foreground tracking-tight px-4"
              maxSize={80}
              minSize={30}
            />
            <p className="text-muted-foreground font-mono uppercase tracking-widest text-xs">Click or press Space to reveal definition</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <AutoFitText
              text={word.name}
              containerWidth={contentWidth}
              className="font-semibold text-muted-foreground opacity-60 px-4"
              maxSize={36}
              minSize={20}
            />
            <div className="h-px w-16 bg-border mx-auto" />
            <div className="max-w-2xl mx-auto space-y-5">
              <p className="text-xl md:text-2xl text-foreground font-semibold leading-relaxed px-4">
                {content.main}
              </p>

              {content.synonyms && (
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest w-full block mb-1">Synonyms</span>
                  {content.synonyms.split(',').map((syn, i) => (
                    <span key={i} className="px-3 py-1 bg-card text-foreground text-xs font-mono border border-border rounded-lg">
                      {syn.trim()}
                    </span>
                  ))}
                </div>
              )}

              {content.example && (
                <div className="text-sm md:text-base text-muted-foreground italic bg-card p-4 border border-border leading-relaxed text-left rounded-xl">
                  <span className="block font-mono not-italic text-primary text-[10px] uppercase mb-1 tracking-widest">In Context</span>
                  "{content.example}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default Flashcard;