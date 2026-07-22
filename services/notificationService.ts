/**
 * Browser Notification Service
 * 
 * Manages system notification permissions, local triggers,
 * multi-tier streak saver scheduling, and 5-minute escalation nudges.
 */

import { hybridService } from './hybridService';

export interface ReminderOptions {
    streakCount?: number;
    wordsRemaining?: number;
    isEscalation?: boolean;
    isEvening?: boolean;
    isTest?: boolean;
}

export const notificationService = {
    // ----------------
    // Configuration
    // ----------------
    isSupported(): boolean {
        if (typeof window === 'undefined') return false;
        return 'Notification' in window || 'serviceWorker' in navigator || 'PushManager' in window;
    },

    getPermissionStatus(): NotificationPermission {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            return Notification.permission;
        }
        return 'default';
    },

    async requestPermission(): Promise<boolean> {
        if (!this.isSupported()) return false;

        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') return true;
            try {
                const permission = await Notification.requestPermission();
                return permission === 'granted';
            } catch (e) {
                return new Promise((resolve) => {
                    Notification.requestPermission((permission) => {
                        resolve(permission === 'granted');
                    });
                });
            }
        }
        return true;
    },

    // ----------------
    // Core Actions
    // ----------------
    async sendTestNotification(streakCount: number = 1): Promise<boolean> {
        const granted = await this.requestPermission();
        if (!granted) return false;

        const title = "SSAT Vocab Mastery (Test) 📚";
        const options: NotificationOptions = {
            body: `Notifications are active! Your ${streakCount}-day streak protection is enabled.`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'test-notification',
            requireInteraction: true,
        };

        try {
            const notif = new Notification(title, options);
            notif.onclick = () => {
                window.focus();
                if (window.location.pathname !== '/daily') {
                    window.location.href = '/daily';
                }
            };
            return true;
        } catch (e) {
            console.error('[notificationService] Error sending test notification:', e);
            return false;
        }
    },

    async triggerReminder(opts: ReminderOptions = {}): Promise<boolean> {
        if (!this.isSupported() || Notification.permission !== 'granted') {
            return false;
        }

        const streak = opts.streakCount || 0;
        const remaining = opts.wordsRemaining !== undefined ? opts.wordsRemaining : 30;

        let title = "SSAT Vocab Workout 📚";
        let body = "";

        if (opts.isTest) {
            title = "SSAT Vocab Mastery (Test) 📚";
            body = `Notifications are active! Your ${streak}-day streak protection is enabled.`;
        } else if (opts.isEvening) {
            title = "🔥 Evening Streak Protection!";
            body = streak > 0
                ? `Don't break your ${streak}-day streak! Complete today's words before midnight.`
                : "Finish today's 30 words before midnight to kick off a new streak!";
        } else if (opts.isEscalation) {
            title = "⏰ 5-Minute Nudge: Vocab Reminder";
            body = remaining < 30
                ? `Still ${remaining} words left in today's workout! Take 2 minutes to finish a batch now.`
                : "You haven't started today's workout yet! Take 3 minutes to complete 5 words now.";
        } else {
            body = remaining < 30
                ? `⚡ You're almost done! Only ${remaining} words left in today's workout.`
                : streak > 0
                    ? `Keep your ${streak}-day streak alive! Learn today's target words now.`
                    : "Ready for today's workout? Secure 30 new words in 15 minutes.";
        }

        const options: NotificationOptions = {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: opts.isEscalation ? 'escalation-nudge' : opts.isEvening ? 'evening-saver' : 'daily-reminder',
            requireInteraction: true,
        };

        try {
            const notif = new Notification(title, options);
            notif.onclick = () => {
                window.focus();
                if (window.location.pathname !== '/daily-exercise') {
                    window.location.href = '/daily-exercise';
                }
            };
            return true;
        } catch (e) {
            console.error('[notificationService] Trigger notification error:', e);
            return false;
        }
    },

    // ----------------
    // Background Check & Escalation Scheduler
    // ----------------
    setupDailyScheduler() {
        if (!this.isSupported()) return;

        // Check every 30 seconds
        const intervalId = setInterval(async () => {
            try {
                const user = await hybridService.getCurrentUser();
                if (!user) return;

                const prefs = await hybridService.getPreferences();
                if (!prefs || !prefs.reminderEnabled) return;

                const todayStr = new Date().toISOString().split('T')[0];
                const daily = await hybridService.getDailyProgress(todayStr);

                // If today's workout is fully completed, clear escalation state and return
                if (daily && daily.completed) {
                    localStorage.removeItem('ssat_escalation_count');
                    localStorage.removeItem('ssat_last_notified_completed_count');
                    return;
                }

                // Compute current completed count & remaining count
                const wordStates = daily?.progress?.wordStates || {};
                const currentCompletedCount = Object.values(wordStates).filter((s: any) => s.correct).length;
                const totalAssigned = daily?.wordNames?.length || 30;
                const wordsRemaining = Math.max(0, totalAssigned - currentCompletedCount);

                // Retrieve saved escalation state
                const savedCompletedCount = parseInt(localStorage.getItem('ssat_last_notified_completed_count') || '-1', 10);
                const lastNotifTime = parseInt(localStorage.getItem('ssat_last_notification_time') || '0', 10);
                let escalationCount = parseInt(localStorage.getItem('ssat_escalation_count') || '0', 10);

                // Reset escalation if user has learned new words since last notification
                if (currentCompletedCount > savedCompletedCount) {
                    localStorage.setItem('ssat_last_notified_completed_count', currentCompletedCount.toString());
                    localStorage.setItem('ssat_escalation_count', '0');
                    escalationCount = 0;
                }

                const allProgress = await hybridService.getAllDailyProgress();
                const streak = this.calculateStreak(allProgress);

                const now = new Date();
                const currentHour = now.getHours();
                const currentMin = now.getMinutes();

                // 1. Primary Morning Reminder Check
                const [remHour, remMin] = (prefs as any).reminderTime?.split(':').map(Number) || [9, 0];
                const lastNotifiedDate = localStorage.getItem('ssat_last_notified_date');

                if (lastNotifiedDate !== todayStr && (currentHour > remHour || (currentHour === remHour && currentMin >= remMin))) {
                    const success = await this.triggerReminder({ streakCount: streak, wordsRemaining });
                    if (success) {
                        localStorage.setItem('ssat_last_notified_date', todayStr);
                        localStorage.setItem('ssat_last_notification_time', Date.now().toString());
                        localStorage.setItem('ssat_last_notified_completed_count', currentCompletedCount.toString());
                        localStorage.setItem('ssat_escalation_count', '0');
                    }
                }

                // 2. Evening Streak Protection Check (8:00 PM by default)
                if (prefs.eveningReminderEnabled ?? true) {
                    const [eveHour, eveMin] = (prefs as any).eveningReminderTime?.split(':').map(Number) || [20, 0];
                    const lastNotifiedEvening = localStorage.getItem('ssat_last_notified_evening_date');

                    if (lastNotifiedEvening !== todayStr && (currentHour > eveHour || (currentHour === eveHour && currentMin >= eveMin))) {
                        const success = await this.triggerReminder({ streakCount: streak, wordsRemaining, isEvening: true });
                        if (success) {
                            localStorage.setItem('ssat_last_notified_evening_date', todayStr);
                            localStorage.setItem('ssat_last_notification_time', Date.now().toString());
                            localStorage.setItem('ssat_last_notified_completed_count', currentCompletedCount.toString());
                            localStorage.setItem('ssat_escalation_count', '0');
                        }
                    }
                }

                // 3. 5-Minute Escalation Nudge Check
                const repeatNudgeEnabled = prefs.repeatNudgeEnabled ?? true;
                const notificationFiredToday = localStorage.getItem('ssat_last_notified_date') === todayStr ||
                    localStorage.getItem('ssat_last_notified_evening_date') === todayStr;

                if (repeatNudgeEnabled && notificationFiredToday && lastNotifTime > 0) {
                    const fiveMinutesMs = 5 * 60 * 1000;
                    const timeElapsed = Date.now() - lastNotifTime;

                    if (timeElapsed >= fiveMinutesMs && currentCompletedCount <= savedCompletedCount && escalationCount < 3) {
                        const success = await this.triggerReminder({
                            streakCount: streak,
                            wordsRemaining,
                            isEscalation: true
                        });
                        if (success) {
                            localStorage.setItem('ssat_last_notification_time', Date.now().toString());
                            localStorage.setItem('ssat_escalation_count', (escalationCount + 1).toString());
                        }
                    }
                }
            } catch (e) {
                console.error('[notificationService] Scheduler error:', e);
            }
        }, 30000);

        return () => clearInterval(intervalId);
    },

    calculateStreak(progressList: any[]): number {
        if (!progressList || progressList.length === 0) return 0;

        const sorted = [...progressList]
            .filter(p => p.completed)
            .map(p => p.date)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        if (sorted.length === 0) return 0;

        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (sorted[0] !== todayStr && sorted[0] !== yesterdayStr) {
            return 0;
        }

        let streak = 1;
        let currentDate = new Date(sorted[0]);

        for (let i = 1; i < sorted.length; i++) {
            const nextDate = new Date(sorted[i]);
            const diffTime = Math.abs(currentDate.getTime() - nextDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                streak++;
                currentDate = nextDate;
            } else if (diffDays > 1) {
                break;
            }
        }

        return streak;
    }
};
