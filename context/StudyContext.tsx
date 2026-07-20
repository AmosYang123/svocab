import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Word, WordStatusType, StudyMode, MarkedWordsMap, WordStatusMap, StudySet, ThemeMode } from '../types';
import { hybridService } from '../services/hybridService';
import { VOCAB_LIST } from '../data/vocab';
import { SAT_VOCAB_LIST } from '../data/sat_vocab';
import { seededShuffle, generateUUID } from '../utils';

interface StudyContextType {
    vocab: Word[];
    studyList: Word[];
    wordStatuses: WordStatusMap;
    markedWords: MarkedWordsMap;
    savedSets: StudySet[];
    studyMode: StudyMode;
    activeSetId: string | null;
    currentIndex: number;
    showDefinition: boolean;
    showJumpSearch: boolean;
    theme: ThemeMode;
    showDefaultVocab: boolean;
    showSatVocab: boolean;
    isPro: boolean;
    currentStats: {
        mastered: number;
        review: number;
        marked: number;
        notStudied: number;
        total: number;
    };
    // Actions
    setStudyMode: (mode: StudyMode, setId?: string) => void;
    setCurrentIndex: (idx: number) => void;
    setShowDefinition: (show: boolean | ((prev: boolean) => boolean)) => void;
    setShowJumpSearch: (show: boolean) => void;
    markWord: (status: WordStatusType) => void;
    toggleMark: (wordName: string) => void;
    updateWordStatus: (wordName: string, status: WordStatusType) => void;
    saveNewSet: (name: string, wordNames: string[]) => void;
    deleteSet: (id: string) => void;
    renameSet: (id: string, newName: string) => void;
    shuffleStudyList: () => void;
    updatePreferences: (theme: ThemeMode, showDefault: boolean, showSat?: boolean) => void;
    jumpToWord: (wordName: string) => void;
    refreshUserData: () => Promise<void>;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [wordStatuses, setWordStatuses] = useState<WordStatusMap>({});
    const [markedWords, setMarkedWords] = useState<MarkedWordsMap>({});
    const [savedSets, setSavedSets] = useState<StudySet[]>([]);
    const [theme, setTheme] = useState<ThemeMode>('dark');
    const [showDefaultVocab, setShowDefaultVocab] = useState(true);
    const [showSatVocab, setShowSatVocab] = useState(false);
    const [studyMode, setStudyModeState] = useState<StudyMode>('all');
    const [activeSetId, setActiveSetId] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showDefinition, setShowDefinition] = useState(false);
    const [showJumpSearch, setShowJumpSearch] = useState(false);
    const [customVocab, setCustomVocab] = useState<Word[]>([]);
    const [shuffleSeed, setShuffleSeed] = useState(0);
    const [isPro, setIsPro] = useState(false);

    // Initial load
    const loadUserData = useCallback(async () => {
        try {
            const data = await hybridService.getUserData();
            if (data) {
                setWordStatuses(data.wordStatuses || {});
                setMarkedWords(data.markedWords || {});
                setSavedSets(data.savedSets || []);
                setCustomVocab(data.customVocab || []);
            }

            const prefs = await hybridService.getPreferences();
            if (prefs) {
                setTheme(prefs.theme || 'dark');
                setShowDefaultVocab(prefs.showDefaultVocab ?? true);
                setShowSatVocab(prefs.showSatVocab ?? false);
                if (prefs.lastStudyMode) setStudyModeState(prefs.lastStudyMode as StudyMode);
                if (prefs.lastActiveSetId) setActiveSetId(prefs.lastActiveSetId);
                if (prefs.lastCardIndex) setCurrentIndex(prefs.lastCardIndex);
            }

            const currentUser = await hybridService.getCurrentUser();
            if (currentUser) {
                setIsPro(currentUser.isPro);
            }
        } catch (e) {
            console.error("StudyContext: loadUserData error", e);
        }
    }, []);

    useEffect(() => {
        loadUserData();
    }, [loadUserData]);

    // Compute base active vocabulary based on toggles
    const vocab = useMemo(() => {
        let base: Word[] = [];
        if (showDefaultVocab) base = [...base, ...VOCAB_LIST];
        if (showSatVocab) base = [...base, ...SAT_VOCAB_LIST];
        if (customVocab.length > 0) base = [...base, ...customVocab];
        return base.length > 0 ? base : VOCAB_LIST;
    }, [showDefaultVocab, showSatVocab, customVocab]);

    // Compute study list based on study mode & filter
    const studyList = useMemo(() => {
        let list: Word[] = [];

        if (activeSetId) {
            const set = savedSets.find(s => s.id === activeSetId);
            if (set) {
                list = set.wordNames.map(name => vocab.find(w => w.name === name)).filter(Boolean) as Word[];
            }
        } else {
            switch (studyMode) {
                case 'mastered':
                    list = vocab.filter(w => wordStatuses[w.name] === 'mastered');
                    break;
                case 'review':
                    list = vocab.filter(w => wordStatuses[w.name] === 'review');
                    break;
                case 'marked':
                    list = vocab.filter(w => markedWords[w.name]);
                    break;
                case 'basic':
                case 'easy':
                case 'medium':
                case 'hard':
                    list = vocab.filter(w => w.difficulty === studyMode);
                    break;
                case 'random':
                    list = [...vocab].sort(() => Math.random() - 0.5).slice(0, 50);
                    break;
                default:
                    list = vocab;
                    break;
            }
        }

        if (shuffleSeed > 0) {
            return seededShuffle(list, shuffleSeed);
        }

        return list;
    }, [vocab, activeSetId, savedSets, studyMode, wordStatuses, markedWords, shuffleSeed]);

    // Compute stats
    const currentStats = useMemo(() => {
        const total = vocab.length;
        let mastered = 0;
        let review = 0;
        let marked = 0;

        vocab.forEach(w => {
            const status = wordStatuses[w.name];
            if (status === 'mastered') mastered++;
            if (status === 'review') review++;
            if (markedWords[w.name]) marked++;
        });

        const notStudied = total - mastered - review;

        return { mastered, review, marked, notStudied, total };
    }, [vocab, wordStatuses, markedWords]);

    // Actions
    const setStudyMode = useCallback((mode: StudyMode, setId?: string) => {
        setStudyModeState(mode);
        setActiveSetId(setId || null);
        setCurrentIndex(0);
        setShowDefinition(false);
        hybridService.savePreferences(theme, showDefaultVocab, showSatVocab, mode, setId || undefined, 0);
    }, [theme, showDefaultVocab, showSatVocab]);

    const markWord = useCallback((status: WordStatusType) => {
        if (studyList.length === 0) return;
        const currentWord = studyList[currentIndex];
        if (!currentWord) return;

        const newStatuses = { ...wordStatuses, [currentWord.name]: status };
        setWordStatuses(newStatuses);

        hybridService.saveUserData({
            wordStatuses: newStatuses,
            markedWords,
            savedSets,
            customVocab
        });

        // Auto advance to next card
        if (currentIndex < studyList.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setShowDefinition(false);
        }
    }, [studyList, currentIndex, wordStatuses, markedWords, savedSets, customVocab]);

    const toggleMark = useCallback((wordName: string) => {
        const newMarked = { ...markedWords, [wordName]: !markedWords[wordName] };
        setMarkedWords(newMarked);
        hybridService.saveUserData({
            wordStatuses,
            markedWords: newMarked,
            savedSets,
            customVocab
        });
    }, [markedWords, wordStatuses, savedSets, customVocab]);

    const updateWordStatus = useCallback((wordName: string, status: WordStatusType) => {
        const newStatuses = { ...wordStatuses, [wordName]: status };
        setWordStatuses(newStatuses);
        hybridService.saveUserData({
            wordStatuses: newStatuses,
            markedWords,
            savedSets,
            customVocab
        });
    }, [wordStatuses, markedWords, savedSets, customVocab]);

    const saveNewSet = useCallback((name: string, wordNames: string[]) => {
        const newSet: StudySet = {
            id: generateUUID(),
            name,
            wordNames
        };
        const newSets = [...savedSets, newSet];
        setSavedSets(newSets);
        hybridService.saveUserData({
            wordStatuses,
            markedWords,
            savedSets: newSets,
            customVocab
        });
    }, [savedSets, wordStatuses, markedWords, customVocab]);

    const deleteSet = useCallback((id: string) => {
        const newSets = savedSets.filter(s => s.id !== id);
        setSavedSets(newSets);
        if (activeSetId === id) {
            setActiveSetId(null);
            setStudyModeState('all');
        }
        hybridService.saveUserData({
            wordStatuses,
            markedWords,
            savedSets: newSets,
            customVocab
        });
    }, [savedSets, activeSetId, wordStatuses, markedWords, customVocab]);

    const renameSet = useCallback((id: string, newName: string) => {
        const newSets = savedSets.map(s => s.id === id ? { ...s, name: newName } : s);
        setSavedSets(newSets);
        hybridService.saveUserData({
            wordStatuses,
            markedWords,
            savedSets: newSets,
            customVocab
        });
    }, [savedSets, wordStatuses, markedWords, customVocab]);

    const shuffleStudyList = useCallback(() => {
        setShuffleSeed(Date.now());
        setCurrentIndex(0);
        setShowDefinition(false);
    }, []);

    const updatePreferences = useCallback((newTheme: ThemeMode, newShowDefault: boolean, newShowSat?: boolean) => {
        setTheme(newTheme);
        setShowDefaultVocab(newShowDefault);
        if (newShowSat !== undefined) setShowSatVocab(newShowSat);

        // Apply HTML document dark class
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
        }

        hybridService.savePreferences(newTheme, newShowDefault, newShowSat ?? showSatVocab, studyMode, activeSetId || undefined, currentIndex);
    }, [showSatVocab, studyMode, activeSetId, currentIndex]);

    const jumpToWord = useCallback((wordName: string) => {
        const idx = studyList.findIndex(w => w.name.toLowerCase() === wordName.toLowerCase());
        if (idx !== -1) {
            setCurrentIndex(idx);
            setShowDefinition(false);
        }
    }, [studyList]);

    const value = {
        vocab,
        studyList,
        wordStatuses,
        markedWords,
        savedSets,
        studyMode,
        activeSetId,
        currentIndex,
        showDefinition,
        showJumpSearch,
        theme,
        showDefaultVocab,
        showSatVocab,
        isPro,
        currentStats,
        setStudyMode,
        setCurrentIndex,
        setShowDefinition,
        setShowJumpSearch,
        markWord,
        toggleMark,
        updateWordStatus,
        saveNewSet,
        deleteSet,
        renameSet,
        shuffleStudyList,
        updatePreferences,
        jumpToWord,
        refreshUserData: loadUserData
    };

    return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
};

export const useStudy = () => {
    const context = useContext(StudyContext);
    if (!context) {
        throw new Error('useStudy must be used within a StudyProvider');
    }
    return context;
};
