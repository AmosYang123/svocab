export interface Word {
  name: string;
  definition: string;
  priority: 1 | 2; // 1: High, 2: Low
  difficulty: 'basic' | 'easy' | 'medium' | 'hard';
  version?: 'old' | 'new';
  synonyms?: string;
  example?: string;
}

export type WordStatusType = 'mastered' | 'review' | null;

export type StudyMode = 'all' | 'random' | 'mastered' | 'review' | 'custom' | 'marked' |
  'basic' | 'easy' | 'medium' | 'hard' |
  'new_all' | 'new_basic' | 'new_easy' | 'new_medium' | 'new_hard' |
  'old_all' | 'old_basic' | 'old_easy' | 'old_medium' | 'old_hard';

export type TestType = 'multiple-choice' | 'type-in';

export interface TestAnswer {
  questionIndex: number;
  userAnswer: string;
}

export interface WordStatusMap {
  [wordName: string]: WordStatusType;
}

export interface MarkedWordsMap {
  [wordName: string]: boolean;
}

export interface StudySet {
  id: string;
  name: string;
  wordNames: string[];
}

export type ThemeMode = 'light' | 'dark';

export interface UserPreferences {
  theme: ThemeMode;
  showDefaultVocab: boolean;
  showSatVocab?: boolean;
  reminderEnabled?: boolean;
  reminderTime?: string; // e.g. "09:00"
}

export interface DailyProgress {
  date: string; // YYYY-MM-DD
  wordNames: string[];
  completed: boolean;
  completedAt: string | null;
  progress: {
    completedBatches: number; // 0 to 3
    wordStates: {
      [wordName: string]: {
        attempts: number;
        correct: boolean;
      }
    };
  };
}

// --- Learn Mode Types ---

export type LearnPhase = 'warmup' | 'round_a' | 'round_b' | 'round_c' | 'micro_review' | 'summary' | 'session_review' | 'session_summary';

export interface LearnState {
  // Session Configuration
  totalWords: number;
  remainingGroups: Word[][];
  currentGroup: Word[];

  // Current State
  phase: LearnPhase;
  roundProgress: number; // Index in current group

  // Progress Tracking
  masteredInSession: string[]; // Word names
  deferredInSession: string[]; // Word names (failed too many times)
  roundHistory: {
    [wordName: string]: {
      a: boolean | null; // null = not attempted yet
      b: boolean | null;
      c: boolean | null;
      attempts: number;
    }
  };
}