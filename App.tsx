import React, { useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Word, WordStatusType, StudyMode, TestType, WordStatusMap, MarkedWordsMap, StudySet, ThemeMode } from './types';
import { PLACEHOLDER_VOCAB } from './data/vocab';
import { SAT_VOCAB } from './data/sat_vocab';
import { Icons } from './components/Icons';
import { seededShuffle } from './utils';
import LoginPage from './components/LoginPage';
// Lazy loaded below
import { authService } from './authService';
import { hybridService, StorageMode } from './services/hybridService';
import { cloudService } from './services/cloudService';

import SidebarLayout from './components/SidebarLayout';
import DailyStudyCenter from './components/DailyStudyCenter';
import DailyExerciseFlow from './components/DailyExerciseFlow';
import { notificationService } from './services/notificationService';

import SettingsModal from './components/SettingsModal';
const TestInterface = lazy(() => import('./components/TestInterface'));
const LearnSession = lazy(() => import('./components/LearnSession'));
const LazyWordSelectorModal = lazy(() => import('./components/WordSelectorModal'));
const ImportWordsModal = lazy(() => import('./components/ImportWordsModal'));
const PaymentModal = lazy(() => import('./components/PaymentModal'));
import PricingPage from './components/PricingPage';
const PaymentPage = lazy(() => import('./components/PaymentModal')); // Re-using for now, will serve as page container logic wrapper if needed, but we will pass props to make it full screen or handle it via route. Actually, let's just use the Modal for now but triggered via route, or better, import the new pages.
// Wait, I created PricingPage.tsx. I need PaymentPage.tsx? I haven't created PaymentPage.tsx. I will just use the Modal style for checkout but maybe wrapped? 
// The user asked for "different pages". 
// I will create a wrapper component for PaymentPage inline or lazy load it if later created.
// For now, let's treat PaymentModal as a component we can render at a route.
// But PaymentModal has "onClose".
// Let's create a definition for PaymentRoute wrapper.

const PaymentRouteWrapper = () => {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
      <Suspense fallback={<div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Loading...</div>}>
        <PaymentModal onClose={() => navigate('/')} onUpgrade={() => navigate('/')} />
      </Suspense>
    </div>
  );
};

// Daily Exercise flow loader with resilient auto-generation
const DailyExerciseRoute = ({ vocab }: { vocab: Word[] }) => {
  const [words, setWords] = useState<string[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        let daily = await hybridService.getDailyProgress(todayStr);

        if (daily && daily.wordNames && daily.wordNames.length > 0) {
          setWords(daily.wordNames);
        } else {
          // Auto-generate today's 30 words if missing instead of redirecting back
          const userData = await hybridService.getUserData();
          const studiedWordNames = new Set(Object.keys(userData?.wordStatuses || {}));
          const unstudiedWords = vocab.filter(w => !studiedWordNames.has(w.name));
          let selectedNames = unstudiedWords.slice(0, 30).map(w => w.name);

          if (selectedNames.length < 30) {
            const unmastered = vocab.filter(w => !selectedNames.includes(w.name) && userData?.wordStatuses[w.name] !== 'mastered');
            selectedNames = [...selectedNames, ...unmastered.slice(0, 30 - selectedNames.length).map(w => w.name)];
          }

          if (selectedNames.length < 30) {
            const remaining = vocab.filter(w => !selectedNames.includes(w.name));
            selectedNames = [...selectedNames, ...remaining.slice(0, 30 - selectedNames.length).map(w => w.name)];
          }

          const newRecord = {
            date: todayStr,
            wordNames: selectedNames,
            completed: false,
            completedAt: null,
            progress: {
              completedBatches: 0,
              wordStates: {}
            }
          };

          await hybridService.saveDailyProgress(newRecord);
          setWords(selectedNames);
        }
      } catch (e) {
        console.error('Error loading daily exercise:', e);
        // Fallback: use first 30 words in vocab
        setWords(vocab.slice(0, 30).map(w => w.name));
      }
    }
    load();
  }, [vocab]);

  if (!words) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 p-8 border border-border bg-card">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin"></div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Preparing daily exercise...</p>
        </div>
      </div>
    );
  }

  return (
    <DailyExerciseFlow
      wordNames={words}
      vocab={vocab}
      onComplete={() => navigate('/daily')}
      onCancel={() => navigate('/daily')}
    />
  );
};

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_placeholder');

