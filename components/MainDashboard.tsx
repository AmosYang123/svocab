import React, { memo, Suspense } from 'react';
import { Word, WordStatusType, StudyMode, MarkedWordsMap, WordStatusMap, StudySet, TestType, ThemeMode } from '../types';
import StatsDashboard from './StatsDashboard';
import ModeSelector from './ModeSelector';
import ProgressBar from './ProgressBar';
import Flashcard from './Flashcard';
import { AIWordSearch } from './AIWordSearch';
import { Icons } from './Icons';

interface MainDashboardProps {
    studyMode: StudyMode;
    activeSetId: string | null;
    studyList: Word[];
    vocab: Word[];
    wordStatuses: WordStatusMap;
    markedWords: MarkedWordsMap;
    savedSets: StudySet[];
    currentIndex: number;
    showDefinition: boolean;
    showJumpSearch: boolean;
    currentStats: {
        mastered: number;
        review: number;
        marked: number;
        notStudied: number;
        total: number;
    };
    currentUser: string | null;
    storageMode: string;
    onShowSettings: () => void;
    onMasteredClick: () => void;
    onReviewClick: () => void;
    onMarkedClick: () => void;
    onModeChange: (mode: StudyMode, setId?: string) => void;
    onOpenCustomSelector: () => void;
    onDeleteSet: (id: string) => void;
    onRenameSet: (id: string, newName: string) => void;
    onShuffle: () => void;
    navigate: (path: string) => void;
    onShowTestOptions: () => void;
    onSetCurrentIndex: (idx: number) => void;
    onSetShowJumpSearch: (show: boolean) => void;
    onJumpToWord: (input: string) => void;
    onToggleMark: (wordName: string) => void;
    onToggleDefinition: () => void;
    onMarkWord: (status: WordStatusType) => void;
    showWordSelector: boolean;
    setShowWordSelector: (show: boolean) => void;
    showTestOptions: boolean;
    setShowTestOptions: (show: boolean) => void;
    testType: TestType;
    setTestType: (type: TestType) => void;
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
    showImport: boolean;
    setShowImport: (show: boolean) => void;
    onLogout: () => void;
    onUsernameChange: (name: string) => void;
    onSaveNewSet: (name: string, wordNames: string[]) => void;
    onImportWords: (newWords: Word[]) => void;
    lastImportedNames: string[];
    existingVocab: Word[];
    theme: ThemeMode;
    showDefaultVocab: boolean;
    showSatVocab: boolean;
    onUpdatePreferences: (theme: ThemeMode, showDefault: boolean, showSat?: boolean) => void;
    onUpdateTheme: (theme: ThemeMode) => void; // Keeping for backward compatibility or simple theme toggle if needed, but switching to onUpdatePreferences
    LazyWordSelectorModal: React.ComponentType<any>;
    SettingsModal: React.ComponentType<any>;
    ImportWordsModal: React.LazyExoticComponent<any>;
    PaymentModal: React.LazyExoticComponent<any>;
    showPayment: boolean;
    setShowPayment: (show: boolean) => void;
    isPro: boolean;
    onUpgrade: () => void;
}

