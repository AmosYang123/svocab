import React, { useState, useEffect, useRef } from 'react';
import { Word } from '../types';
import { Icons } from './Icons';
import { expandWordsAI, smartExtractVocabAI } from '../services/groqService';
import * as mammoth from 'mammoth';
import * as pdfjt from 'pdfjs-dist';

// pdfjs worker setup
pdfjt.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjt.version}/build/pdf.worker.min.mjs`;

interface ImportWordsModalProps {
    onClose: () => void;
    onImport: (newWords: Word[]) => void;
    existingVocab: Word[];
}

const ImportWordsModal: React.FC<ImportWordsModalProps> = ({ onClose, onImport, existingVocab }) => {
    const [inputText, setInputText] = useState('');
    const [processedWords, setProcessedWords] = useState<Partial<Word>[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState<'input' | 'preview'>('input');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('AI is thinking...');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-clear error after 15 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 15000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const loadingPhrases = [
        "Analyzing text...",
        "Extracting vocabulary...",
        "Generating definitions...",
        "Finding synonyms...",
        "Creating example sentences...",
        "Almost done..."
    ];

    useEffect(() => {
        let interval: any;
        if (isProcessing) {
            let i = 0;
            interval = setInterval(() => {
                i = (i + 1) % loadingPhrases.length;
                setLoadingMessage(loadingPhrases[i]);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isProcessing]);

    const parseInput = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim());
        const words: Partial<Word>[] = lines.map(line => {
            // Remove common list prefixes (1., -, *, bullet)
            const cleanLine = line.replace(/^\d+[\.\)]\s*/, '').replace(/^[\-\*\•]\s*/, '').trim();
            if (!cleanLine) return [];

            // Check for formats like "word: definition" or "word - definition"
            if (cleanLine.includes(':')) {
                const [name, ...defParts] = cleanLine.split(':');
                return { name: name.trim(), definition: defParts.join(':').trim(), priority: 1 as 1, difficulty: 'medium' as const };
            }
            if (cleanLine.includes(' - ')) {
                const [name, ...defParts] = cleanLine.split(' - ');
                return { name: name.trim(), definition: defParts.join(' - ').trim(), priority: 1 as 1, difficulty: 'medium' as const };
            }
            if (cleanLine.includes('\t')) {
                const [name, ...defParts] = cleanLine.split('\t');
                return { name: name.trim(), definition: defParts.join('\t').trim(), priority: 1 as 1, difficulty: 'medium' as const };
            }
            // Comma separated words on one line
            if (cleanLine.includes(',') && !cleanLine.includes(' ')) {
                return cleanLine.split(',').map(w => ({ name: w.trim(), priority: 1 as 1, difficulty: 'medium' as const }));
            }
            return { name: cleanLine, priority: 1 as 1, difficulty: 'medium' as const };
        }).flat();

        // Final deduplication by name in the preview list itself
        const uniqueWords: Partial<Word>[] = [];
        const seen = new Set();
        words.forEach(w => {
            if (w.name && !seen.has(w.name.toLowerCase())) {
                seen.add(w.name.toLowerCase());
                uniqueWords.push(w);
            }
        });

        return uniqueWords;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setIsProcessing(true);
        let extractedText = "";

        try {
            if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                extractedText = result.value;
            } else if (file.name.endsWith('.pdf')) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjt.getDocument({ data: arrayBuffer }).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    extractedText += content.items.map((item: any) => item.str).join(" ") + "\n";
                }
            } else {
                const reader = new FileReader();
                const textPromise = new Promise<string>((resolve, reject) => {
                    reader.onload = (event) => resolve(event.target?.result as string);
                    reader.onerror = reject;
                });
                reader.readAsText(file);
                extractedText = await textPromise;

                if (extractedText.includes('\u0000') || (extractedText.match(/[\uFFFD]/g) || []).length > 10) {
                    throw new Error("This file looks like a binary file. Please use .txt, .csv, .docx, or .pdf.");
                }
            }

            if (extractedText) {
                setInputText(extractedText);
            }
        } catch (err: any) {
            console.error("File processing error", err);
            setError(err.message || "Failed to process file. Make sure it's a valid document.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSmartAIParse = async (textToUse?: string) => {
        const text = textToUse || inputText;
        if (!text.trim()) return;
        setIsProcessing(true);
        setError(null);
        try {
            // STEP 1: IDENTIFY & ORGANIZE (Smart Extraction)
            let identified = await smartExtractVocabAI(text);

            // FALLBACK: If Smart AI fails completely, use the local parser as a reference
            if (identified.length === 0) {
                console.warn("Smart AI extraction returned empty. Falling back to local parser.");
                const localMapped = parseInput(text);
                if (localMapped.length > 0) {
                    identified = localMapped as any[];
                } else {
                    throw new Error("We couldn't find any words in that text. Try pasting a cleaner list.");
                }
            }

            setStep('preview');

            // STEP 2: AUTOMATICALLY FILL MISSING DATA (Expansion)
            const batchSize = 10;
            const totalBatches = Math.ceil(identified.length / batchSize);
            setProgress({ current: 0, total: totalBatches });

            const expanded: Word[] = [];
            for (let i = 0; i < identified.length; i += batchSize) {
                const batch = identified.slice(i, i + batchSize);
                try {
                    const aiResult = await expandWordsAI(batch.map(w => ({ name: w.name || '', definition: w.definition })));

                    batch.forEach((original) => {
                        const aiMatch = aiResult.find(r => r.name.toLowerCase() === original.name?.toLowerCase());
                        expanded.push({
                            name: original.name || '',
                            definition: (aiMatch?.definition || original.definition || 'No definition found.').trim(),
                            synonyms: aiMatch?.synonyms || original.synonyms || '',
                            example: aiMatch?.example || original.example || '',
                            difficulty: aiMatch?.difficulty || original.difficulty || 'medium',
                            priority: original.priority || 1
                        });
                    });
                } catch (batchErr) {
                    console.error("Batch expansion failed, falling back to original data", batchErr);
                    batch.forEach(o => expanded.push({
                        name: o.name || '',
                        definition: o.definition || 'No definition found.',
                        synonyms: o.synonyms || '',
                        example: o.example || '',
                        difficulty: o.difficulty || 'medium',
                        priority: 1
                    } as Word));
                }
                setProgress({ current: Math.floor(i / batchSize) + 1, total: totalBatches });
                setProcessedWords([...expanded]); // Incremental update for better UI feedback
            }

            setProcessedWords(expanded);
        } catch (err: any) {
            setError(err.message || "AI Extraction failed.");
        } finally {
            setIsProcessing(false);
            setProgress(null);
        }
    };

    const handleProcess = () => {
        const words = parseInput(inputText);
        if (words.length === 0) return;
        setProcessedWords(words);
        setStep('preview');
    };

    const handleSave = () => {
        onImport(processedWords as Word[]);
    };

    return (
        <div className="fixed inset-0 z-[120] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-4xl rounded-xl shadow-lg flex flex-col max-h-[90vh] overflow-hidden border border-border">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Icons.AcademicCap className="w-5 h-5 text-primary" />
                            Import Vocabulary
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Add your own words, lists, or study materials</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                    {error && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 z-[140]">
                            <Icons.Close className="w-4 h-4 text-destructive" />
                            <p className="text-destructive text-sm font-semibold">{error}</p>
                            <button onClick={() => setError(null)} className="ml-auto text-destructive/70 hover:text-destructive transition-colors">
                                <Icons.Close className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {step === 'input' ? (
                        <div className="space-y-6 relative">
                            <div className="space-y-2 relative">
                                <label className="text-sm font-semibold text-foreground">Paste Text or List</label>
                                <div className="relative">
                                    <textarea
                                        className="w-full h-80 p-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-all font-medium text-foreground resize-none shadow-sm"
                                        placeholder="Enter words (one per line, comma separated, or word: definition)..."
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        disabled={isProcessing}
                                    />

                                    <div className="absolute bottom-4 right-4 flex items-center gap-3">
                                        {inputText.split('\n').filter(l => l.trim()).length > 100 || inputText.length > 8000 ? (
                                            <div className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-md border border-destructive/20 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
                                                Use Standard Import for 100+ words
                                            </div>
                                        ) : inputText.length > 5000 && (
                                            <div className="text-xs font-semibold text-orange-500 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                                Large input: AI best with under 100 words
                                            </div>
                                        )}
                                        <div className="text-xs font-medium text-muted-foreground bg-background/80 px-2 py-1 rounded">
                                            {inputText.length} chars • {inputText.split('\n').filter(l => l.trim()).length} words
                                        </div>
                                    </div>

                                    {isProcessing && (
                                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300 z-10 border border-border">
                                            <div className="flex flex-col items-center gap-4">
                                                <Icons.Sparkles className="w-8 h-8 text-primary animate-pulse" />
                                                <div className="space-y-1">
                                                    <h3 className="text-foreground font-semibold text-lg">{loadingMessage}</h3>
                                                    <p className="text-muted-foreground text-xs font-medium">Processing with AI...</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-semibold hover:bg-muted transition-all disabled:opacity-50 shadow-sm"
                                >
                                    <Icons.Upload className="w-4 h-4" /> {isProcessing ? 'Reading...' : 'Upload File'}
                                </button>

                                <div className="flex-1 w-full flex flex-col items-center sm:items-end gap-1">
                                    {!isProcessing && (
                                        <button
                                            onClick={handleProcess}
                                            className="text-xs text-muted-foreground font-semibold hover:text-foreground underline"
                                        >
                                            Standard Import (Fast)
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleSmartAIParse()}
                                    disabled={!inputText.trim() || isProcessing || inputText.split('\n').filter(l => l.trim()).length > 100 || inputText.length > 8000}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg font-semibold text-sm shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90"
                                >
                                    <Icons.Sparkles className={isProcessing ? 'animate-spin w-4 h-4' : 'w-4 h-4'} />
                                    {isProcessing ? 'Processing...' : 'Organize with AI'}
                                </button>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".docx,.pdf,.txt,.csv"
                                    className="hidden"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-foreground font-semibold text-sm">
                                    Preview: {processedWords.length} Words Processed
                                </div>
                                {isProcessing && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-full border border-border shadow-sm">
                                        <Icons.Sparkles className="w-3 h-3 text-primary animate-pulse" />
                                        <span className="text-muted-foreground font-medium text-xs">
                                            {loadingMessage} ({progress?.current}/{progress?.total})
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="border border-border rounded-lg overflow-hidden shadow-sm bg-background">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted text-muted-foreground text-xs font-semibold border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3">Word</th>
                                            <th className="px-4 py-3">Definition</th>
                                            <th className="px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {processedWords.map((word, idx) => {
                                            const isDuplicate = existingVocab.some(e => e.name.toLowerCase() === word.name?.toLowerCase());
                                            return (
                                                <tr key={idx} className="hover:bg-muted/50 transition-colors group">
                                                    <td className="px-4 py-3 align-top">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-foreground">{word.name}</span>
                                                                {isDuplicate && (
                                                                    <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">
                                                                        Duplicate
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${word.difficulty === 'hard' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                                                                    {word.difficulty || 'medium'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-muted-foreground font-medium leading-relaxed max-w-sm">
                                                        {word.definition}
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-right">
                                                        <button
                                                            onClick={() => setProcessedWords(prev => prev.filter((_, i) => i !== idx))}
                                                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 rounded-md hover:bg-destructive/10"
                                                        >
                                                            <Icons.Close className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && (
                    <div className="p-6 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button
                            onClick={() => setStep('input')}
                            className="text-muted-foreground font-semibold text-sm hover:text-foreground transition-colors order-2 sm:order-1"
                        >
                            Back to Edit
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 shadow-sm active:scale-95 transition-all disabled:opacity-50 order-1 sm:order-2"
                        >
                            Import {processedWords.length} Words
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportWordsModal;
