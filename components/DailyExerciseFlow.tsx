import React, { useMemo, useCallback } from 'react';
import { Word, WordStatusType } from '../types';
import LearnSession from './LearnSession';
import { hybridService } from '../services/hybridService';

interface DailyExerciseFlowProps {
    wordNames: string[];
    vocab: Word[];
    onComplete: () => void;
    onCancel: () => void;
    onUpdateWordStatus?: (wordName: string, status: WordStatusType) => void;
}

export default function DailyExerciseFlow({ wordNames, vocab, onComplete, onCancel, onUpdateWordStatus }: DailyExerciseFlowProps) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Resolve target 30 words for today
    const assignedWords = useMemo(() => {
        const words = wordNames
            .map(name => vocab.find(w => w.name.toUpperCase() === name.toUpperCase()))
            .filter(Boolean) as Word[];
        return words.length > 0 ? words : vocab.slice(0, 30);
    }, [wordNames, vocab]);

    const handleUpdateWordStatus = useCallback(async (wordName: string, status: WordStatusType) => {
        try {
            // 1. Notify parent App component to update React state instantly
            if (onUpdateWordStatus) {
                onUpdateWordStatus(wordName, status);
            }

            // 2. Save user data (wordStatuses) to hybrid storage
            const userData = await hybridService.getUserData();
            const updatedStatuses = {
                ...(userData?.wordStatuses || {}),
                [wordName.toUpperCase()]: status
            };
            await hybridService.saveUserData({
                wordStatuses: updatedStatuses,
                markedWords: userData?.markedWords || {},
                savedSets: userData?.savedSets || [],
                customVocab: userData?.customVocab || []
            });

            // 3. Update daily progress wordStates
            const currentDaily = await hybridService.getDailyProgress(todayStr);
            if (currentDaily) {
                const updatedStates = {
                    ...(currentDaily.progress?.wordStates || {}),
                    [wordName]: {
                        attempts: (currentDaily.progress?.wordStates?.[wordName]?.attempts || 0) + 1,
                        correct: status === 'mastered'
                    }
                };
                const completedCount = Object.values(updatedStates).filter(s => s.correct).length;
                const completedBatches = Math.min(2, Math.floor((completedCount / (currentDaily.wordNames.length || 30)) * 3));

                await hybridService.saveDailyProgress({
                    ...currentDaily,
                    completed: false, // Ensure early exit never sets true here
                    progress: {
                        completedBatches,
                        wordStates: updatedStates
                    }
                });
            }
        } catch (e) {
            console.error('[DailyExerciseFlow] Error updating word status:', e);
        }
    }, [onUpdateWordStatus, todayStr]);

    const handleExitEarly = useCallback(async () => {
        try {
            const currentDaily = await hybridService.getDailyProgress(todayStr);
            if (currentDaily && !currentDaily.completed) {
                const wordStates = currentDaily.progress?.wordStates || {};
                const completedCount = Object.values(wordStates).filter(s => s.correct).length;
                const completedBatches = Math.min(2, Math.floor((completedCount / (currentDaily.wordNames.length || 30)) * 3));

                await hybridService.saveDailyProgress({
                    ...currentDaily,
                    completed: false, // Explicitly keep completed: false on early exit
                    progress: {
                        completedBatches,
                        wordStates
                    }
                });
            }
        } catch (e) {
            console.error('[DailyExerciseFlow] Error handling early exit:', e);
        } finally {
            onCancel();
        }
    }, [todayStr, onCancel]);

    const handleComplete = useCallback(async () => {
        try {
            const progress = await hybridService.getDailyProgress(todayStr);
            const updated = {
                date: todayStr,
                wordNames: wordNames,
                completed: true,
                completedAt: new Date().toISOString(),
                progress: {
                    completedBatches: 3,
                    wordStates: progress?.progress?.wordStates || {}
                }
            };
            await hybridService.saveDailyProgress(updated);
        } catch (e) {
            console.error('[DailyExerciseFlow] Error saving daily completion:', e);
        } finally {
            onComplete();
        }
    }, [todayStr, wordNames, onComplete]);

    return (
        <div className="w-full min-h-screen bg-background">
            <LearnSession
                studyList={assignedWords}
                onComplete={handleComplete}
                onExit={handleExitEarly}
                onUpdateWordStatus={handleUpdateWordStatus}
            />
        </div>
    );
}
