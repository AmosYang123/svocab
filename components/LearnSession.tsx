import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Word, WordStatusType } from '../types';
import { Icons } from './Icons';
import { seededShuffle, scoreAnswerOffline, extractSynonyms, cleanDef } from '../utils';
import Flashcard from './Flashcard';
import { scoreWritingAnswerAI } from '../services/groqService';

// --- Types ---

type LearnPhase = 'warmup' | 'round_a' | 'round_b' | 'round_c' | 'writing_test' | 'micro_review' | 'summary' | 'session_review' | 'session_test' | 'session_summary';

interface WordProgress {
    roundA: boolean | null;
    roundB: boolean | null;
    roundC: boolean | null;
    writingTest: boolean | null;
    attempts: number;
    mastered: boolean;
    deferred: boolean;
}

interface LearnStateV2 {
    allGroups: Word[][];
    currentGroupIndex: number;
    phase: LearnPhase;
    wordProgress: { [wordName: string]: WordProgress };
    masteredThisSession: string[];
    deferredThisSession: string[];
    previousGroupItems: Word[];
    missedInRoundA: string[];
    missedInRoundB: string[];
    missedInRoundC: string[];
    aiCorrectedWords: string[];
    questionTimes: { [wordName: string]: number }; // In milliseconds
}

interface LearnSessionProps {
    studyList: Word[];
    onComplete: () => void;
    onExit?: () => void;
    onUpdateWordStatus: (wordName: string, status: WordStatusType) => void;
}

// --- Constants ---

const FEEDBACK_DURATIONS: Record<string, number> = {
    round_a: 2500,
    round_b: 2000,
    round_c: 1500,
    writing_test: 2000,
    micro_review: 2000,
    session_review: 0,
    session_test: 2000,
};

const FAIL_FORWARD_MESSAGES = {
    wrong: "Not yet. You'll see this again.",
    deferred: "Taking a break from this one.",
    correct: "Got it!",
    mastered: "Locked in!",
    timeUp: "Time's up!",
};

// Helpers moved to utils.ts

// --- Helper Components ---

