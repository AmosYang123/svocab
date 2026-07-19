import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Loader2, ChevronRight, X } from 'lucide-react';
import { searchWordsByMeaning } from '../services/aiSearchService';
import { Word } from '../types';

interface AIWordSearchProps {
    availableWords: Word[];
    onSelectWord: (wordName: string) => void;
    onClose: () => void;
}

export function AIWordSearch({ availableWords, onSelectWord, onClose }: AIWordSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Word[]>([]);
    const [isAiMode, setIsAiMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-clear error after 15 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 15000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Simple local search
    const performLocalSearch = (q: string) => {
        if (!q) {
            setResults([]);
            return;
        }
        const lowerQ = q.toLowerCase();
        const matches = availableWords.filter(w =>
            w.name.toLowerCase().includes(lowerQ)
        ).slice(0, 5);
        setResults(matches);
    };

    // AI Search
    const performAiSearch = async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        setError('');
        setResults([]);

        try {
            const matches = await searchWordsByMeaning(query, availableWords);
            if (matches.length === 0) {
                setError('No matching words found based on meaning.');
            }
            setResults(matches);
        } catch (e) {
            setError('Failed to perform AI search.');
        } finally {
            setIsLoading(false);
        }
    };

    // Debounce/Listen to query changes
    useEffect(() => {
        if (!isAiMode) {
            performLocalSearch(query);
        }
    }, [query, isAiMode]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (isAiMode) {
                performAiSearch();
            } else if (results.length > 0) {
                onSelectWord(results[0].name);
            }
        }
    };

    return (
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border w-full max-w-md animate-in slide-in-from-top-2 duration-200 relative">
            <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-primary transition-colors">
                <X className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    {isAiMode ? 'AI Semantic Search' : 'Quick Jump'}
                </span>
                <button
                    onClick={() => { setIsAiMode(!isAiMode); setResults([]); setError(''); }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold uppercase transition-all ${isAiMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}
                >
                    <Sparkles className="w-3 h-3" />
                    {isAiMode ? 'AI Active' : 'Enable AI'}
                </button>
            </div>

            <div className="flex gap-2 relative">
                <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isAiMode ? "Describe definition or meaning..." : "Type word name..."}
                    className={`flex-1 bg-background text-foreground border-2 rounded-lg px-4 py-2.5 text-sm outline-none font-medium placeholder:text-muted-foreground/60 transition-colors ${isAiMode ? 'border-primary/60 focus:border-primary' : 'border-input focus:border-ring'}`}
                    onKeyDown={handleKeyDown}
                />
                <button
                    onClick={() => isAiMode ? performAiSearch() : (results.length > 0 && onSelectWord(results[0].name))}
                    disabled={isLoading || !query}
                    className={`px-4 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-[0.98] ${isAiMode ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-foreground text-background hover:opacity-90'}`}
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isAiMode ? <Sparkles className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />)}
                </button>
            </div>

            {/* Results Dropdown */}
            {(results.length > 0 || error) && (
                <div className="mt-3 flex flex-col gap-1 max-h-60 overflow-y-auto custom-scrollbar">
                    {error && <div className="text-xs text-red-500 font-medium px-1">{error}</div>}
                    {results.map((word) => (
                        <button
                            key={word.name}
                            onClick={() => onSelectWord(word.name)}
                            className="text-left w-full px-3 py-2.5 rounded-lg hover:bg-muted border border-transparent hover:border-border transition-all flex items-start gap-3 group"
                        >
                            <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/40 group-hover:bg-primary transition-colors shrink-0" />
                            <div>
                                <div className="text-sm font-semibold text-foreground group-hover:text-primary">{word.name}</div>
                                <div className="text-xs text-muted-foreground line-clamp-1">{word.definition}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AIWordSearch;
