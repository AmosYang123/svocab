import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Word, DailyProgress } from '../types';
import { seededShuffle, scoreAnswerOffline, extractSynonyms, cleanDef } from '../utils';
import { scoreWritingAnswerAI } from '../services/groqService';
import { hybridService } from '../services/hybridService';
import { Award, Check, ChevronRight, Play, RefreshCw, X, Sparkles, Flame, Volume2, ArrowRight } from 'lucide-react';

interface DailyExerciseFlowProps {
    wordNames: string[];
    vocab: Word[];
    onComplete: () => void;
    onCancel: () => void;
}

type LessonStage = 'intro' | 'card_preview' | 'quiz' | 'recall' | 'round_summary' | 'lesson_complete';

export default function DailyExerciseFlow({ wordNames, vocab, onComplete, onCancel }: DailyExerciseFlowProps) {
    const [loading, setLoading] = useState(true);
    const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);

    // Resolve target words for today
    const assignedWords = useMemo(() => {
        return wordNames
            .map(name => vocab.find(w => w.name === name))
            .filter(Boolean) as Word[];
    }, [wordNames, vocab]);

    // Divide 30 words into 3 rounds of 10 words
    const rounds = useMemo(() => {
        const res: Word[][] = [];
        for (let i = 0; i < assignedWords.length; i += 10) {
            res.push(assignedWords.slice(i, i + 10));
        }
        return res.length > 0 ? res : [vocab.slice(0, 10)];
    }, [assignedWords, vocab]);

    // Session State
    const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
    const [stage, setStage] = useState<LessonStage>('intro');
    const [xpEarned, setXpEarned] = useState(0);

    // Card Preview State
    const [previewIdx, setPreviewIdx] = useState(0);

    // Quiz State
    const [quizQueue, setQuizQueue] = useState<Word[]>([]);
    const [quizIdx, setQuizIdx] = useState(0);
    const [quizOptions, setQuizOptions] = useState<string[]>([]);
    const [selectedQuizOption, setSelectedQuizOption] = useState<string | null>(null);
    const [quizFeedback, setQuizFeedback] = useState<'none' | 'correct' | 'incorrect'>('none');

    // Recall State
    const [recallQueue, setRecallQueue] = useState<Word[]>([]);
    const [recallIdx, setRecallIdx] = useState(0);
    const [recallInput, setRecallInput] = useState('');
    const [recallFeedback, setRecallFeedback] = useState<'none' | 'checking' | 'correct' | 'incorrect'>('none');
    const [recallCorrectAnswer, setRecallCorrectAnswer] = useState('');

    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        loadSession();
    }, []);

    const loadSession = async () => {
        try {
            setLoading(true);
            const progress = await hybridService.getDailyProgress(todayStr);
            if (progress) {
                setDailyProgress(progress);
                const completedBatches = progress.progress.completedBatches || 0;
                if (completedBatches >= 3) {
                    setStage('lesson_complete');
                } else {
                    setCurrentRoundIdx(completedBatches);
                    setStage('intro');
                }
            }
        } catch (e) {
            console.error("Failed to load daily progress session", e);
        } finally {
            setLoading(false);
        }
    };

    const saveProgress = async (completedRoundCount: number, wordStates: any = {}) => {
        if (!dailyProgress) return;

        const updated: DailyProgress = {
            ...dailyProgress,
            progress: {
                completedBatches: completedRoundCount,
                wordStates: {
                    ...dailyProgress.progress.wordStates,
                    ...wordStates
                }
            }
        };

        if (completedRoundCount >= 3) {
            updated.completed = true;
            updated.completedAt = new Date().toISOString();
        }

        setDailyProgress(updated);
        await hybridService.saveDailyProgress(updated);

        // Update word statuses in main dictionary
        if (completedRoundCount >= 3) {
            const userData = await hybridService.getUserData();
            const updatedStatuses = { ...(userData?.wordStatuses || {}) };

            wordNames.forEach(name => {
                const statusState = updated.progress.wordStates[name];
                if (statusState && statusState.attempts <= 1) {
                    updatedStatuses[name] = 'mastered';
                } else {
                    updatedStatuses[name] = 'review';
                }
            });

            await hybridService.saveUserData({
                wordStatuses: updatedStatuses,
                markedWords: userData?.markedWords || {},
                savedSets: userData?.savedSets || [],
                customVocab: userData?.customVocab || []
            });
        }
    };

    // Pronunciation TTS audio helper
    const speakWord = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    };

    // --- Round Navigation ---
    const startCardPreview = () => {
        setPreviewIdx(0);
        setStage('card_preview');
    };

    const nextCardPreview = () => {
        const currentBatch = rounds[currentRoundIdx] || [];
        if (previewIdx < currentBatch.length - 1) {
            setPreviewIdx(prev => prev + 1);
        } else {
            startQuizStage();
        }
    };

    const startQuizStage = () => {
        const currentBatch = rounds[currentRoundIdx] || [];
        const shuffled = seededShuffle([...currentBatch], Date.now());
        setQuizQueue(shuffled);
        setQuizIdx(0);
        setSelectedQuizOption(null);
        setQuizFeedback('none');
        setStage('quiz');
    };

    // Options for current Quiz word
    const currentQuizWord = quizQueue[quizIdx];
    useEffect(() => {
        if (!currentQuizWord) return;

        const correctDef = cleanDef(currentQuizWord.definition);
        const distractors: string[] = [];
        let attempts = 0;

        while (distractors.length < 3 && attempts < 50) {
            attempts++;
            const rand = vocab[Math.floor(Math.random() * vocab.length)];
            const dDef = cleanDef(rand.definition);
            if (rand.name !== currentQuizWord.name && dDef !== correctDef && !distractors.includes(dDef)) {
                distractors.push(dDef);
            }
        }

        setQuizOptions(seededShuffle([correctDef, ...distractors], Date.now()));
    }, [currentQuizWord, vocab]);

    const handleSelectQuizOption = (option: string) => {
        if (quizFeedback !== 'none' || !currentQuizWord) return;

        const correct = option === cleanDef(currentQuizWord.definition);
        setSelectedQuizOption(option);
        setQuizFeedback(correct ? 'correct' : 'incorrect');

        if (correct) {
            setXpEarned(prev => prev + 10);
            speakWord(currentQuizWord.name);
        } else {
            // Re-add missed word to end of round queue
            setQuizQueue(prev => [...prev, currentQuizWord]);
        }
    };

    const advanceQuiz = () => {
        if (quizIdx < quizQueue.length - 1) {
            setQuizIdx(prev => prev + 1);
            setSelectedQuizOption(null);
            setQuizFeedback('none');
        } else {
            startRecallStage();
        }
    };

    const startRecallStage = () => {
        const currentBatch = rounds[currentRoundIdx] || [];
        const shuffled = seededShuffle([...currentBatch], Date.now());
        setRecallQueue(shuffled);
        setRecallIdx(0);
        setRecallInput('');
        setRecallFeedback('none');
        setStage('recall');
    };

    const currentRecallWord = recallQueue[recallIdx];

    const handleSubmitRecall = async () => {
        if (!currentRecallWord || recallFeedback !== 'none' || !recallInput.trim()) return;

        setRecallFeedback('checking');
        const synonyms = extractSynonyms(currentRecallWord.definition);

        const aiResult = await scoreWritingAnswerAI(recallInput, cleanDef(currentRecallWord.definition), synonyms);
        const correct = aiResult !== null ? aiResult : scoreAnswerOffline(recallInput, cleanDef(currentRecallWord.definition), synonyms);

        setRecallCorrectAnswer(cleanDef(currentRecallWord.definition));
        setRecallFeedback(correct ? 'correct' : 'incorrect');

        const currentStates = dailyProgress?.progress.wordStates || {};
        const existingState = currentStates[currentRecallWord.name] || { attempts: 0, correct: false };

        const newState = { attempts: existingState.attempts + 1, correct };
        await saveProgress(currentRoundIdx, { [currentRecallWord.name]: newState });

        if (correct) {
            setXpEarned(prev => prev + 15);
            speakWord(currentRecallWord.name);
        } else {
            setRecallQueue(prev => [...prev, currentRecallWord]);
        }
    };

    const advanceRecall = () => {
        if (recallIdx < recallQueue.length - 1) {
            setRecallIdx(prev => prev + 1);
            setRecallInput('');
            setRecallFeedback('none');
        } else {
            const nextRound = currentRoundIdx + 1;
            saveProgress(nextRound);

            if (nextRound >= 3) {
                setStage('lesson_complete');
            } else {
                setCurrentRoundIdx(nextRound);
                setStage('round_summary');
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin mb-4"></div>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading Lesson...</p>
            </div>
        );
    }

    const currentBatch = rounds[currentRoundIdx] || [];
    const totalLessonWords = assignedWords.length;
    const completedWordsCount = (currentRoundIdx * 10) + (stage === 'card_preview' ? previewIdx : stage === 'quiz' ? quizIdx : stage === 'recall' ? recallIdx : 10);
    const progressPercent = Math.min(100, Math.round((completedWordsCount / Math.max(1, totalLessonWords)) * 100));

    return (
        <div className="max-w-xl mx-auto py-6 px-4 font-sans text-foreground">
            {/* Duolingo Top Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <button
                    onClick={onCancel}
                    className="p-2 border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors rounded-xl"
                    title="Exit lesson"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Duolingo Progress Bar */}
                <div className="flex-1 bg-muted h-3 border border-border overflow-hidden rounded-xl">
                    <div
                        className="bg-primary h-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* XP Indicator */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{xpEarned} XP</span>
                </div>
            </div>

            {/* STAGE: Intro */}
            {stage === 'intro' && (
                <div className="p-8 border border-border bg-card text-center space-y-6 rounded-xl">
                    <div className="w-16 h-16 bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto rounded-xl">
                        <Play className="w-8 h-8 fill-current ml-1" />
                    </div>

                    <div className="space-y-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                            ROUND {currentRoundIdx + 1} OF 3
                        </span>
                        <h2 className="text-2xl font-bold tracking-tight">
                            30 Word Daily Challenge
                        </h2>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                            Master 10 target words in Round {currentRoundIdx + 1}. You'll discover each word, test recognition with speed quizzes, and solidify recall with spelling drills.
                        </p>
                    </div>

                    <button
                        onClick={startCardPreview}
                        className="w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold py-3.5 px-8 text-xs uppercase tracking-wider transition-all rounded-xl flex items-center justify-center gap-2"
                    >
                        <span>Start Round {currentRoundIdx + 1}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* STAGE: Card Preview / Intro */}
            {stage === 'card_preview' && currentBatch[previewIdx] && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono uppercase border-b border-border pb-2">
                        <span>Stage 1: Discovery</span>
                        <span>Word {previewIdx + 1} of {currentBatch.length}</span>
                    </div>

                    <div className="p-8 border border-border bg-card space-y-6 rounded-xl relative">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-[10px] font-mono text-primary uppercase tracking-widest block mb-1">
                                    {currentBatch[previewIdx].version === 'new' ? 'New SAT Word' : 'Core Vocab'}
                                </span>
                                <h2 className="text-3xl font-bold tracking-tight">
                                    {currentBatch[previewIdx].name}
                                </h2>
                            </div>
                            <button
                                onClick={() => speakWord(currentBatch[previewIdx].name)}
                                className="p-2.5 border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors rounded-xl"
                                title="Listen pronunciation"
                            >
                                <Volume2 className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 border-t border-border pt-4">
                            <div>
                                <span className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Definition</span>
                                <p className="text-sm font-medium leading-relaxed">
                                    {cleanDef(currentBatch[previewIdx].definition)}
                                </p>
                            </div>

                            {currentBatch[previewIdx].example && (
                                <div className="bg-muted p-3.5 border border-border text-xs leading-relaxed italic text-muted-foreground">
                                    "{currentBatch[previewIdx].example}"
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={nextCardPreview}
                        className="w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold py-3.5 px-6 text-xs uppercase tracking-wider transition-all rounded-xl flex items-center justify-center gap-2"
                    >
                        <span>{previewIdx === currentBatch.length - 1 ? 'Begin Recognition Quiz' : 'Continue'}</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* STAGE: Recognition Quiz */}
            {stage === 'quiz' && currentQuizWord && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono uppercase border-b border-border pb-2">
                        <span>Stage 2: Recognition Quiz</span>
                        <span>{quizQueue.length - quizIdx} remaining</span>
                    </div>

                    <div className="p-6 border border-border bg-card text-center space-y-2 rounded-xl">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
                            Select the correct definition
                        </span>
                        <h3 className="text-3xl font-bold tracking-tight text-primary">
                            {currentQuizWord.name}
                        </h3>
                    </div>

                    {/* Quiz 4 Options */}
                    <div className="space-y-3">
                        {quizOptions.map((opt, idx) => {
                            const isSelected = selectedQuizOption === opt;
                            const isCorrect = opt === cleanDef(currentQuizWord.definition);
                            const showResult = quizFeedback !== 'none';

                            let optionStyle = 'border-border bg-card text-foreground hover:bg-muted';
                            if (showResult) {
                                if (isCorrect) optionStyle = 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold';
                                else if (isSelected) optionStyle = 'border-red-600 bg-red-500/10 text-red-700 dark:text-red-300';
                            }

                            return (
                                <button
                                    key={idx}
                                    disabled={quizFeedback !== 'none'}
                                    onClick={() => handleSelectQuizOption(opt)}
                                    className={`w-full text-left p-4 border transition-all rounded-xl flex items-start gap-3 ${optionStyle}`}
                                >
                                    <span className="text-xs font-mono px-2 py-0.5 border border-border bg-background text-muted-foreground shrink-0">
                                        {idx + 1}
                                    </span>
                                    <span className="text-xs leading-relaxed font-medium">{opt}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Duolingo Bottom Feedback Sheet */}
                    {quizFeedback !== 'none' && (
                        <div className={`p-4 border text-xs font-medium space-y-3 rounded-xl animate-in slide-in-from-bottom-2 duration-200 ${
                            quizFeedback === 'correct'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                        }`}>
                            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">
                                {quizFeedback === 'correct' ? (
                                    <>
                                        <Check className="w-4 h-4 text-emerald-600" />
                                        <span>Correct! +10 XP</span>
                                    </>
                                ) : (
                                    <>
                                        <X className="w-4 h-4 text-red-600" />
                                        <span>Correct Answer: {cleanDef(currentQuizWord.definition)}</span>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={advanceQuiz}
                                className={`w-full py-3 text-xs font-semibold uppercase tracking-wider text-white rounded-xl transition-opacity ${
                                    quizFeedback === 'correct' ? 'bg-emerald-600 hover:opacity-90' : 'bg-red-600 hover:opacity-90'
                                }`}
                            >
                                Continue
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* STAGE: Active Recall / Spelling Drill */}
            {stage === 'recall' && currentRecallWord && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono uppercase border-b border-border pb-2">
                        <span>Stage 3: Active Recall</span>
                        <span>{recallQueue.length - recallIdx} remaining</span>
                    </div>

                    <div className="p-6 border border-border bg-card space-y-3 rounded-xl">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
                            Type the meaning or synonyms for:
                        </span>
                        <h3 className="text-3xl font-bold tracking-tight text-primary">
                            {currentRecallWord.name}
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <textarea
                            value={recallInput}
                            disabled={recallFeedback !== 'none' && recallFeedback !== 'checking'}
                            onChange={(e) => setRecallInput(e.target.value)}
                            placeholder="Type definition or key synonyms..."
                            className="w-full p-4 border border-border bg-card text-xs focus:outline-none focus:border-primary rounded-xl font-medium resize-none"
                            rows={3}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmitRecall();
                                }
                            }}
                        />

                        {recallFeedback === 'none' && (
                            <button
                                disabled={!recallInput.trim()}
                                onClick={handleSubmitRecall}
                                className="w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold py-3.5 text-xs uppercase tracking-wider transition-all rounded-xl disabled:opacity-50"
                            >
                                Verify Answer
                            </button>
                        )}
                    </div>

                    {/* Feedback Bar */}
                    {(recallFeedback === 'correct' || recallFeedback === 'incorrect') && (
                        <div className={`p-4 border text-xs font-medium space-y-3 rounded-xl animate-in slide-in-from-bottom-2 duration-200 ${
                            recallFeedback === 'correct'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className="font-bold uppercase tracking-wider">
                                    {recallFeedback === 'correct' ? 'Great Recall! +15 XP' : 'Keep practicing!'}
                                </span>
                            </div>
                            <p className="text-xs bg-background p-3 border border-border leading-relaxed">
                                <strong className="text-foreground">{currentRecallWord.name}:</strong> {recallCorrectAnswer}
                            </p>
                            <button
                                onClick={advanceRecall}
                                className="w-full py-3 bg-foreground text-background text-xs font-semibold uppercase tracking-wider rounded-xl hover:opacity-90"
                            >
                                Continue
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* STAGE: Round Summary */}
            {stage === 'round_summary' && (
                <div className="p-8 border border-border bg-card text-center space-y-6 rounded-xl">
                    <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center mx-auto rounded-xl">
                        <Check className="w-8 h-8 stroke-[3]" />
                    </div>

                    <div className="space-y-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
                            MILESTONE COMPLETE
                        </span>
                        <h2 className="text-2xl font-bold tracking-tight">
                            Round {currentRoundIdx} Complete!
                        </h2>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                            10 target words successfully mastered in this round. Advance to Round {currentRoundIdx + 1} to keep your progress moving!
                        </p>
                    </div>

                    <button
                        onClick={() => setStage('intro')}
                        className="w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold py-3.5 px-8 text-xs uppercase tracking-wider transition-all rounded-xl"
                    >
                        Start Round {currentRoundIdx + 1}
                    </button>
                </div>
            )}

            {/* STAGE: Lesson Complete */}
            {stage === 'lesson_complete' && (
                <div className="p-8 border border-border bg-card text-center space-y-6 rounded-xl">
                    <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center mx-auto rounded-xl">
                        <Award className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">
                            Lesson Completed!
                        </h2>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                            Awesome job! You've finished all 30 target words for today's challenge. Your streak is active and your stats have been saved!
                        </p>
                    </div>

                    <div className="p-4 border border-border bg-muted flex items-center justify-around text-xs font-mono">
                        <div>
                            <span className="text-muted-foreground block text-[10px]">WORDS REVIEWED</span>
                            <span className="text-base font-bold text-foreground">30</span>
                        </div>
                        <div className="w-px h-8 bg-border"></div>
                        <div>
                            <span className="text-muted-foreground block text-[10px]">TOTAL XP</span>
                            <span className="text-base font-bold text-amber-600 dark:text-amber-400">+{xpEarned || 300} XP</span>
                        </div>
                    </div>

                    <button
                        onClick={onComplete}
                        className="w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold py-3.5 px-8 text-xs uppercase tracking-wider transition-all rounded-xl"
                    >
                        Back to Daily Center
                    </button>
                </div>
            )}
        </div>
    );
}