// 1. Warmup View - Flashcard preview (90 second timer, keyboard controls)
const WarmupView: React.FC<{
    group: Word[];
    groupIndex: number;
    totalGroups: number;
    onComplete: () => void;
}> = ({ group, groupIndex, totalGroups, onComplete }) => {
    const [index, setIndex] = useState(0);
    const [showDef, setShowDef] = useState(false);
    const [timeLeft, setTimeLeft] = useState(90);

    // Timer countdown - auto-skip when reaches 0
    useEffect(() => {
        if (timeLeft <= 0) {
            onComplete(); // Auto-skip to quiz when timer runs out
            return;
        }
        const interval = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [timeLeft, onComplete]);


    const handleNext = useCallback(() => {
        if (index < group.length - 1) {
            setIndex(prev => prev + 1);
            setShowDef(false);
        } else {
            onComplete();
        }
    }, [index, group.length, onComplete]);

    const handlePrev = useCallback(() => {
        if (index > 0) {
            setIndex(prev => prev - 1);
            setShowDef(false);
        }
    }, [index]);

    const handleToggle = useCallback(() => {
        setShowDef(prev => !prev);
    }, []);

    // Keyboard controls - Space, Enter, Arrow keys
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key) {
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    handleToggle();
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    handleNext();
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    handlePrev();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleToggle, handleNext, handlePrev]);

    if (!group[index]) return null;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center max-w-2xl mx-auto w-full px-4">
            {/* Header */}
            <div className="text-center mb-4 w-full">
                <div className="flex items-center justify-center gap-4 mb-3">
                    <div className="text-xs font-mono text-primary uppercase tracking-[0.3em]">
                        Group {groupIndex + 1} of {totalGroups}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${timeLeft > 30 ? 'bg-emerald-100 text-emerald-700' : timeLeft > 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-1">Warm Up</h2>
                <p className="text-sm text-muted-foreground">
                    Preview these {group.length} words
                </p>
            </div>

            {/* Progress */}
            <div className="w-full mb-6">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${((index + 1) / group.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">{group.length}</span>
                </div>
            </div>

            {/* Flashcard */}
            <div className="w-full">
                <Flashcard
                    word={group[index]}
                    showDefinition={showDef}
                    onToggle={handleToggle}
                    status={null}
                />
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-center w-full gap-3">
                <button
                    onClick={handlePrev}
                    disabled={index === 0}
                    className={`p-3 rounded-xl border-2 transition-all ${index === 0 ? 'border-border text-muted-foreground/40' : 'border-border text-muted-foreground hover:border-primary/50 active:scale-[0.98]'}`}
                >
                    <Icons.ChevronLeft />
                </button>

                <button
                    onClick={handleToggle}
                    className="flex-1 max-w-xs bg-card border-2 border-border text-foreground py-3 rounded-xl font-semibold uppercase tracking-widest text-xs hover:border-primary/50 transition-all active:scale-[0.98]"
                >
                    {showDef ? 'Hide' : 'Show'} Definition
                </button>

                <button
                    onClick={handleNext}
                    className="p-3 rounded-xl border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                    <Icons.ChevronRight />
                </button>
            </div>

            <button
                onClick={onComplete}
                className="mt-6 text-xs font-semibold text-muted-foreground hover:text-primary uppercase tracking-widest"
            >
                Skip to Quiz →
            </button>

            <div className="mt-6 text-[10px] text-muted-foreground text-center">
                <kbd className="px-1.5 py-0.5 bg-muted rounded mr-1">Space</kbd> or <kbd className="px-1.5 py-0.5 bg-muted rounded mx-1">Enter</kbd> = Flip &nbsp;|&nbsp;
                <kbd className="px-1.5 py-0.5 bg-muted rounded mr-1">←</kbd><kbd className="px-1.5 py-0.5 bg-muted rounded">→</kbd> = Navigate
            </div>
        </div>
    );
};

// 2. Quiz View - Multiple choice (correct = instant advance, wrong = feedback duration)
const QuizView: React.FC<{
    phase: 'round_a' | 'round_b' | 'round_c' | 'micro_review' | 'session_review';
    words: Word[];
    allVocab: Word[];
    groupIndex: number;
    totalGroups: number;
    wordProgress: { [wordName: string]: WordProgress };
    onAnswer: (wordName: string, correct: boolean) => void;
    onAnswerWithTime?: (wordName: string, timeMs: number) => void;
    onComplete: () => void;
    hideIndividualFeedback?: boolean;
}> = ({ phase, words, allVocab, groupIndex, totalGroups, wordProgress, onAnswer, onAnswerWithTime, onComplete, hideIndividualFeedback = false }) => {
    const [queue, setQueue] = useState<Word[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [options, setOptions] = useState<string[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [feedbackState, setFeedbackState] = useState<'none' | 'correct' | 'incorrect'>('none');
    const [isTimeout, setIsTimeout] = useState<boolean>(false);
    const [startTime, setStartTime] = useState<number>(Date.now());

    // Timer for Rounds B (10s) and C (6s)
    const getTimeLimit = () => {
        if (phase === 'round_b') return 10;
        if (phase === 'round_c') return 6;
        return 0;
    };
    const [questionTimer, setQuestionTimer] = useState(getTimeLimit());

    // Initialize queue
    useEffect(() => {
        if (words.length > 0) {
            setQueue(seededShuffle([...words], Date.now()));
            setCurrentIndex(0);
            setSelectedOption(null);
            setFeedbackState('none');
            setIsTimeout(false);
        }
    }, [words, phase]);

    // Reset timer for each question
    useEffect(() => {
        setQuestionTimer(getTimeLimit());
        setStartTime(Date.now());
        setIsTimeout(false);
    }, [currentIndex, phase]);

    // Timer countdown
    useEffect(() => {
        const limit = getTimeLimit();
        if (limit === 0 || feedbackState !== 'none' || !queue[currentIndex]) return;

        const interval = setInterval(() => {
            setQuestionTimer(prev => {
                if (prev <= 1) {
                    // Time's up
                    handleTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [currentIndex, feedbackState, queue]);

    const handleTimeUp = useCallback(() => {
        const word = queue[currentIndex];
        if (!word || feedbackState !== 'none') return;

        const timeSpent = Date.now() - startTime;
        setIsTimeout(true);
        setFeedbackState('incorrect');
        onAnswer(word.name, false);
        if (onAnswerWithTime) onAnswerWithTime(word.name, timeSpent);

        setTimeout(() => {
            advanceQuestion();
        }, FEEDBACK_DURATIONS[phase] || 2000);
    }, [queue, currentIndex, feedbackState, phase, onAnswer, onAnswerWithTime, startTime]);

    const advanceQuestion = useCallback(() => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOption(null);
            setFeedbackState('none');
            setIsTimeout(false);
        } else {
            onComplete();
        }
    }, [currentIndex, queue.length, onComplete]);

    const currentWord = queue[currentIndex];

    // Generate options
    useEffect(() => {
        if (!currentWord) return;

        const correctDef = cleanDef(currentWord.definition);
        const distractors: string[] = [];
        let attempts = 0;

        while (distractors.length < 3 && attempts < 50) {
            attempts++;
            const rand = allVocab[Math.floor(Math.random() * allVocab.length)];
            const dDef = cleanDef(rand.definition);
            if (rand.name !== currentWord.name && dDef !== correctDef && !distractors.includes(dDef)) {
                distractors.push(dDef);
            }
        }

        setOptions(seededShuffle([correctDef, ...distractors], Date.now()));
    }, [currentWord, allVocab]);

    const handleSelect = useCallback((option: string) => {
        if (feedbackState !== 'none' || !currentWord) return;

        const timeSpent = Date.now() - startTime;
        const correct = option === cleanDef(currentWord.definition);
        setIsTimeout(false);
        setSelectedOption(option);
        setFeedbackState(correct ? 'correct' : 'incorrect');
        onAnswer(currentWord.name, correct);
        if (onAnswerWithTime) onAnswerWithTime(currentWord.name, timeSpent);

        if (correct) {
            // Correct = instant advance (300ms for visual feedback)
            setTimeout(advanceQuestion, 300);
        } else {
            // Wrong = show feedback for full duration
            setTimeout(advanceQuestion, FEEDBACK_DURATIONS[phase] || 2000);
        }
    }, [feedbackState, currentWord, phase, onAnswer, onAnswerWithTime, startTime, advanceQuestion]);

    if (!currentWord) return null;

    const progress = wordProgress[currentWord.name];
    const phaseNames: Record<string, string> = {
        round_a: 'Round A: First Pass',
        round_b: 'Round B: Review Missed',
        round_c: 'Round C: Final Check',
        micro_review: 'Quick Review',
        session_review: 'Final Review',
    };

    const getFeedbackMessage = () => {
        if (feedbackState === 'correct') {
            return progress?.mastered ? FAIL_FORWARD_MESSAGES.mastered : FAIL_FORWARD_MESSAGES.correct;
        }
        if (isTimeout) return FAIL_FORWARD_MESSAGES.timeUp;
        return progress?.deferred ? FAIL_FORWARD_MESSAGES.deferred : FAIL_FORWARD_MESSAGES.wrong;
    };

    return (
        <div className="flex flex-col items-center max-w-lg mx-auto w-full px-4">
            {/* Header */}
            <div className="text-center mb-4 w-full">
                <div className="flex items-center justify-center gap-4 mb-2">
                    <div className="text-xs font-mono text-primary uppercase tracking-[0.3em]">
                        Group {groupIndex + 1} of {totalGroups}
                    </div>
                    {getTimeLimit() > 0 && feedbackState === 'none' && (
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${questionTimer > 5 ? 'bg-emerald-100 text-emerald-700' : questionTimer > 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
                            {questionTimer}s
                        </div>
                    )}
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">{phaseNames[phase]}</h2>
                <div className="text-xs text-muted-foreground">
                    {currentIndex + 1} of {queue.length}
                </div>
            </div>

            {/* Progress */}
            <div className="w-full mb-6">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Word */}
            <div className="w-full bg-card rounded-xl shadow-sm border border-border p-8 mb-6">
                <h3 className="text-3xl font-bold text-foreground text-center">
                    {currentWord.name}
                </h3>
            </div>

            {/* Options */}
            <div className="w-full space-y-3 mb-4">
                {options.map((opt, i) => {
                    const isSelected = selectedOption === opt;
                    const isCorrect = opt === cleanDef(currentWord.definition);
                    const showResult = feedbackState !== 'none' && !hideIndividualFeedback;

                    let bgClass = 'bg-card hover:bg-muted border-border';
                    if (showResult && isCorrect) bgClass = 'bg-emerald-500/10 border-emerald-500/30';
                    else if (showResult && isSelected) bgClass = 'bg-red-500/10 border-red-500/30';
                    else if (isSelected) bgClass = 'bg-primary/10 border-primary/30';

                    return (
                        <button
                            key={i}
                            onClick={() => handleSelect(opt)}
                            disabled={feedbackState !== 'none'}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${bgClass}`}
                        >
                            <span className="text-sm font-medium text-foreground">{opt}</span>
                        </button>
                    );
                })}
            </div>

            {/* Feedback */}
            {feedbackState !== 'none' && !hideIndividualFeedback && (
                <div className={`w-full p-4 rounded-xl border ${feedbackState === 'correct' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <p className={`text-sm font-bold ${feedbackState === 'correct' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {getFeedbackMessage()}
                    </p>
                    {feedbackState === 'incorrect' && (
                        <p className="text-sm text-muted-foreground mt-1">
                            <span className="font-semibold">Answer:</span> {cleanDef(currentWord.definition)}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// 3. Writing Test View (Timed: 3s, Re-test missed)
const WritingTestView: React.FC<{
    words: Word[];
    groupIndex: number;
    totalGroups: number;
    title?: string;
    onAnswer: (wordName: string, correct: boolean) => void;
    onAiCorrect: (wordName: string) => void;
    onComplete: () => void;
}> = ({ words, groupIndex, totalGroups, title = "Writing Test", onAnswer, onAiCorrect, onComplete }) => {
    const [queue, setQueue] = useState<Word[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [feedbackState, setFeedbackState] = useState<'none' | 'checking' | 'correct' | 'incorrect'>('none');
    const [aiStatus, setAiStatus] = useState<boolean | null>(null);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [timer, setTimer] = useState(20);

    const advanceNext = useCallback(() => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserInput('');
            setFeedbackState('none');
            setAiStatus(null);
            setTimer(20); // Reset timer
        } else {
            onComplete();
        }
    }, [currentIndex, queue.length, onComplete]);

    const handleSubmit = useCallback(async () => {
        if (!queue[currentIndex] || feedbackState !== 'none' || !userInput.trim()) return;

        const currentWord = queue[currentIndex];
        setFeedbackState('checking');
        const synonyms = extractSynonyms(currentWord.definition);

        // Try AI scoring first
        const aiResult = await scoreWritingAnswerAI(userInput, cleanDef(currentWord.definition), synonyms);

        let isCorrect = false;
        let aiSuccess = false;
        if (aiResult !== null) {
            isCorrect = aiResult;
            aiSuccess = aiResult;
        } else {
            // Instant offline fallback with centralized logic
            isCorrect = scoreAnswerOffline(userInput, cleanDef(currentWord.definition), synonyms);
        }

        setCorrectAnswer(cleanDef(currentWord.definition));
        setFeedbackState(isCorrect ? 'correct' : 'incorrect');
        setAiStatus(aiSuccess);
        onAnswer(currentWord.name, isCorrect);
        if (aiSuccess === true) {
            onAiCorrect(currentWord.name);
        }

        // Re-queue if incorrect
        if (!isCorrect) {
            setQueue(prev => [...prev, currentWord]);
        }

        setTimeout(() => {
            advanceNext();
        }, isCorrect ? 1500 : 3500); // Increased correct delay slightly to see AI badge
    }, [queue, currentIndex, feedbackState, userInput, onAnswer, onAiCorrect, advanceNext]);

    useEffect(() => {
        if (words.length > 0) {
            setQueue(seededShuffle([...words], Date.now()));
            setCurrentIndex(0);
            setUserInput('');
            setFeedbackState('none');
            setAiStatus(null);
            setTimer(20);
        }
    }, [words]);

    const currentWord = queue[currentIndex];

    const handleTimeout = useCallback(() => {
        if (!currentWord) return;

        // If there is user input, automatically submit it instead of just timing out
        if (userInput.trim().length > 0) {
            handleSubmit();
            return;
        }

        setCorrectAnswer(cleanDef(currentWord.definition));
        setFeedbackState('incorrect');
        setAiStatus(null);
        onAnswer(currentWord.name, false); // Mark as wrong

        // Re-queue the missed word
        setQueue(prev => [...prev, currentWord]);

        // Auto-advance after delay
        setTimeout(() => {
            advanceNext();
        }, 3500);
    }, [currentWord, onAnswer, userInput, handleSubmit, advanceNext]);

    // Timer logic
    useEffect(() => {
        if (feedbackState !== 'none' || !currentWord) return;

        const interval = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) {
                    handleTimeout(); // Handle timeout
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [feedbackState, currentWord, handleTimeout]);

    if (!currentWord) return null;

    return (
        <div className="flex flex-col items-center max-w-lg mx-auto w-full px-4">
            <div className="text-center mb-4 w-full">
                <div className="flex items-center justify-center gap-4 mb-2">
                    <div className="text-xs font-mono text-primary uppercase tracking-[0.3em] mb-2">
                        Group {groupIndex + 1} of {totalGroups}
                    </div>
                    {feedbackState === 'none' && (
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${timer > 10 ? 'bg-emerald-100 text-emerald-700' : timer > 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
                            {timer}s
                        </div>
                    )}
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">{title}</h2>
                <div className="text-xs text-muted-foreground">{currentIndex + 1} of {queue.length}</div>
            </div>

            <div className="w-full mb-6">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
                    />
                </div>
            </div>

            <div className="w-full bg-card rounded-xl shadow-sm border border-border p-8 mb-6">
                <h3 className="text-3xl font-bold text-foreground text-center">
                    {currentWord.name}
                </h3>
            </div>

            <div className="w-full mb-4">
                <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type the definition or meaning..."
                    disabled={feedbackState !== 'none'}
                    className="w-full p-4 border border-input rounded-xl text-sm focus:border-ring focus:outline-none resize-none bg-card"
                    rows={3}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                />
            </div>

            <button
                onClick={handleSubmit}
                disabled={feedbackState !== 'none' || !userInput.trim()}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold uppercase tracking-widest text-xs disabled:opacity-50"
            >
                {feedbackState === 'checking' ? 'Checking...' : 'Submit'}
            </button>

            {(feedbackState === 'correct' || feedbackState === 'incorrect') && (
                <div className={`w-full mt-4 p-5 rounded-xl border ${feedbackState === 'correct' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <p className={`text-lg font-bold ${feedbackState === 'correct' ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {feedbackState === 'correct' ? 'Correct!' : "Not quite. Here's the answer:"}
                        </p>
                        {feedbackState === 'correct' && aiStatus === true && (
                            <div className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider animate-in zoom-in duration-300 shadow-sm">
                                <Icons.Brain />
                                <span>AI Validated</span>
                            </div>
                        )}
                        {feedbackState === 'incorrect' && aiStatus === false && (
                            <div className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider animate-in zoom-in duration-300">
                                <Icons.Brain />
                                <span>AI Verified</span>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-foreground bg-card p-3 rounded-lg border border-border">
                        <span className="font-semibold text-primary">{currentWord.name}:</span> {correctAnswer}
                    </p>
                </div>
            )}
        </div>
    );
};


// 4. Group Summary
const GroupSummary: React.FC<{
    groupIndex: number;
    totalGroups: number;
    masteredCount: number;
    deferredCount: number;
    aiCount: number;
    onContinue: () => void;
}> = ({ groupIndex, totalGroups, masteredCount, deferredCount, aiCount, onContinue }) => (
    <div className="flex flex-col items-center max-md mx-auto text-center py-8 px-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <Icons.Check />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Group {groupIndex + 1} Complete</h2>

        <div className="flex flex-wrap justify-center gap-4 my-6">
            <div className="bg-emerald-50 px-6 py-4 rounded-xl border border-emerald-100">
                <div className="text-2xl font-bold text-emerald-600">{masteredCount}</div>
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Mastered</div>
            </div>
            {deferredCount > 0 && (
                <div className="bg-amber-50 px-6 py-4 rounded-xl border border-amber-100">
                    <div className="text-2xl font-bold text-amber-600">{deferredCount}</div>
                    <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Deferred</div>
                </div>
            )}
            {aiCount > 0 && (
                <div className="bg-primary px-6 py-4 rounded-xl shadow-sm border border-primary/80 text-primary-foreground flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <Icons.Brain className="w-4 h-4" />
                        <div className="text-2xl font-bold">{aiCount}</div>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">AI Validated</div>
                </div>
            )}
        </div>

        <button
            onClick={onContinue}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold uppercase tracking-widest text-sm shadow-sm"
        >
            {groupIndex + 1 < totalGroups ? 'Next Group' : 'Final Review'}
        </button>
    </div>
);

// 5. Session Summary
const SessionSummary: React.FC<{
    masteredCount: number;
    deferredCount: number;
    aiCount: number;
    totalWords: number;
    onExit: () => void;
}> = ({ masteredCount, deferredCount, aiCount, totalWords, onExit }) => (
    <div className="flex flex-col items-center max-md mx-auto text-center py-8 px-4">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
            <Icons.Trophy />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Session Complete</h2>
        <p className="text-muted-foreground mb-8">You studied {totalWords} words</p>

        <div className="grid grid-cols-2 gap-4 w-full mb-8">
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                <div className="text-4xl font-bold text-emerald-500 mb-1">{masteredCount}</div>
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-widest">Mastered</div>
            </div>
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                <div className="text-4xl font-bold text-amber-500 mb-1">{deferredCount}</div>
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Try Later</div>
            </div>
        </div>

        {aiCount > 0 && (
            <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
                <Icons.Brain className="w-5 h-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.15em]">{aiCount} AI Validated Answers</span>
            </div>
        )}

        <button
            onClick={onExit}
            className="w-full bg-foreground text-background py-3 rounded-xl font-semibold uppercase tracking-widest shadow-sm"
        >
            Back to Dashboard
        </button>
    </div>
);

// --- Main Component ---

const LearnSession: React.FC<LearnSessionProps> = React.memo(({
    studyList,
    onComplete,
    onExit,
    onUpdateWordStatus
}) => {
    const [state, setState] = useState<LearnStateV2>(() => {
        const groups: Word[][] = [];
        for (let i = 0; i < studyList.length; i += 5) {
            groups.push(studyList.slice(i, i + 5));
        }

        const progress: { [name: string]: WordProgress } = {};
        studyList.forEach(w => {
            progress[w.name] = {
                roundA: null,
                roundB: null,
                roundC: null,
                writingTest: null,
                attempts: 0,
                mastered: false,
                deferred: false,
            };
        });

        return {
            allGroups: groups,
            currentGroupIndex: 0,
            phase: groups.length > 0 ? 'warmup' : 'session_summary',
            wordProgress: progress,
            masteredThisSession: [],
            deferredThisSession: [],
            previousGroupItems: [],
            missedInRoundA: [],
            missedInRoundB: [],
            missedInRoundC: [],
            aiCorrectedWords: [],
            questionTimes: {},
        };
    });

    const currentGroup = state.allGroups[state.currentGroupIndex] || [];

    // Get words for current round (B and C only test missed from previous round)
    const wordsForCurrentRound = useMemo(() => {
        if (state.phase === 'round_a') {
            return currentGroup;
        } else if (state.phase === 'round_b') {
            // Only test words missed in Round A
            const missed = currentGroup.filter(w => state.wordProgress[w.name]?.roundA === false);
            return missed.length > 0 ? missed : currentGroup;
        } else if (state.phase === 'round_c') {
            // Only test words missed in Round B
            const missed = currentGroup.filter(w => state.wordProgress[w.name]?.roundB === false);
            return missed.length > 0 ? missed : currentGroup;
        } else if (state.phase === 'writing_test') {
            // Test ALL words in the group for writing practice
            return currentGroup;
        }
        return currentGroup;
    }, [state.phase, currentGroup, state.wordProgress]);


    const handleAnswer = useCallback((wordName: string, correct: boolean) => {
        setState(prev => {
            const progress = { ...prev.wordProgress };
            const wp = { ...progress[wordName] };

            wp.attempts++;

            if (prev.phase === 'round_a') wp.roundA = correct;
            else if (prev.phase === 'round_b') wp.roundB = correct;
            else if (prev.phase === 'round_c') wp.roundC = correct;
            else if (prev.phase === 'writing_test') wp.writingTest = correct;

            // Mastery: correct in 2+ rounds
            const roundResults = [wp.roundA, wp.roundB, wp.roundC, wp.writingTest].filter(r => r === true);
            if (roundResults.length >= 2) {
                wp.mastered = true;
                onUpdateWordStatus(wordName, 'mastered');
            } else if (wp.attempts >= 3 && !wp.mastered && !correct) {
                wp.deferred = true;
                onUpdateWordStatus(wordName, 'review');
            } else if (correct && !wp.mastered) {
                onUpdateWordStatus(wordName, 'review');
            }

            progress[wordName] = wp;
            return { ...prev, wordProgress: progress };
        });
    }, [onUpdateWordStatus]);

    const advancePhase = useCallback(() => {
        setState(prev => {
            const { phase, currentGroupIndex, allGroups, wordProgress } = prev;
            const currentGrp = allGroups[currentGroupIndex] || [];
            const totalGroups = allGroups.length;

            const missedInA = currentGrp.filter(w => wordProgress[w.name]?.roundA === false);
            const missedInB = currentGrp.filter(w => wordProgress[w.name]?.roundB === false);
            const missedInC = currentGrp.filter(w => wordProgress[w.name]?.roundC === false);
            const unmasteredInGroup = currentGrp.filter(w => !wordProgress[w.name]?.mastered);

            switch (phase) {
                case 'warmup':
                    return { ...prev, phase: 'round_a' };

                case 'round_a':
                    if (missedInA.length === 0) return { ...prev, phase: 'writing_test' };
                    return { ...prev, phase: 'round_b' };

                case 'round_b':
                    if (missedInB.length === 0) return { ...prev, phase: 'writing_test' };
                    return { ...prev, phase: 'round_c' };

                case 'round_c':
                    return { ...prev, phase: 'writing_test' };

                case 'writing_test':
                    return { ...prev, phase: 'micro_review' };

                case 'micro_review': {
                    if (unmasteredInGroup.length > 0) {
                        const updatedProgress = { ...wordProgress };
                        unmasteredInGroup.forEach(w => {
                            updatedProgress[w.name] = {
                                ...updatedProgress[w.name],
                                roundA: null, roundB: null, roundC: null, writingTest: null,
                                mastered: false
                            };
                        });
                        return { ...prev, phase: 'round_a', wordProgress: updatedProgress };
                    }

                    const groupMastered = currentGrp.filter(w => wordProgress[w.name]?.mastered).map(w => w.name);
                    const groupDeferred = currentGrp.filter(w => wordProgress[w.name]?.deferred).map(w => w.name);

                    groupMastered.forEach(name => onUpdateWordStatus(name, 'mastered'));
                    groupDeferred.forEach(name => onUpdateWordStatus(name, 'review'));

                    return {
                        ...prev,
                        phase: 'summary',
                        masteredThisSession: [...prev.masteredThisSession, ...groupMastered.filter(n => !prev.masteredThisSession.includes(n))],
                        deferredThisSession: [...prev.deferredThisSession, ...groupDeferred.filter(n => !prev.deferredThisSession.includes(n))],
                    };
                }

                case 'summary':
                    if (currentGroupIndex + 1 < totalGroups) {
                        const nextGroup = allGroups[currentGroupIndex + 1] || [];
                        const newProgress = { ...wordProgress };
                        nextGroup.forEach(w => {
                            newProgress[w.name] = {
                                roundA: null, roundB: null, roundC: null, writingTest: null,
                                attempts: 0, mastered: false, deferred: false,
                            };
                        });
                        return {
                            ...prev,
                            currentGroupIndex: currentGroupIndex + 1,
                            phase: 'warmup',
                            wordProgress: newProgress,
                            previousGroupItems: currentGrp,
                        };
                    }
                    return { ...prev, phase: 'session_review' };

                case 'session_review':
                    return { ...prev, phase: 'session_test' };

                case 'session_test': {
                    const allWords = allGroups.flat();
                    const unmasteredTotal = allWords.filter(w => !wordProgress[w.name]?.mastered);

                    if (unmasteredTotal.length > 0) {
                        const updatedProgress = { ...wordProgress };
                        unmasteredTotal.forEach(w => {
                            updatedProgress[w.name] = {
                                ...updatedProgress[w.name],
                                roundA: null, roundB: null, roundC: null, writingTest: null,
                                mastered: false
                            };
                        });
                        return { ...prev, phase: 'round_a', wordProgress: updatedProgress, currentGroupIndex: 0 };
                    }
                    return { ...prev, phase: 'session_summary' };
                }

                default:
                    return prev;
            }
        });
    }, [onUpdateWordStatus]);

    const microReviewWords = useMemo(() => {
        // Now includes ALL words in the current group
        const current = seededShuffle([...currentGroup], Date.now());
        const previous = state.previousGroupItems.length > 0
            ? seededShuffle([...state.previousGroupItems], Date.now()).slice(0, 2)
            : [];
        return seededShuffle([...current, ...previous], Date.now());
    }, [currentGroup, state.previousGroupItems]);

    const sessionReviewWords = useMemo(() => {
        const allWords = state.allGroups.flat();
        const count = Math.min(10, Math.max(5, Math.floor(allWords.length / 2)));
        return seededShuffle([...allWords], Date.now()).slice(0, count);
    }, [state.allGroups]);

    const allSessionWords = useMemo(() => {
        return seededShuffle(state.allGroups.flat(), Date.now() + 1);
    }, [state.allGroups]);

    const groupStats = useMemo(() => ({
        mastered: currentGroup.filter(w => state.wordProgress[w.name]?.mastered).length,
        deferred: currentGroup.filter(w => state.wordProgress[w.name]?.deferred).length,
    }), [currentGroup, state.wordProgress]);

    if (studyList.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground mb-4">No Words to Study</h2>
                    <button onClick={onComplete} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center transition-colors duration-300">
            {/* Header with Exit Button */}
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                <button
                    onClick={onExit || onComplete}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs font-semibold uppercase tracking-wider bg-muted/60 hover:bg-muted px-3.5 py-1.5 rounded-xl border border-border transition-all active:scale-[0.98]"
                >
                    <Icons.ChevronLeft className="w-4 h-4" /> Exit Session
                </button>
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest font-semibold">
                    Study Session
                </span>
            </div>

            {state.phase === 'warmup' && (
                <WarmupView
                    group={currentGroup}
                    groupIndex={state.currentGroupIndex}
                    totalGroups={state.allGroups.length}
                    onComplete={advancePhase}
                />
            )}

            {(state.phase === 'round_a' || state.phase === 'round_b' || state.phase === 'round_c') && (
                <QuizView
                    phase={state.phase}
                    words={wordsForCurrentRound}
                    allVocab={studyList} // Using full list for distractors
                    groupIndex={state.currentGroupIndex}
                    totalGroups={state.allGroups.length}
                    wordProgress={state.wordProgress}
                    onAnswer={handleAnswer}
                    onAnswerWithTime={(name, timeMs) => {
                        setState(prev => ({
                            ...prev,
                            questionTimes: { ...prev.questionTimes, [name]: timeMs }
                        }));
                    }}
                    onComplete={advancePhase}
                />
            )}

            {state.phase === 'writing_test' && (
                <WritingTestView
                    words={currentGroup}
                    groupIndex={state.currentGroupIndex}
                    totalGroups={state.allGroups.length}
                    onAnswer={handleAnswer}
                    onAiCorrect={(name) => {
                        setState(prev => ({
                            ...prev,
                            aiCorrectedWords: Array.from(new Set([...prev.aiCorrectedWords, name]))
                        }));
                    }}
                    onComplete={advancePhase}
                />
            )}

            {state.phase === 'micro_review' && (
                <QuizView
                    phase="micro_review"
                    words={microReviewWords}
                    allVocab={studyList}
                    groupIndex={state.currentGroupIndex}
                    totalGroups={state.allGroups.length}
                    wordProgress={state.wordProgress}
                    onAnswer={() => { }}
                    onAnswerWithTime={(name, timeMs) => {
                        setState(prev => ({
                            ...prev,
                            questionTimes: { ...prev.questionTimes, [name]: timeMs }
                        }));
                    }}
                    onComplete={advancePhase}
                />
            )}

            {state.phase === 'summary' && (
                <GroupSummary
                    groupIndex={state.currentGroupIndex}
                    totalGroups={state.allGroups.length}
                    masteredCount={groupStats.mastered}
                    deferredCount={groupStats.deferred}
                    aiCount={currentGroup.filter(w => state.aiCorrectedWords.includes(w.name)).length}
                    onContinue={advancePhase}
                />
            )}

            {state.phase === 'session_review' && (
                <QuizView
                    phase="session_review"
                    words={sessionReviewWords}
                    allVocab={studyList}
                    groupIndex={state.allGroups.length - 1}
                    totalGroups={state.allGroups.length}
                    wordProgress={state.wordProgress}
                    onAnswer={() => { }}
                    onComplete={advancePhase}
                    hideIndividualFeedback={true}
                />
            )}

            {state.phase === 'session_test' && (
                <WritingTestView
                    words={allSessionWords}
                    groupIndex={state.allGroups.length - 1}
                    totalGroups={state.allGroups.length}
                    title="Deep Recall (All Session)"
                    onAnswer={handleAnswer}
                    onAiCorrect={(name) => {
                        setState(prev => ({
                            ...prev,
                            aiCorrectedWords: Array.from(new Set([...prev.aiCorrectedWords, name]))
                        }));
                    }}
                    onComplete={advancePhase}
                />
            )}

            {state.phase === 'session_summary' && (
                <SessionSummary
                    masteredCount={state.masteredThisSession.length}
                    deferredCount={state.deferredThisSession.length}
                    aiCount={state.aiCorrectedWords.length}
                    totalWords={studyList.length}
                    onExit={onComplete}
                />
            )}
        </div>
    );
});

export default LearnSession;