import MainDashboard from './components/MainDashboard';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();


  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return authService.getCurrentUser();
  });
  const [storageMode, setStorageMode] = useState<StorageMode>(() => {
    return (localStorage.getItem('ssat_storage_mode') as StorageMode) || (cloudService.isConfigured() ? 'hybrid' : 'local');
  });
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // --- PREFERENCES (Synchronous initialization from localStorage for instant recovery) ---
  const getInitialPrefs = () => {
    const user = authService.getCurrentUser();
    if (user) {
      const saved = localStorage.getItem(`ssat_prefs_${user.toLowerCase()}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  };

  const initialPrefs = getInitialPrefs();

  const [theme, setTheme] = useState<ThemeMode>(initialPrefs?.theme || 'light');
  const [showDefaultVocab, setShowDefaultVocab] = useState<boolean>(initialPrefs?.showDefaultVocab ?? true);
  const [showSatVocab, setShowSatVocab] = useState<boolean>(initialPrefs?.showSatVocab ?? false);
  const [isPro, setIsPro] = useState<boolean>(initialPrefs?.isPro ?? false);

  // --- STATE ---
  const [customVocab, setCustomVocab] = useState<Word[]>([]);
  const vocab = useMemo(() => {
    let combined = [...customVocab];
    if (showDefaultVocab) combined = [...combined, ...PLACEHOLDER_VOCAB];
    if (showSatVocab) combined = [...combined, ...SAT_VOCAB];

    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [customVocab, showDefaultVocab, showSatVocab]);

  // Data Persistence (now empty by default, loaded from DB)
  const [wordStatuses, setWordStatuses] = useState<WordStatusMap>({});
  const [markedWords, setMarkedWords] = useState<MarkedWordsMap>({});
  const [savedSets, setSavedSets] = useState<StudySet[]>([]);

  // Navigation Persistence (Synchronous initialization)
  const [studyMode, setStudyMode] = useState<StudyMode>(() => {
    const user = authService.getCurrentUser();
    if (!user) return 'all';
    return (localStorage.getItem(`ssat_${user}_mode`) as StudyMode) || 'all';
  });
  const [activeSetId, setActiveSetId] = useState<string | null>(() => {
    const user = authService.getCurrentUser();
    if (!user) return null;
    return localStorage.getItem(`ssat_${user}_set_id`);
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    const user = authService.getCurrentUser();
    if (!user) return 0;
    const lastIdx = localStorage.getItem(`ssat_${user}_index`);
    return lastIdx ? parseInt(lastIdx, 10) : 0;
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isPrefsLoaded, setIsPrefsLoaded] = useState(false);

  const [showDefinition, setShowDefinition] = useState(false);

  // Modals / Overlays
  const [showWordSelector, setShowWordSelector] = useState(false);
  const [showTestOptions, setShowTestOptions] = useState(false);
  const [testType, setTestType] = useState<TestType>('multiple-choice');
  const [showJumpSearch, setShowJumpSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const handleUpgrade = useCallback(async () => {
    setIsPro(true);
    if (currentUser) {
      await hybridService.updateProStatus(true);
    }
  }, [currentUser]);

  // Shuffle State
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);

  // Recent Import State
  const [lastImportedNames, setLastImportedNames] = useState<string[]>([]);

  // Load cloud preferences (asynchronously upgrade local state if needed)
  useEffect(() => {
    async function loadPreferences() {
      if (!currentUser) return;
      const prefs = await hybridService.getPreferences();
      if (prefs) {
        setTheme(prefs.theme);
        setShowDefaultVocab(prefs.showDefaultVocab ?? true);
        setShowSatVocab(prefs.showSatVocab ?? false);
        setIsPro(prefs.isPro ?? false);

        // Restore session state if available in cloud
        if (prefs.lastStudyMode) setStudyMode(prefs.lastStudyMode as StudyMode);
        if (prefs.lastActiveSetId) setActiveSetId(prefs.lastActiveSetId);
        if (prefs.lastCardIndex !== undefined) setCurrentIndex(prefs.lastCardIndex);
      }
      setIsPrefsLoaded(true);
    }
    loadPreferences();
  }, [currentUser]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Set up daily notification scheduler
  useEffect(() => {
    if (currentUser) {
      const cleanup = notificationService.setupDailyScheduler();
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, [currentUser]);

  const handleUpdatePreferences = useCallback(async (newTheme: ThemeMode, newShowDefault: boolean, newShowSat?: boolean) => {
    setTheme(newTheme);
    setShowDefaultVocab(newShowDefault);
    const finalShowSat = newShowSat !== undefined ? newShowSat : showSatVocab;
    if (newShowSat !== undefined) setShowSatVocab(newShowSat);

    if (currentUser) {
      await hybridService.savePreferences(
        newTheme,
        newShowDefault,
        finalShowSat,
        studyMode,
        activeSetId || undefined,
        currentIndex
      );
    }
  }, [currentUser, showSatVocab, theme, showDefaultVocab, studyMode, activeSetId, currentIndex]);

  // Save session state periodically or on change
  useEffect(() => {
    if (isPrefsLoaded && currentUser) {
      const timer = setTimeout(() => {
        hybridService.savePreferences(
          theme,
          showDefaultVocab,
          showSatVocab,
          studyMode,
          activeSetId || undefined,
          currentIndex
        );
      }, 2000); // 2 second debounce
      return () => clearTimeout(timer);
    }
  }, [theme, showDefaultVocab, showSatVocab, studyMode, activeSetId, currentIndex, currentUser, isPrefsLoaded]);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Check current local/hybrid user
    async function initUser() {
      try {
        const user = await hybridService.getCurrentUser();
        if (user) {
          setCurrentUser(user.username);
          setStorageMode(user.mode);
        }
      } finally {
        setIsAuthChecking(false);
      }
    }
    initUser();

    // 2. Listen for Supabase auth changes (for OAuth flow)
    const unsubscribe = cloudService.onAuthStateChange(async (userId) => {
      if (userId) {
        hybridService.setCloudUserId(userId);
        const cloudUser = await cloudService.getCurrentUser();
        if (cloudUser) {
          setCurrentUser(cloudUser.username);
          setStorageMode('cloud');
          hybridService.setStorageMode('cloud');
        }
      } else {
        // Only clear if we were in cloud mode
        const currentMode = hybridService.getStorageMode();
        if (currentMode === 'cloud') {
          hybridService.setCloudUserId(null);
          setCurrentUser(null);
          setStorageMode('local');
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // --- PERSISTENCE: Loading ---
  useEffect(() => {
    async function loadUserData() {
      setIsDataLoaded(false);
      if (currentUser) {
        // Load user data via hybrid service
        const userData = await hybridService.getUserData();
        if (userData) {
          // Normalize all word names to uppercase for consistency
          const normalizedStatuses: WordStatusMap = {};
          if (userData.wordStatuses) {
            Object.entries(userData.wordStatuses).forEach(([name, status]) => {
              normalizedStatuses[name.toUpperCase()] = status;
            });
          }

          const normalizedMarked: MarkedWordsMap = {};
          if (userData.markedWords) {
            Object.entries(userData.markedWords).forEach(([name, marked]) => {
              normalizedMarked[name.toUpperCase()] = !!marked;
            });
          }

          setWordStatuses(normalizedStatuses);
          setMarkedWords(normalizedMarked);
          setSavedSets(userData.savedSets || []);
          setCustomVocab(userData.customVocab?.map(w => ({ ...w, name: w.name.toUpperCase() })) || []);
        }

        // Navigation stats
        setStudyMode((localStorage.getItem(`ssat_${currentUser}_mode`) as StudyMode) || 'all');
        setActiveSetId(localStorage.getItem(`ssat_${currentUser}_set_id`));
        const lastIdx = localStorage.getItem(`ssat_${currentUser}_index`);
        setCurrentIndex(lastIdx ? parseInt(lastIdx, 10) : 0);
      }
      setIsDataLoaded(true);
    }
    loadUserData();
  }, [currentUser]);

  // --- PERSISTENCE: Saving ---
  useEffect(() => {
    if (isDataLoaded && currentUser) {
      hybridService.saveUserData({ wordStatuses, markedWords, savedSets, customVocab });
    }
  }, [wordStatuses, markedWords, savedSets, customVocab, currentUser, isDataLoaded]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`ssat_${currentUser}_mode`, studyMode);
      if (activeSetId) localStorage.setItem(`ssat_${currentUser}_set_id`, activeSetId);
      else localStorage.removeItem(`ssat_${currentUser}_set_id`);
      localStorage.setItem(`ssat_${currentUser}_index`, currentIndex.toString());
    }
  }, [studyMode, activeSetId, currentIndex, currentUser]);

  // --- LOGIC: Mode Switching ---
  const studyList = useMemo(() => {
    let list: Word[] = [];

    // Special handling for Random (50) mode: always shuffle entire vocab and take 50
    if (studyMode === 'random') {
      const effectiveSeed = shuffleSeed === 0 ? Date.now() : shuffleSeed;
      const shuffled = seededShuffle(vocab, effectiveSeed);
      return shuffled.slice(0, 50);
    }

    // For other modes, we filter first, THEN shuffle if there is a seed
    switch (studyMode) {
      case 'all':
        list = vocab;
        break;
      case 'new_all':
        list = vocab.filter(w => w.version === 'new');
        break;
      case 'old_all':
        list = vocab.filter(w => w.version !== 'new'); // default to old if not specified
        break;
      case 'mastered':
        list = vocab.filter(w => wordStatuses[w.name] === 'mastered');
        break;
      case 'review':
        list = vocab.filter(w => wordStatuses[w.name] === 'review');
        break;
      case 'marked':
        list = vocab.filter(w => markedWords[w.name]);
        break;
      case 'new_basic':
        list = vocab.filter(w => w.version === 'new' && w.difficulty === 'basic');
        break;
      case 'new_easy':
        list = vocab.filter(w => w.version === 'new' && w.difficulty === 'easy');
        break;
      case 'new_medium':
        list = vocab.filter(w => w.version === 'new' && w.difficulty === 'medium');
        break;
      case 'new_hard':
        list = vocab.filter(w => w.version === 'new' && w.difficulty === 'hard');
        break;
      case 'old_basic':
        list = vocab.filter(w => w.version !== 'new' && w.difficulty === 'basic');
        break;
      case 'old_easy':
        list = vocab.filter(w => w.version !== 'new' && w.difficulty === 'easy');
        break;
      case 'old_medium':
        list = vocab.filter(w => w.version !== 'new' && w.difficulty === 'medium');
        break;
      case 'old_hard':
        list = vocab.filter(w => w.version !== 'new' && w.difficulty === 'hard');
        break;
      case 'basic':
        list = vocab.filter(w => w.difficulty === 'basic');
        break;
      case 'easy':
        list = vocab.filter(w => w.difficulty === 'easy');
        break;
      case 'medium':
        list = vocab.filter(w => w.difficulty === 'medium');
        break;
      case 'hard':
        list = vocab.filter(w => w.difficulty === 'hard');
        break;
      case 'custom':
        const targetSet = savedSets.find(s => s.id === activeSetId);
        if (targetSet) {
          const nameSet = new Set(targetSet.wordNames);
          list = vocab.filter(w => nameSet.has(w.name));
        } else {
          list = vocab;
        }
        break;
      default:
        list = vocab;
    }

    // Apply shuffle if active
    if (shuffleSeed !== 0) {
      return seededShuffle(list, shuffleSeed);
    }

    return list;
  }, [studyMode, activeSetId, vocab, wordStatuses, markedWords, savedSets, shuffleSeed]);

  useEffect(() => {
    // Only clip index if data and preferences are loaded.
    // This prevents the index from resetting to 0 during the brief moment on refresh
    // where some vocab (like SAT) might not have been loaded into the studyList yet.
    if (isDataLoaded && isPrefsLoaded && studyList.length > 0 && currentIndex >= studyList.length) {
      setCurrentIndex(0);
    }
  }, [studyList.length, currentIndex, isDataLoaded, isPrefsLoaded]);

  const updateStudyList = useCallback((mode: StudyMode, setId?: string) => {
    setStudyMode(mode);
    setActiveSetId(setId || null);
    setCurrentIndex(0);
    setShowDefinition(false);
    setShowWordSelector(false);
    setShowTestOptions(false);

    // If switching TO random mode, force a new shuffle immediately
    if (mode === 'random') {
      setShuffleSeed(Date.now());
    } else {
      // If switching to any other mode, reset shuffle
      setShuffleSeed(0);
    }
  }, []);

  const handleSaveNewSet = useCallback((name: string, wordNames: string[]) => {
    const newSet: StudySet = {
      id: Date.now().toString(),
      name: name || `Set ${savedSets.length + 1}`,
      wordNames
    };
    setSavedSets(prev => [...prev, newSet]);
    updateStudyList('custom', newSet.id);
  }, [savedSets.length, updateStudyList]);

  const handleRenameSet = useCallback((id: string, newName: string) => {
    setSavedSets(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  }, []);

  const handleDeleteSet = useCallback((id: string) => {
    setSavedSets(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (activeSetId === id) {
        setTimeout(() => updateStudyList('all'), 0);
      }
      return updated;
    });
  }, [activeSetId, updateStudyList]);

  const markWord = useCallback((status: WordStatusType) => {
    if (!studyList[currentIndex]) return;
    const name = studyList[currentIndex].name;
    setWordStatuses(prev => ({ ...prev, [name]: status }));
    if (currentIndex < studyList.length - 1) {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setShowDefinition(false);
      }, 150);
    }
  }, [studyList, currentIndex]);

  const onToggleMark = useCallback((wordName: string) => {
    setMarkedWords(prev => ({ ...prev, [wordName]: !prev[wordName] }));
  }, []);

  const handleShuffle = useCallback(() => {
    const newSeed = Date.now();
    setShuffleSeed(newSeed);
    setCurrentIndex(0);
    setShowDefinition(false);
  }, []);

  const handleJumpToWord = useCallback((input: string) => {
    const num = parseInt(input);
    if (!isNaN(num) && num > 0 && num <= studyList.length) {
      setCurrentIndex(num - 1);
      setShowDefinition(false);
      setShowJumpSearch(false);
      return;
    }
    const searchStr = input.toLowerCase().trim();
    const idx = studyList.findIndex(w => w.name.toLowerCase() === searchStr);
    const partialIdx = idx === -1 ? studyList.findIndex(w => w.name.toLowerCase().includes(searchStr)) : idx;
    if (partialIdx !== -1) {
      setCurrentIndex(partialIdx);
      setShowDefinition(false);
      setShowJumpSearch(false);
    } else {
      // Word not found - silent failure
    }

  }, [studyList]);

  const handleLogout = useCallback(async () => {
    await hybridService.logout();
    setCurrentUser(null);
    setStorageMode('local');
    setShowSettings(false);
  }, []);

  const handleUsernameChange = useCallback((newUsername: string) => {
    setCurrentUser(newUsername);
  }, []);

  const handleImportWords = useCallback((newWords: Word[]) => {
    const freshNames = newWords.map(w => w.name);
    setLastImportedNames(freshNames);

    setCustomVocab(prev => {
      // Create a map of existing custom words for quick lookup & update
      const customMap = new Map<string, Word>(prev.map(w => [w.name.toLowerCase(), w]));

      newWords.forEach(newWord => {
        const lowerName = newWord.name.toLowerCase();
        const existing = customMap.get(lowerName);

        // Use Object.assign to avoid spread on interface issues in some environments
        const mergedWord: Word = existing
          ? Object.assign({}, existing, newWord, { version: 'new' })
          : { ...newWord, version: 'new' } as Word;

        customMap.set(lowerName, mergedWord);
      });

      return Array.from(customMap.values());
    });

    setShowImport(false);
    setShowWordSelector(true);
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Don't trigger if modals or test are active
      if (showWordSelector || showTestOptions || showSettings) {
        return;
      }

      switch (e.code) {
        case 'ArrowRight':
          if (currentIndex < studyList.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setShowDefinition(false);
          }
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setShowDefinition(false);
          }
          break;
        case 'Space':
          e.preventDefault(); // Prevent page scroll
          if (studyList.length > 0 && !showJumpSearch) {
            setShowDefinition(prev => !prev);
          }
          break;
        case 'Enter':
          // Mark as Mastered (only when definition is showing)
          if (showDefinition && studyList[currentIndex]) {
            e.preventDefault();
            markWord('mastered');
          }
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          // Mark as Review (only when definition is showing)
          if (showDefinition && studyList[currentIndex]) {
            e.preventDefault();
            markWord('review');
          }
          break;
        case 'Backslash':
          // Mark as New (only when definition is showing)
          if (showDefinition && studyList[currentIndex]) {
            e.preventDefault();
            const name = studyList[currentIndex].name;
            setWordStatuses(prev => {
              const updated = { ...prev };
              delete updated[name];
              return updated;
            });
            if (currentIndex < studyList.length - 1) {
              setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setShowDefinition(false);
              }, 150);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, studyList, showWordSelector, showTestOptions, showSettings, showJumpSearch, showDefinition, markWord]);

  const currentStats = useMemo(() => {
    let mastered = 0;
    let review = 0;
    let marked = 0;
    vocab.forEach(w => {
      if (wordStatuses[w.name] === 'mastered') mastered++;
      else if (wordStatuses[w.name] === 'review') review++;
      if (markedWords[w.name]) marked++;
    });
    return {
      mastered,
      review,
      marked,
      notStudied: Math.max(0, vocab.length - mastered - review),
      total: vocab.length
    };
  }, [vocab, wordStatuses, markedWords]);

  const learnStudyList = useMemo(() => {
    const showLearn = location.pathname === '/learn';
    if (!showLearn) return [];
    return [...studyList].sort((a, b) => {
      const statusA = wordStatuses[a.name] === 'review' ? 0 : 1;
      const statusB = wordStatuses[b.name] === 'review' ? 0 : 1;
      return statusA - statusB;
    });
  }, [studyList, wordStatuses, location.pathname]);

  // Define ALL useCallback hooks BEFORE any conditional returns
  const updateWordStatus = useCallback((wordName: string, status: WordStatusType) => {
    setWordStatuses(prev => ({ ...prev, [wordName]: status }));
  }, []);

  const handleShowSettings = useCallback(() => setShowSettings(true), []);
  const handleMasteredClick = useCallback(() => currentStats.mastered > 0 && updateStudyList('mastered'), [currentStats.mastered, updateStudyList]);
  const handleReviewClick = useCallback(() => currentStats.review > 0 && updateStudyList('review'), [currentStats.review, updateStudyList]);
  const handleMarkedClick = useCallback(() => currentStats.marked > 0 && updateStudyList('marked'), [currentStats.marked, updateStudyList]);
  const handleOpenCustomSelector = useCallback(() => setShowWordSelector(true), []);
  const handleShowTestOptions = useCallback(() => setShowTestOptions(true), []);
  const handleSetCurrentIndex = useCallback((idx: number) => { setCurrentIndex(idx); setShowDefinition(false); }, []);
  const handleSetShowJumpSearch = useCallback((show: boolean) => setShowJumpSearch(show), []);
  const handleToggleDefinition = useCallback(() => setShowDefinition(d => !d), []);
  const handleSetShowWordSelector = useCallback((show: boolean) => setShowWordSelector(show), []);
  const handleSetShowTestOptions = useCallback((show: boolean) => setShowTestOptions(show), []);
  const handleSetTestType = useCallback((type: TestType) => setTestType(type), []);
  const handleSetShowSettings = useCallback((show: boolean) => setShowSettings(show), []);
  const handleSetShowImport = useCallback((show: boolean) => setShowImport(show), []);
  const navigateHome = useCallback(() => navigate('/'), [navigate]);


  // Spotify-Flow: Handle login success with intent preservation
  const handleLoginSuccess = useCallback((user: string) => {
    setCurrentUser(user);
    setStorageMode(hybridService.getStorageMode());

    // Check for pending upgrade intent
    const params = new URLSearchParams(location.search);
    if (params.get('intent') === 'upgrade') {
      navigate('/pricing', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate, location.search]);
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Authenticating...</p>
        </div>
      </div>
    );
  }

  const wrapSidebar = (element: React.ReactNode) => {
    return (
      <SidebarLayout
        currentUser={currentUser}
        theme={theme}
        onUpdateTheme={(newTheme) => handleUpdatePreferences(newTheme, showDefaultVocab, showSatVocab)}
        onLogout={handleLogout}
        onShowSettings={handleShowSettings}
      >
        {element}
      </SidebarLayout>
    );
  };

  return (
    <Elements stripe={stripePromise}>
      <Routes>
        {/* <Route path="/landing" element={
          currentUser ? <Navigate to="/" replace /> : <LandingPage />
        } /> */}
        <Route path="/signin" element={
          currentUser ? <Navigate to="/" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} initialMode="login" />
        } />
        <Route path="/signup" element={
          currentUser ? <Navigate to="/" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} initialMode="signup" />
        } />
        {/* <Route path="/pricing" element={<PricingPage />} />
        <Route path="/payment" element={<PaymentRouteWrapper />} /> */}
        <Route path="/" element={
          !currentUser ? (
            <Navigate to="/signin" replace />
          ) : wrapSidebar(
            <MainDashboard
              studyMode={studyMode}
              activeSetId={activeSetId}
              studyList={studyList}
              vocab={vocab}
              wordStatuses={wordStatuses}
              markedWords={markedWords}
              savedSets={savedSets}
              currentIndex={currentIndex}
              showDefinition={showDefinition}
              showJumpSearch={showJumpSearch}
              currentStats={currentStats}
              currentUser={currentUser}
              storageMode={storageMode}
              theme={theme}
              showDefaultVocab={showDefaultVocab}
              showSatVocab={showSatVocab}
              onUpdatePreferences={handleUpdatePreferences}
              onShowSettings={handleShowSettings}
              onMasteredClick={handleMasteredClick}
              onReviewClick={handleReviewClick}
              onMarkedClick={handleMarkedClick}
              onModeChange={updateStudyList}
              onOpenCustomSelector={handleOpenCustomSelector}
              onDeleteSet={handleDeleteSet}
              onRenameSet={handleRenameSet}
              onShuffle={handleShuffle}
              navigate={navigate}
              onShowTestOptions={handleShowTestOptions}
              onSetCurrentIndex={handleSetCurrentIndex}
              onSetShowJumpSearch={handleSetShowJumpSearch}
              onJumpToWord={handleJumpToWord}
              onToggleMark={onToggleMark}
              onToggleDefinition={handleToggleDefinition}
              onMarkWord={markWord}
              showWordSelector={showWordSelector}
              setShowWordSelector={handleSetShowWordSelector}
              showTestOptions={showTestOptions}
              setShowTestOptions={handleSetShowTestOptions}
              testType={testType}
              setTestType={handleSetTestType}
              showSettings={showSettings}
              setShowSettings={handleSetShowSettings}
              showImport={showImport}
              setShowImport={handleSetShowImport}
              onLogout={handleLogout}
              onUsernameChange={handleUsernameChange}
              onSaveNewSet={handleSaveNewSet}
              onImportWords={handleImportWords}
              lastImportedNames={lastImportedNames}
              existingVocab={vocab}
              showPayment={showPayment}
              setShowPayment={setShowPayment}
              LazyWordSelectorModal={LazyWordSelectorModal}
              SettingsModal={SettingsModal}
              ImportWordsModal={ImportWordsModal}
              PaymentModal={PaymentModal}
              isPro={isPro}
              onUpgrade={handleUpgrade}
            />
          )
        } />
        <Route path="/daily" element={
          !currentUser ? <Navigate to="/" replace /> : wrapSidebar(
            <DailyStudyCenter
              vocab={vocab}
              onStartExercise={(wordNames) => navigate('/daily-exercise')}
              onViewReview={(wordNames) => navigate('/daily-exercise')}
            />
          )
        } />
        <Route path="/daily-exercise" element={
          !currentUser ? <Navigate to="/" replace /> : wrapSidebar(
            <DailyExerciseRoute vocab={vocab} />
          )
        } />
        <Route path="/learn" element={
          !currentUser ? <Navigate to="/" replace /> : wrapSidebar(
            <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-muted-foreground uppercase tracking-widest">Loading component...</div>}>
              <LearnSession
                studyList={learnStudyList}
                onComplete={navigateHome}
                onUpdateWordStatus={updateWordStatus}
              />
            </Suspense>
          )
        } />
        <Route path="/mtest" element={
          !currentUser ? <Navigate to="/" replace /> : wrapSidebar(
            <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-muted-foreground uppercase tracking-widest">Loading component...</div>}>
              <TestInterface
                studyList={studyList}
                vocab={vocab}
                testType="multiple-choice"
                markedWords={markedWords}
                wordStatuses={wordStatuses}
                onToggleMark={onToggleMark}
                onUpdateWordStatus={updateWordStatus}
                onCancel={navigateHome}
              />
            </Suspense>
          )
        } />
        <Route path="/wtest" element={
          !currentUser ? <Navigate to="/" replace /> : wrapSidebar(
            <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-muted-foreground uppercase tracking-widest">Loading component...</div>}>
              <TestInterface
                studyList={studyList}
                vocab={vocab}
                testType="type-in"
                markedWords={markedWords}
                wordStatuses={wordStatuses}
                onToggleMark={onToggleMark}
                onUpdateWordStatus={updateWordStatus}
                onCancel={navigateHome}
              />
            </Suspense>
          )
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Elements>
  );
}