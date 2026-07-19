import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Word, TestType, MarkedWordsMap, WordStatusType } from '../types';
import { Icons } from './Icons';
import { scoreWritingAnswerAI } from '../services/groqService';
import { scoreAnswerOffline, extractSynonyms, cleanDef } from '../utils';

interface TestInterfaceProps {
  studyList: Word[];
  vocab: Word[];
  testType: TestType;
  markedWords: MarkedWordsMap;
  wordStatuses: Record<string, WordStatusType>;
  onToggleMark: (name: string) => void;
  onUpdateWordStatus: (wordName: string, status: WordStatusType) => void;
  onCancel: () => void;
}

interface TestResult {
  correct: number;
  total: number;
  percent: number;
  missed: Word[];
  mastered: Word[];
  marked: Word[];
}

const TestInterface: React.FC<TestInterfaceProps> = ({
  studyList: initialStudyList,
  vocab,
  testType,
  markedWords,
  wordStatuses,
  onToggleMark,
  onUpdateWordStatus,
  onCancel
}) => {
  const [currentTestList, setCurrentTestList] = useState<Word[]>(initialStudyList);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [localMarked, setLocalMarked] = useState<Record<number, boolean>>({});
  const [keepInPool, setKeepInPool] = useState<Record<number, boolean>>({});
  const [cycleNumber, setCycleNumber] = useState(1);
  const [totalMasteredThisSession, setTotalMasteredThisSession] = useState(0);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [aiResults, setAiResults] = useState<Record<number, boolean | null>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);

  const mcQuestions = useMemo(() => {
    if (testType !== 'multiple-choice') return [];
    return currentTestList.map((word) => {
      const distractors: string[] = [];
      const maxAttempts = 50;
      let attempts = 0;
      const strippedCorrect = cleanDef(word.definition);

      while (distractors.length < 3 && attempts < maxAttempts) {
        attempts++;
        const randIdx = Math.floor(Math.random() * vocab.length);
        const candidate = vocab[randIdx];
        const strippedCandidate = cleanDef(candidate.definition);
        if (candidate.name !== word.name && !distractors.includes(strippedCandidate) && strippedCandidate !== strippedCorrect) {
          distractors.push(strippedCandidate);
        }
      }
      const options = [strippedCorrect, ...distractors].sort(() => Math.random() - 0.5);
      return { word, options, strippedCorrect };
    });
  }, [currentTestList, vocab, testType]);

  const isAnswerCorrect = useCallback((idx: number) => {
    // Check manual override first
    if (overrides[idx] !== undefined) {
      return overrides[idx];
    }

    // Check AI result if available
    if (aiResults[idx] === true) return true;
    if (aiResults[idx] === false) return false;

    const word = currentTestList[idx];
    const userAns = (answers[idx] || '').trim();
    const actual = cleanDef(word.definition).trim();

    // For multiple choice, exact match required
    if (testType === 'multiple-choice') {
      return userAns.toLowerCase() === actual.toLowerCase();
    }

    // Use centralized offline scoring
    const synonyms = extractSynonyms(word.definition);
    return scoreAnswerOffline(userAns, actual, synonyms);
  }, [answers, currentTestList, testType, overrides, aiResults]);

  const results = useMemo((): TestResult | null => {
    if (!submitted) return null;
    let correct = 0;
    const missed: Word[] = [];
    const mastered: Word[] = [];

    currentTestList.forEach((word, idx) => {
      const isCorrect = isAnswerCorrect(idx);
      if (isCorrect) {
        correct++;
        if (!keepInPool[idx]) {
          mastered.push(word);
        }
      } else {
        missed.push(word);
      }
    });

    const markedWordsList = currentTestList.filter((_, idx) => localMarked[idx] || markedWords[currentTestList[idx].name]);

    return {
      correct,
      total: currentTestList.length,
      percent: Math.round((correct / currentTestList.length) * 100),
      missed,
      mastered,
      marked: markedWordsList
    };
  }, [submitted, answers, currentTestList, testType, localMarked, markedWords, keepInPool, isAnswerCorrect]);

  useEffect(() => {
    if (!results) return;
    results.mastered.forEach(word => {
      onUpdateWordStatus(word.name, 'mastered');
    });
    results.missed.forEach(word => {
      onUpdateWordStatus(word.name, 'review');
    });
    setTotalMasteredThisSession(prev => prev + results.mastered.length);
  }, [results, onUpdateWordStatus]);

  const handleSubmit = async () => {
    if (testType === 'type-in') {
      setIsEvaluating(true);
      const newAiResults: Record<number, boolean | null> = {};

      // Run all AI evaluations in parallel
      const aiPromises = currentTestList.map(async (word, idx) => {
        const userAns = (answers[idx] || '').trim();
        if (!userAns) {
          newAiResults[idx] = false;
          return;
        }

        const synonyms = extractSynonyms(word.definition);
        const result = await scoreWritingAnswerAI(userAns, cleanDef(word.definition), synonyms);
        newAiResults[idx] = result;
      });

      await Promise.all(aiPromises);
      setAiResults(newAiResults);
      setIsEvaluating(false);
    }

    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContinueLearning = useCallback(() => {
    if (!results || results.missed.length === 0) return;
    // Shuffle the missed words for variety
    const shuffled = [...results.missed].sort(() => Math.random() - 0.5);
    setCurrentTestList(shuffled);
    setAnswers({});
    setSubmitted(false);
    setLocalMarked({});
    setKeepInPool({});
    setOverrides({});
    setAiResults({});
    setCycleNumber(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [results]);

  const handleReQuizAll = useCallback(() => {
    if (!results) return;
    const combined = Array.from(new Set([...results.missed, ...results.marked].map(w => w.name)))
      .map(name => vocab.find(v => v.name === name)!);
    if (combined.length === 0) {
      return;
    }
    setCurrentTestList(combined.sort(() => Math.random() - 0.5));
    setAnswers({});
    setSubmitted(false);
    setLocalMarked({});
    setKeepInPool({});
    setOverrides({});
    setAiResults({});
    setCycleNumber(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [results, vocab]);

  const toggleLocalMark = (idx: number, wordName: string) => {
    setLocalMarked(prev => ({ ...prev, [idx]: !prev[idx] }));
    onToggleMark(wordName);
  };

  const toggleKeepInPool = (idx: number) => {
    setKeepInPool(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Progress calculation
  const answeredCount = Object.keys(answers).length;
  const progressPercent = (answeredCount / currentTestList.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Sticky Header */}
        <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl rounded-xl shadow-xs border border-border mb-6 overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  {cycleNumber > 1 ? `Round ${cycleNumber}` : 'Vocabulary Test'}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {testType === 'multiple-choice' ? 'Multiple Choice' : 'Type Answer'} • {currentTestList.length} questions
                </p>
              </div>
              <div className="flex items-center gap-3">
                {cycleNumber > 1 && (
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-xs font-semibold">
                    <Icons.Trophy />
                    <span>{totalMasteredThisSession} mastered</span>
                  </div>
                )}
                <button
                  onClick={onCancel}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <Icons.Close />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {!submitted && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-mono">
                  <span>{answeredCount} of {currentTestList.length} answered</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Card */}
        {submitted && results && (
          <div className="bg-card rounded-xl shadow-xs border border-border mb-6 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-8 text-center">
              {/* Score Circle */}
              <div className="relative inline-flex items-center justify-center mb-6">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                  <circle
                    cx="64" cy="64" r="56"
                    stroke={results.percent >= 80 ? '#10b981' : results.percent >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${results.percent * 3.52} 352`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-bold ${results.percent >= 80 ? 'text-emerald-600' : results.percent >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                    {results.percent}%
                  </span>
                </div>
              </div>

              <p className="text-muted-foreground text-sm mb-6">
                You got <span className="font-semibold text-foreground">{results.correct}</span> out of <span className="font-semibold text-foreground">{results.total}</span> correct
              </p>

              {/* Stats Pills */}
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl">
                  <Icons.Trophy />
                  <span className="text-sm font-medium">{results.mastered.length} Mastered</span>
                </div>
                {Object.values(aiResults).filter(v => v === true).length > 0 && (
                  <div className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl shadow-xs">
                    <Icons.Brain />
                    <span className="text-sm font-medium">{Object.values(aiResults).filter(v => v === true).length} AI Validated</span>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl">
                  <Icons.Brain />
                  <span className="text-sm font-medium">{results.missed.length} To Review</span>
                </div>
                {results.marked.length > 0 && (
                  <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-xl">
                    <Icons.Flag />
                    <span className="text-sm font-medium">{results.marked.length} Flagged</span>
                  </div>
                )}
              </div>

              {/* Perfect Score Message */}
              {results.missed.length === 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-bold text-emerald-800">Perfect Score</h3>
                  <p className="text-emerald-600 text-sm">All words have been mastered.</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                {results.missed.length > 0 && (
                  <button
                    onClick={handleContinueLearning}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-medium transition-all active:scale-[0.98] shadow-xs"
                  >
                    <Icons.Brain />
                    Continue Learning
                  </button>
                )}
                {results.marked.length > 0 && (
                  <button
                    onClick={handleReQuizAll}
                    className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-medium transition-all active:scale-[0.98]"
                  >
                    <Icons.Flag />
                    Include Flagged
                  </button>
                )}
                <button
                  onClick={onCancel}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all active:scale-[0.98] ${results.missed.length === 0
                    ? 'flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                    }`}
                >
                  {results.missed.length === 0 ? 'Complete' : 'Finish'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {currentTestList.map((word, idx) => {
            const userAns = answers[idx] || '';
            const strippedActual = cleanDef(word.definition);
            const isCorrect = isAnswerCorrect(idx);
            const isMarked = localMarked[idx] || markedWords[word.name];
            const isAnswered = userAns.length > 0;

            return (
              <div
                key={`${cycleNumber}-${idx}`}
                className={`bg-card rounded-xl border transition-all duration-300 overflow-hidden ${submitted
                  ? isCorrect
                    ? 'border-emerald-500/30 shadow-xs'
                    : 'border-destructive/30 shadow-xs'
                  : isAnswered
                    ? 'border-primary/50 shadow-xs'
                    : 'border-border shadow-xs hover:border-primary/30'
                  }`}
              >
                {/* Question Header */}
                <div className={`px-5 py-4 flex items-center justify-between ${submitted
                  ? isCorrect ? 'bg-emerald-500/10' : 'bg-destructive/10'
                  : isAnswered ? 'bg-primary/5' : 'bg-muted/50'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold ${submitted
                      ? isCorrect ? 'bg-emerald-500/20 text-emerald-600' : 'bg-destructive/20 text-destructive'
                      : isAnswered ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                      {idx + 1}
                    </span>
                    <h3 className="text-lg font-bold text-foreground tracking-tight">{word.name}</h3>
                    {wordStatuses[word.name] && (
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${wordStatuses[word.name] === 'mastered'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-amber-100 text-amber-600'
                        }`}>
                        {wordStatuses[word.name]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {submitted && isCorrect && (
                      <button
                        onClick={() => toggleKeepInPool(idx)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${keepInPool[idx]
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                          }`}
                      >
                        <Icons.Book />
                        {keepInPool[idx] ? 'Kept in pool' : 'Keep learning'}
                      </button>
                    )}
                    <button
                      onClick={() => toggleLocalMark(idx, word.name)}
                      className={`p-2 rounded-lg transition-all ${isMarked
                        ? 'bg-orange-500 text-white'
                        : 'bg-muted text-muted-foreground/60 hover:text-orange-500 hover:bg-orange-500/10'
                        }`}
                    >
                      <Icons.Flag />
                    </button>
                  </div>
                </div>

                {/* Answer Options */}
                <div className="p-5">
                  {testType === 'multiple-choice' ? (
                    <div className="space-y-2">
                      {mcQuestions[idx]?.options.map((opt, oIdx) => {
                        const isSelected = userAns === opt;
                        const isActualCorrect = opt === strippedActual;

                        return (
                          <button
                            key={oIdx}
                            disabled={submitted}
                            onClick={() => setAnswers(prev => ({ ...prev, [idx]: opt }))}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 ${submitted
                              ? isActualCorrect
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                                : isSelected
                                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                                  : 'bg-muted/40 border-border text-muted-foreground'
                              : isSelected
                                ? 'bg-primary/10 border-primary/40 text-foreground'
                                : 'bg-card border-border text-foreground hover:border-primary/30 hover:bg-muted/50'
                              }`}
                          >
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${submitted
                              ? isActualCorrect
                                ? 'border-emerald-500 bg-emerald-500'
                                : isSelected
                                  ? 'border-destructive bg-destructive'
                                  : 'border-border'
                              : isSelected
                                ? 'border-primary bg-primary'
                                : 'border-border'
                              }`}>
                              {(isSelected || (submitted && isActualCorrect)) && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                            <span className="text-sm leading-relaxed">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        disabled={submitted}
                        type="text"
                        placeholder="Type the definition..."
                        className={`w-full py-3.5 px-5 rounded-xl border outline-none transition-all text-sm ${submitted
                          ? isCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                            : 'bg-destructive/10 border-destructive/30 text-destructive'
                          : 'bg-card border-input text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/60'
                          }`}
                        value={userAns}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                      />
                      {submitted && !isCorrect && (
                        <div className="bg-muted border border-border rounded-xl p-4">
                          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">Correct answer</span>
                          <p className="text-foreground mt-1 font-medium">{strippedActual}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Indicator with Override */}
                  {submitted && (
                    <div className="flex items-center justify-between mt-4">
                      <div className={`flex items-center gap-2 text-sm font-medium ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isCorrect ? (
                          <>
                            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="flex items-center gap-2">
                              {keepInPool[idx] ? 'Correct — Kept in study pool' : 'Correct — Marked as mastered'}
                              {aiResults[idx] === true && (
                                <div className="flex items-center gap-1 bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider shadow-xs">
                                  <Icons.Brain />
                                  AI Validated
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            Incorrect — Added to review list
                            {aiResults[idx] === false && (
                              <div className="flex items-center gap-1 bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ml-2">
                                <Icons.Brain />
                                AI Verified
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => setOverrides(prev => ({
                          ...prev,
                          [idx]: !isCorrect
                        }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${overrides[idx] !== undefined
                          ? 'bg-amber-500/20 text-amber-600'
                          : 'bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'
                          }`}
                        title="Override: click to mark as correct/incorrect"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Override
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        {!submitted && (
          <div className="sticky bottom-6 mt-6">
            <button
              onClick={handleSubmit}
              disabled={answeredCount === 0 || isEvaluating}
              className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground rounded-xl font-semibold text-base transition-all active:scale-[0.98] shadow-xs flex items-center justify-center gap-2"
            >
              {isEvaluating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Evaluating Answers...
                </>
              ) : (
                'Submit Test'
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default TestInterface;