const MainDashboard: React.FC<MainDashboardProps> = memo(({
    studyMode,
    activeSetId,
    studyList,
    vocab,
    wordStatuses,
    markedWords,
    savedSets,
    currentIndex,
    showDefinition,
    showJumpSearch,
    currentStats,
    currentUser,
    storageMode,
    onShowSettings,
    onMasteredClick,
    onReviewClick,
    onMarkedClick,
    onModeChange,
    onOpenCustomSelector,
    onDeleteSet,
    onRenameSet,
    onShuffle,
    navigate,
    onShowTestOptions,
    onSetCurrentIndex,
    onSetShowJumpSearch,
    onJumpToWord,
    onToggleMark,
    onToggleDefinition,
    onMarkWord,
    showWordSelector,
    setShowWordSelector,
    showTestOptions,
    setShowTestOptions,
    testType,
    setTestType,
    showSettings,
    setShowSettings,
    showImport,
    setShowImport,
    onLogout,
    onUsernameChange,
    onSaveNewSet,
    onImportWords,
    lastImportedNames,
    existingVocab,
    theme,
    showDefaultVocab,
    showSatVocab,
    onUpdatePreferences,
    onUpdateTheme,
    LazyWordSelectorModal,
    SettingsModal,
    ImportWordsModal,
    PaymentModal,
    showPayment,
    setShowPayment,
    isPro,
    onUpgrade
}) => {
    return (
        <div className="max-w-6xl mx-auto w-full flex flex-col font-sans">
            {/* Top Breadcrumb & Deck Toggle Bar (Matches Reference Image Header Bar) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/60">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Icons.AcademicCap className="w-5 h-5 text-primary" />
                        Vocabulary Overview
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {activeSetId
                            ? <span>Active Group: <span className="text-foreground font-semibold">"{savedSets.find(s => s.id === activeSetId)?.name}"</span></span>
                            : <span>Active Deck: <span className="text-foreground font-semibold">{showSatVocab && showDefaultVocab ? 'All Combined' : showSatVocab ? 'SAT (3,000)' : 'SSAT (1,000)'}</span> • {studyList.length.toLocaleString()} words</span>
                        }
                    </p>
                </div>

            </div>

            {/* 4-Card Metric Grid (Matches Reference Image) */}
            <StatsDashboard
                stats={currentStats}
                onMasteredClick={onMasteredClick}
                onReviewClick={onReviewClick}
                onMarkedClick={onMarkedClick}
            />

            <div className="mb-4">
                <ModeSelector
                    currentMode={studyMode}
                    activeSetId={activeSetId}
                    vocab={vocab}
                    wordStatuses={wordStatuses}
                    markedWords={markedWords}
                    savedSets={savedSets}
                    onModeChange={onModeChange}
                    onOpenCustomSelector={onOpenCustomSelector}
                    onDeleteSet={onDeleteSet}
                    onRenameSet={onRenameSet}
                />
            </div>

            {/* Main Action Bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 my-4">
                <button onClick={onShuffle} className="flex items-center gap-2 bg-secondary text-secondary-foreground border border-border/80 px-5 py-2.5 font-medium hover:bg-muted transition-all text-xs rounded-xl shadow-xs active:scale-[0.98]">
                    <Icons.Shuffle className="w-4 h-4 text-muted-foreground" /> Shuffle Order
                </button>
                <button
                    onClick={() => { if (studyList.length > 0) navigate('/learn'); }}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 font-semibold hover:opacity-90 transition-all text-xs rounded-xl shadow-sm active:scale-[0.98]"
                >
                    <Icons.AcademicCap className="w-4 h-4" /> Learn Mode
                </button>
                <button
                    onClick={() => { if (studyList.length > 0) onShowTestOptions(); }}
                    className="flex items-center gap-2 bg-foreground text-background px-6 py-2.5 font-semibold hover:opacity-90 transition-all text-xs rounded-xl shadow-sm active:scale-[0.98]"
                >
                    <Icons.ClipboardCheck className="w-4 h-4" /> Test Me
                </button>
            </div>

            {studyList.length > 0 ? (
                <div className="flex flex-col items-center flex-1">
                    <ProgressBar
                        current={currentIndex + 1}
                        total={studyList.length}
                        onJump={(val) => onSetCurrentIndex(val - 1)}
                    />

                    <div className="relative w-full mb-4 mt-2 flex justify-center">
                        {!showJumpSearch ? (
                            <button
                                onClick={() => onSetShowJumpSearch(true)}
                                className="text-primary font-semibold text-[10px] flex items-center gap-2 hover:text-primary/80 transition-colors uppercase tracking-[0.4em] bg-card px-8 py-1.5 rounded-full shadow-xs border border-border"
                            >
                                <Icons.Search /> QUICK JUMP
                            </button>
                        ) : (
                            <AIWordSearch
                                availableWords={studyList}
                                onSelectWord={(name) => { onJumpToWord(name); onSetShowJumpSearch(false); }}
                                onClose={() => onSetShowJumpSearch(false)}
                            />
                        )}
                    </div>

                    <div className="relative w-full max-w-3xl">
                        <button
                            onClick={() => onToggleMark(studyList[currentIndex].name)}
                            className={`absolute top-4 left-6 z-20 p-2 rounded-md transition-all ${markedWords[studyList[currentIndex].name] ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500 hover:bg-orange-100 dark:hover:bg-slate-600'}`}
                        >
                            <Icons.Flag />
                        </button>
                        <Flashcard
                            word={studyList[currentIndex]}
                            showDefinition={showDefinition}
                            onToggle={onToggleDefinition}
                            status={wordStatuses[studyList[currentIndex]?.name] || null}
                        />
                    </div>

                    <div className="flex flex-col items-center w-full max-w-lg gap-3 mt-4 pb-6">
                        <div className="flex items-center justify-between w-full gap-3">
                            <button
                                disabled={currentIndex === 0}
                                onClick={() => { onSetCurrentIndex(currentIndex - 1); }}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-10 bg-card border border-border rounded-lg font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-all active:scale-[0.98] text-xs shadow-xs uppercase tracking-[0.2em]"
                            >
                                <Icons.ChevronLeft /> Prev
                            </button>
                            <button
                                disabled={currentIndex === studyList.length - 1}
                                onClick={() => { onSetCurrentIndex(currentIndex + 1); }}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-10 bg-card border border-border rounded-lg font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-all active:scale-[0.98] text-xs shadow-xs uppercase tracking-[0.2em]"
                            >
                                Next <Icons.ChevronRight />
                            </button>
                        </div>

                        {showDefinition && (
                            <div className="flex flex-row items-center justify-between w-full gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <button
                                    onClick={() => onMarkWord('mastered')}
                                    className={`w-full flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-10 rounded-lg font-black transition-all ${wordStatuses[studyList[currentIndex].name] === 'mastered' ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-green-600 text-white hover:bg-green-700 active:scale-95 shadow-md'}`}
                                >
                                    <Icons.Trophy />
                                    <span className="text-[10px] tracking-[0.2em] uppercase">MASTERED</span>
                                </button>
                                <button
                                    onClick={() => onMarkWord('review')}
                                    className={`w-full flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-10 rounded-lg font-black transition-all ${wordStatuses[studyList[currentIndex].name] === 'review' ? 'bg-orange-100 text-orange-700 border-2 border-orange-200' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95 shadow-md'}`}
                                >
                                    <Icons.Brain />
                                    <span className="text-[10px] tracking-[0.2em] uppercase">REVIEW</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-card py-12 px-12 rounded-xl shadow-xs border border-border text-center">
                    <p className="text-muted-foreground text-2xl font-bold mb-8 uppercase tracking-widest italic opacity-50">List is Empty</p>
                    <button onClick={() => onModeChange('all')} className="bg-primary text-primary-foreground px-16 py-3 rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs active:scale-[0.98] uppercase tracking-[0.3em]">Reset Study Mode</button>
                </div>
            )}

            <footer className="mt-auto py-4 border-t border-border flex justify-between items-center px-2">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                        <div className={`w-1.5 h-1.5 rounded-full ${storageMode === 'cloud' || storageMode === 'hybrid'
                            ? 'bg-blue-500 shadow-blue-200 shadow-sm'
                            : 'bg-emerald-500'
                            }`}></div>
                        {storageMode === 'cloud' || storageMode === 'hybrid' ? 'Cloud Sync Active' : 'All progress saved locally'}
                    </div>
                    <span className="text-[10px] font-mono text-primary uppercase tracking-widest opacity-60 italic">
                        {currentUser}
                    </span>
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors"
                >
                    Settings
                </button>
            </footer>

            {showWordSelector && (
                <Suspense fallback={null}>
                    <LazyWordSelectorModal
                        vocab={vocab}
                        wordStatuses={wordStatuses}
                        markedWords={markedWords}
                        setCount={savedSets.length}
                        lastImportedNames={lastImportedNames}
                        onClose={() => setShowWordSelector(false)}
                        onSave={onSaveNewSet}
                    />
                </Suspense>
            )}

            {showTestOptions && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 p-6 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card rounded-xl p-8 w-full max-w-md shadow-sm text-center border-t-4 border-primary border-x border-b border-border">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-8 uppercase italic">Prepare for Testing</h2>
                        <div className="space-y-4">
                            <button onClick={() => { setTestType('multiple-choice'); navigate('/mtest'); setShowTestOptions(false); }} className="w-full text-left py-3 px-6 border border-border rounded-xl hover:border-primary hover:bg-muted transition-all group active:scale-[0.98] shadow-xs">
                                <div className="text-sm font-semibold text-primary uppercase tracking-widest">Active Recognition</div>
                                <div className="text-[10px] text-muted-foreground font-mono uppercase">Pick the correct definition</div>
                            </button>
                            <button onClick={() => { setTestType('type-in'); navigate('/wtest'); setShowTestOptions(false); }} className="w-full text-left py-3 px-6 border border-border rounded-xl hover:border-primary hover:bg-muted transition-all group active:scale-[0.98] shadow-xs">
                                <div className="text-sm font-semibold text-primary uppercase tracking-widest">Deep Recall</div>
                                <div className="text-[10px] text-muted-foreground font-mono uppercase">Type out the meaning</div>
                            </button>
                            <button onClick={() => setShowTestOptions(false)} className="mt-6 text-muted-foreground font-semibold hover:text-foreground uppercase tracking-[0.3em] text-xs bg-muted px-12 py-2 rounded-xl border border-border shadow-xs">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showSettings && (
                <Suspense fallback={null}>
                    <SettingsModal
                        currentUser={currentUser}
                        theme={theme}
                        showDefaultVocab={showDefaultVocab}
                        showSatVocab={showSatVocab}
                        onUpdatePreferences={onUpdatePreferences}
                        onUsernameChange={onUsernameChange}
                        onLogout={onLogout}
                        onClose={() => setShowSettings(false)}
                        onShowImport={() => setShowImport(true)}
                        onShowPayment={() => { setShowSettings(false); setShowPayment(true); }}
                        isPro={isPro}
                    />
                </Suspense>
            )}

            {/* {showPayment && (
                <Suspense fallback={null}>
                    <PaymentModal
                        onClose={() => setShowPayment(false)}
                        onUpgrade={() => {
                            onUpgrade();
                            setShowPayment(false);
                        }}
                        isPro={isPro}
                    />
                </Suspense>
            )} */}


            {showImport && (
                <Suspense fallback={null}>
                    <ImportWordsModal
                        onClose={() => setShowImport(false)}
                        onImport={onImportWords}
                        existingVocab={existingVocab}
                    />
                </Suspense>
            )}
        </div>
    );
});

export default MainDashboard;
