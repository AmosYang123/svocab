import React, { useMemo, useCallback } from 'react';
import { Word, WordStatusType } from '../types';
import LearnSession from './LearnSession';
import { hybridService } from '../services/hybridService';

interface DailyExerciseFlowProps {
    wordNames: string[];
    vocab: Word[];
    onComplete: () => void;
    onCancel: () => void;
}

export default function DailyExerciseFlow({ wordNames, vocab, onComplete }: DailyExerciseFlowProps) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Resolve target 30 words for today
    const assignedWords = useMemo(() => {
        const words = wordNames
            .map(name => vocab.find(w => w.name === name))
            .filter(Boolean) as Word[];
        return words.length > 0 ? words : vocab.slice(0, 30);
    }, [wordNames, vocab]);

    const handleUpdateWordStatus = useCallback(async (wordName: string, status: WordStatusType) => {
        try {
            const userData = await hybridService.getUserData();
            const updatedStatuses = {
                ...(userData?.wordStatuses || {}),
                [wordName]: status
            };
            await hybridService.saveUserData({
                wordStatuses: updatedStatuses,
                markedWords: userData?.markedWords || {},
                savedSets: userData?.savedSets || [],
                customVocab: userData?.customVocab || []
            });
        } catch (e) {
            console.error('[DailyExerciseFlow] Error updating word status:', e);
        }
    }, []);

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
                onUpdateWordStatus={handleUpdateWordStatus}
            />
        </div>
    );
}
