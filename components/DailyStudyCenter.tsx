import React, { useState, useEffect } from 'react';
import { Flame, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Bell, BellOff, Play, Check, Clock, Eye, AlertCircle } from 'lucide-react';
import { Word, DailyProgress } from '../types';
import { hybridService } from '../services/hybridService';
import { notificationService } from '../services/notificationService';

interface DailyStudyCenterProps {
    vocab: Word[];
    onStartExercise: (wordNames: string[]) => void;
    onViewReview: (wordNames: string[]) => void;
}

export default function DailyStudyCenter({ vocab, onStartExercise, onViewReview }: DailyStudyCenterProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [allProgress, setAllProgress] = useState<DailyProgress[]>([]);
    const [todayProgress, setTodayProgress] = useState<DailyProgress | null>(null);
    const [streak, setStreak] = useState(0);
    const [assignedWords, setAssignedWords] = useState<Word[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Notification states
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderTime, setReminderTime] = useState('09:00');
    const [eveningReminderEnabled, setEveningReminderEnabled] = useState(true);
    const [eveningReminderTime, setEveningReminderTime] = useState('20:00');
    const [repeatNudgeEnabled, setRepeatNudgeEnabled] = useState(true);
    const [testSent, setTestSent] = useState(false);
    const [notifSupported, setNotifSupported] = useState(false);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        loadData();
        checkNotificationStatus();
    }, [vocab]);

    const checkNotificationStatus = () => {
        const supported = notificationService.isSupported();
        setNotifSupported(supported);
        if (supported) {
            setNotifPermission(notificationService.getPermissionStatus());
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const progressList = await hybridService.getAllDailyProgress();
            setAllProgress(progressList);

            // Calculate streak
            const calculatedStreak = notificationService.calculateStreak(progressList);
            setStreak(calculatedStreak);

            // Fetch today's progress & user status map
            let todayRecord = await hybridService.getDailyProgress(todayStr);
            const userData = await hybridService.getUserData();

            const masteredSet = new Set<string>();
            const studiedSet = new Set<string>();
            if (userData?.wordStatuses) {
                Object.entries(userData.wordStatuses).forEach(([name, status]) => {
                    const upper = name.toUpperCase();
                    if (status === 'mastered') masteredSet.add(upper);
                    if (status) studiedSet.add(upper);
                });
            }

            // Helper to pick non-mastered words up to 30
            const getNonMasteredWords = (existingNames: string[] = []): string[] => {
                const existingUpper = new Set(existingNames.map(n => n.toUpperCase()));

                // 1. Unstudied non-mastered words
                const unstudied = vocab.filter(w =>
                    !masteredSet.has(w.name.toUpperCase()) &&
                    !studiedSet.has(w.name.toUpperCase()) &&
                    !existingUpper.has(w.name.toUpperCase())
                );
                let result = [...existingNames, ...unstudied.slice(0, Math.max(0, 30 - existingNames.length)).map(w => w.name)];

                // 2. Review non-mastered words
                if (result.length < 30) {
                    const currentUpper = new Set(result.map(n => n.toUpperCase()));
                    const reviewWords = vocab.filter(w =>
                        !masteredSet.has(w.name.toUpperCase()) &&
                        !currentUpper.has(w.name.toUpperCase())
                    );
                    result = [...result, ...reviewWords.slice(0, Math.max(0, 30 - result.length)).map(w => w.name)];
                }
                return result;
            };

            if (!todayRecord) {
                const wordNames = getNonMasteredWords();
                todayRecord = {
                    date: todayStr,
                    wordNames,
                    completed: false,
                    completedAt: null,
                    progress: {
                        completedBatches: 0,
                        wordStates: {}
                    }
                };
                await hybridService.saveDailyProgress(todayRecord);
            } else if (!todayRecord.completed) {
                // Purge any newly mastered words from active todayRecord.wordNames
                const unmasteredNames = todayRecord.wordNames.filter(name => !masteredSet.has(name.toUpperCase()));
                if (unmasteredNames.length !== todayRecord.wordNames.length) {
                    const refilledNames = getNonMasteredWords(unmasteredNames);
                    todayRecord = {
                        ...todayRecord,
                        wordNames: refilledNames
                    };
                    await hybridService.saveDailyProgress(todayRecord);
                }
            }

            setTodayProgress(todayRecord);

            // Resolve actual Word objects for the checklist
            const wordsList = todayRecord.wordNames
                .map(name => vocab.find(w => w.name.toUpperCase() === name.toUpperCase()))
                .filter(Boolean) as Word[];
            setAssignedWords(wordsList);

            // Load reminder preferences
            const prefs = await hybridService.getPreferences();
            if (prefs) {
                setReminderEnabled(!!prefs.reminderEnabled);
                setReminderTime((prefs as any).reminderTime || '09:00');
                setEveningReminderEnabled((prefs as any).eveningReminderEnabled ?? true);
                setEveningReminderTime((prefs as any).eveningReminderTime || '20:00');
                setRepeatNudgeEnabled((prefs as any).repeatNudgeEnabled ?? true);
            }
        } catch (e) {
            console.error("Failed to load daily study center data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleReminder = async () => {
        if (!reminderEnabled) {
            const granted = await notificationService.requestPermission();
            setNotifPermission(notificationService.getPermissionStatus());
            if (!granted) {
                alert("Permission denied. Please enable notifications in your browser settings.");
                return;
            }
        }

        const newEnabled = !reminderEnabled;
        setReminderEnabled(newEnabled);

        const currentPrefs = await hybridService.getPreferences();
        await hybridService.savePreferences(
            currentPrefs?.theme || 'light',
            currentPrefs?.showDefaultVocab ?? true,
            currentPrefs?.showSatVocab ?? false,
            currentPrefs?.lastStudyMode,
            currentPrefs?.lastActiveSetId,
            currentPrefs?.lastCardIndex,
            newEnabled,
            reminderTime
        );

        const username = localStorage.getItem('ssat_current_user') || sessionStorage.getItem('ssat_current_user');
        if (username) {
            const prefsKey = `ssat_prefs_${username.toLowerCase()}`;
            const existing = JSON.parse(localStorage.getItem(prefsKey) || '{}');
            localStorage.setItem(prefsKey, JSON.stringify({
                ...existing,
                reminderEnabled: newEnabled,
                reminderTime
            }));
        }
    };

    const handleToggleEveningReminder = async () => {
        const newEnabled = !eveningReminderEnabled;
        setEveningReminderEnabled(newEnabled);
        const currentPrefs = await hybridService.getPreferences();
        await hybridService.savePreferences(
            currentPrefs?.theme || 'light',
            currentPrefs?.showDefaultVocab ?? true,
            currentPrefs?.showSatVocab ?? false,
            currentPrefs?.lastStudyMode,
            currentPrefs?.lastActiveSetId,
            currentPrefs?.lastCardIndex,
            reminderEnabled,
            reminderTime,
            newEnabled,
            eveningReminderTime,
            repeatNudgeEnabled
        );
    };

    const handleToggleRepeatNudge = async () => {
        const newEnabled = !repeatNudgeEnabled;
        setRepeatNudgeEnabled(newEnabled);
        const currentPrefs = await hybridService.getPreferences();
        await hybridService.savePreferences(
            currentPrefs?.theme || 'light',
            currentPrefs?.showDefaultVocab ?? true,
            currentPrefs?.showSatVocab ?? false,
            currentPrefs?.lastStudyMode,
            currentPrefs?.lastActiveSetId,
            currentPrefs?.lastCardIndex,
            reminderEnabled,
            reminderTime,
            eveningReminderEnabled,
            eveningReminderTime,
            newEnabled
        );
    };

    const handleTestNotification = async () => {
        const success = await notificationService.sendTestNotification(streak);
        setNotifPermission(notificationService.getPermissionStatus());
        if (success) {
            setTestSent(true);
            setTimeout(() => setTestSent(false), 3000);
        } else {
            alert("Could not send test notification. Please ensure browser notification permissions are allowed in your browser settings.");
        }
    };

    const handleChangeReminderTime = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value;
        setReminderTime(time);

        const currentPrefs = await hybridService.getPreferences();
        await hybridService.savePreferences(
            currentPrefs?.theme || 'light',
            currentPrefs?.showDefaultVocab ?? true,
            currentPrefs?.showSatVocab ?? false,
            currentPrefs?.lastStudyMode,
            currentPrefs?.lastActiveSetId,
            currentPrefs?.lastCardIndex,
            reminderEnabled,
            time
        );

        const username = localStorage.getItem('ssat_current_user') || sessionStorage.getItem('ssat_current_user');
        if (username) {
            const prefsKey = `ssat_prefs_${username.toLowerCase()}`;
            const existing = JSON.parse(localStorage.getItem(prefsKey) || '{}');
            localStorage.setItem(prefsKey, JSON.stringify({
                ...existing,
                reminderTime: time
            }));
        }
    };

    // Calendar logic
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        return { firstDay, totalDays };
    };

    const { firstDay, totalDays } = getDaysInMonth(currentDate);

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const getDayProgress = (dayNum: number) => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(dayNum).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return allProgress.find(p => p.date === dateStr);
    };

    const isToday = (dayNum: number) => {
        const today = new Date();
        return currentDate.getFullYear() === today.getFullYear() &&
               currentDate.getMonth() === today.getMonth() &&
               dayNum === today.getDate();
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="mt-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading daily workout info...</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-4">
            {/* Left Column: Streak, Action & Checklist */}
            <div className="lg:col-span-2 space-y-6">
                {/* Streak Banner */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-xs relative overflow-hidden flex items-center justify-between">
                    <div className="relative z-10 space-y-2">
                        <div className="text-[10px] font-mono uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full inline-block">
                            DAILY MEMORIZATION STREAK
                        </div>
                        <h2 className="text-3xl font-bold">{streak} Day{streak !== 1 ? 's' : ''} Active!</h2>
                        <p className="text-sm text-orange-50 font-medium">
                            {streak > 0 
                                ? "Excellent! Keep learning 30 words every day to supercharge recall." 
                                : "Start today's vocabulary exercise to kick off a new streak!"}
                        </p>
                    </div>
                    <div className="relative z-10 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                        <Flame className={`w-16 h-16 ${streak > 0 ? 'text-amber-300 animate-pulse animate-float' : 'text-white/60'}`} fill={streak > 0 ? "currentColor" : "none"} />
                    </div>
                </div>

                {/* Workout Card */}
                <div className="bg-card rounded-2xl p-6 border border-border shadow-xs space-y-6">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                        <div>
                            <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">Today's Vocab Workout</h3>
                            <p className="text-xs text-muted-foreground">30 essential target vocabulary words</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {todayProgress?.completed ? (
                                <span className="bg-emerald-500/10 text-emerald-600 text-xs font-semibold uppercase px-3 py-1.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                                    <Check className="w-3.5 h-3.5" /> Completed
                                </span>
                            ) : (
                                <span className="bg-amber-500/10 text-amber-600 text-xs font-semibold uppercase px-3 py-1.5 rounded-full flex items-center gap-1 border border-amber-500/20">
                                    <Clock className="w-3.5 h-3.5" /> Pending
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-muted/50 rounded-xl p-4 space-y-2 border border-border">
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                PROGRESS SUMMARY
                            </div>
                            {(() => {
                                const totalCount = todayProgress?.wordNames.length || 30;
                                const completedCount = todayProgress?.completed
                                    ? totalCount
                                    : Object.values(todayProgress?.progress?.wordStates || {}).filter((s: any) => s.correct).length;
                                const remainingCount = Math.max(0, totalCount - completedCount);
                                const pct = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;
                                const isPaused = !todayProgress?.completed && (completedCount > 0 || (todayProgress?.progress?.completedBatches || 0) > 0);

                                return (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-end gap-2">
                                                <span className="text-3xl font-bold text-foreground">
                                                    {completedCount}/{totalCount}
                                                </span>
                                                <span className="text-xs text-muted-foreground font-medium mb-1">words completed</span>
                                            </div>
                                            {!todayProgress?.completed && (
                                                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                                    {remainingCount} word{remainingCount !== 1 ? 's' : ''} left
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-primary h-full transition-all duration-500" 
                                                style={{ width: `${todayProgress?.completed ? 100 : pct}%` }}
                                            />
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="flex flex-col justify-center">
                            {todayProgress?.completed ? (
                                <button
                                    onClick={() => onViewReview(todayProgress.wordNames)}
                                    className="w-full bg-primary/10 hover:bg-primary/20 text-primary font-semibold py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] uppercase tracking-wider text-xs flex items-center justify-center gap-2 border border-primary/20"
                                >
                                    <Eye className="w-4 h-4" /> Review Today's Words
                                </button>
                            ) : (
                                <button
                                    onClick={() => onStartExercise(todayProgress?.wordNames || [])}
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3.5 px-6 rounded-xl shadow-xs transition-all active:scale-[0.98] uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                                >
                                    <Play className="w-4 h-4" /> 
                                    {(() => {
                                        const totalCount = todayProgress?.wordNames.length || 30;
                                        const completedCount = Object.values(todayProgress?.progress?.wordStates || {}).filter((s: any) => s.correct).length;
                                        const remainingCount = Math.max(0, totalCount - completedCount);
                                        const hasProgress = completedCount > 0 || (todayProgress?.progress?.completedBatches || 0) > 0;
                                        return hasProgress 
                                            ? `Resume Workout Session (${remainingCount} word${remainingCount !== 1 ? 's' : ''} left)` 
                                            : "Start 30 Word Challenge";
                                    })()}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Word list checklist */}
                    <div className="space-y-3">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                            TODAY'S WORDS CHECKLIST
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            {assignedWords.map((word) => {
                                const isCompleted = todayProgress?.completed || !!todayProgress?.progress.wordStates[word.name]?.correct;
                                return (
                                    <div 
                                        key={word.name} 
                                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                                            isCompleted 
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' 
                                                : 'bg-card border-border text-foreground'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                                            isCompleted 
                                                ? 'bg-emerald-500 border-emerald-600 text-white' 
                                                : 'border-border bg-muted'
                                        }`}>
                                            {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <div className="font-semibold text-xs truncate" title={word.name}>
                                            {word.name}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Calendar & Notifications */}
            <div className="space-y-6">
                {/* Interactive Calendar Card */}
                <div className="bg-card rounded-2xl p-6 border border-border shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-primary" /> Completion Calendar
                        </h3>
                        <div className="flex items-center gap-1">
                            <button onClick={prevMonth} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-semibold text-foreground">
                                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </span>
                            <button onClick={nextMonth} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                            <span key={idx} className="text-[10px] font-mono text-muted-foreground py-1">
                                {day}
                            </span>
                        ))}

                        {/* Blank slots */}
                        {Array.from({ length: firstDay }).map((_, idx) => (
                            <div key={`empty-${idx}`} />
                        ))}

                        {/* Days */}
                        {Array.from({ length: totalDays }).map((_, idx) => {
                            const dayNum = idx + 1;
                            const prog = getDayProgress(dayNum);
                            const activeToday = isToday(dayNum);

                            let cellClass = 'bg-muted/40 text-muted-foreground';
                            if (prog?.completed) {
                                cellClass = 'bg-emerald-500 text-white font-bold shadow-xs';
                            } else if (activeToday) {
                                cellClass = 'bg-amber-500/20 text-amber-600 border border-amber-500/40 font-bold animate-pulse';
                            } else if (prog && !prog.completed) {
                                cellClass = 'bg-primary/10 text-primary border border-primary/20';
                            }

                            return (
                                <button
                                    key={`day-${dayNum}`}
                                    disabled={!prog}
                                    onClick={() => prog && onViewReview(prog.wordNames)}
                                    className={`aspect-square flex items-center justify-center text-xs rounded-xl transition-all relative ${cellClass} ${
                                        prog ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'
                                    }`}
                                    title={prog ? `Studied ${prog.wordNames.length} words` : undefined}
                                >
                                    <span>{dayNum}</span>
                                    {prog?.completed && (
                                        <span className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-white rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Notifications Config Card */}
                <div className="bg-card rounded-2xl p-6 border border-border shadow-xs space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${reminderEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {reminderEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                                Daily Study Reminders
                            </h3>
                            <p className="text-[10px] text-muted-foreground">Never miss a streak workout</p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">
                                Notification Alert Status
                            </span>
                            <button
                                onClick={handleToggleReminder}
                                aria-label="Toggle daily study reminder"
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    reminderEnabled ? 'bg-primary' : 'bg-muted'
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        reminderEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>

                        {reminderEnabled && (
                            <div className="space-y-3.5 border-t border-border pt-3.5 animate-in slide-in-from-top-2 duration-200">
                                {/* Preferred Morning Time */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-foreground">
                                        Morning Reminder Time
                                    </span>
                                    <input
                                        type="time"
                                        value={reminderTime}
                                        onChange={handleChangeReminderTime}
                                        className="bg-background border border-input px-3 py-1 rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-ring cursor-pointer"
                                    />
                                </div>

                                {/* Evening Streak Protection Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-medium text-foreground">Evening Streak Saver</div>
                                        <div className="text-[10px] text-muted-foreground">Alert at 8:00 PM if workout is uncompleted</div>
                                    </div>
                                    <button
                                        onClick={handleToggleEveningReminder}
                                        aria-label="Toggle evening streak saver"
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            eveningReminderEnabled ? 'bg-amber-500' : 'bg-muted'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                eveningReminderEnabled ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* 5-Minute Escalation Nudge Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-medium text-foreground">5-Min Repeat Nudges</div>
                                        <div className="text-[10px] text-muted-foreground">Repeat reminder every 5m if no words learned</div>
                                    </div>
                                    <button
                                        onClick={handleToggleRepeatNudge}
                                        aria-label="Toggle 5-minute repeat nudges"
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            repeatNudgeEnabled ? 'bg-primary' : 'bg-muted'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                repeatNudgeEnabled ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Test Notification Button */}
                                <button
                                    onClick={handleTestNotification}
                                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                        testSent
                                            ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                                            : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20'
                                    }`}
                                >
                                    <Bell className="w-3.5 h-3.5" />
                                    {testSent ? '✓ Test Notification Sent!' : 'Test Notification Now'}
                                </button>

                                {/* System note */}
                                <div className="bg-muted/60 p-3 rounded-xl border border-border flex items-start gap-2 text-[10px] text-muted-foreground font-mono">
                                    <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <span>
                                        iPhone/iOS Note: To get native pop-up notifications, tap <strong>Share (↑)</strong> in Safari and select <strong>Add to Home Screen</strong>.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
