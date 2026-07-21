import React, { useState, useEffect, useRef } from 'react';
import { Search, X, BookOpen } from 'lucide-react';
import { Word } from '../types';

interface AIWordSearchProps {
    availableWords: Word[];
    onSelectWord: (wordName: string) => void;
    onClose: () => void;
}

interface MatchResult {
    word: Word;
    matchType: 'name' | 'meaning';
}

export function AIWordSearch({ availableWords, onSelectWord, onClose }: AIWordSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MatchResult[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Instant local search across Word Name, Definition, and Synonyms
    useEffect(() => {
        const cleanQ = query.trim().toLowerCase();
        if (!cleanQ) {
            setResults([]);
            return;
        }

        const nameMatches: MatchResult[] = [];
        const meaningMatches: MatchResult[] = [];

        availableWords.forEach(w => {
            const nameLower = w.name.toLowerCase();
            const defLower = (w.definition || '').toLowerCase();
            const synonymsLower = (w.synonyms || '').toLowerCase();

            if (nameLower.includes(cleanQ)) {
                nameMatches.push({ word: w, matchType: 'name' });
            } else if (defLower.includes(cleanQ) || synonymsLower.includes(cleanQ)) {
                meaningMatches.push({ word: w, matchType: 'meaning' });
            }
        });

        // Priority: Name matches first, then Meaning matches
        setResults([...nameMatches, ...meaningMatches].slice(0, 6));
    }, [query, availableWords]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && results.length > 0) {
            onSelectWord(results[0].word.name);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="bg-card p-2 rounded-xl shadow-lg border border-border w-full max-w-lg animate-in slide-in-from-top-1 duration-150 relative">
            {/* Slim Input Bar */}
            <div className="flex items-center gap-2 px-2 py-1 bg-background rounded-lg border border-input focus-within:border-primary transition-colors">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />

                <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Quick Jump: Type word or definition..."
                    className="flex-1 bg-transparent text-foreground text-xs md:text-sm font-medium outline-none placeholder:text-muted-foreground/60 py-1"
                    onKeyDown={handleKeyDown}
                />

                <button
                    onClick={onClose}
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors shrink-0"
                    title="Close (Esc)"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Results List */}
            {query.trim() !== '' && (
                <div className="mt-1.5 max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 divide-y divide-border/40">
                    {results.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic px-2 py-2 text-center">
                            No matching word or definition found.
                        </div>
                    ) : (
                        results.map(({ word, matchType }) => (
                            <button
                                key={word.name}
                                onClick={() => onSelectWord(word.name)}
                                className="text-left w-full px-2.5 py-1.5 rounded-md hover:bg-muted/70 transition-all flex items-center justify-between gap-3 group"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs md:text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                            {word.name}
                                        </span>
                                        {matchType === 'meaning' && (
                                            <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                                <BookOpen className="w-2.5 h-2.5" /> Definition match
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground truncate leading-snug">
                                        {word.definition}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default AIWordSearch;


