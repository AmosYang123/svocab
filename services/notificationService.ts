/**
 * Browser Notification Service
 * 
 * Manages system notification permissions, local triggers,
 * and tracks notification states using localStorage.
 */

import { hybridService } from './hybridService';

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

        // On mobile environments with Service Workers, permission is handled via PWA
        return true;
    },

    // ----------------
    // Core Actions
    // ----------------
    async triggerReminder(streakCount: number = 0): Promise<boolean> {
        if (!this.isSupported() || Notification.permission !== 'granted') {
            return false;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const lastNotified = localStorage.getItem('ssat_last_notified_date');

        if (lastNotified === todayStr) {
            return false; // Already notified today
        }

        const title = "SSAT Vocab Mastery 📚";
        const options: NotificationOptions = {
            body: streakCount > 0 
                ? `Keep your ${streakCount}-day streak alive! Learn 30 new words today.`
                : "Ready for today's vocab workout? Secure 30 new words in 15 minutes.",
            icon: '/favicon.ico', // standard web icon path
            badge: '/favicon.ico',
            tag: 'daily-reminder',
            requireInteraction: true,
        };

        try {
            new Notification(title, options);
            localStorage.setItem('ssat_last_notified_date', todayStr);
            return true;
        } catch (e) {
            return false;
        }
    },

    // ----------------
    // Background Check
    // ----------------
    setupDailyScheduler() {
        if (!this.isSupported()) return;

        // Check every minute
        const intervalId = setInterval(async () => {
            const user = await hybridService.getCurrentUser();
            if (!user) return;

            const prefs = await hybridService.getPreferences();
            if (!prefs || !prefs.reminderEnabled) return;

            // Check if completed today's exercise
            const todayStr = new Date().toISOString().split('T')[0];
            const daily = await hybridService.getDailyProgress(todayStr);
            if (daily && daily.completed) return; // Already completed today!

            // Parse reminder time (e.g. "09:00")
            const [remHour, remMin] = (prefs as any).reminderTime?.split(':').map(Number) || [9, 0];
            
            const now = new Date();
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();

            // Trigger notification if time is reached/passed
            if (currentHour > remHour || (currentHour === remHour && currentMin >= remMin)) {
                // Get streak if possible from calendar count
                const allProgress = await hybridService.getAllDailyProgress();
                const streak = this.calculateStreak(allProgress);
                this.triggerReminder(streak);
            }
        }, 60000);

        return () => clearInterval(intervalId);
    },

    calculateStreak(progressList: any[]): number {
        if (!progressList || progressList.length === 0) return 0;
        
        // Sort progress by date descending
        const sorted = [...progressList]
            .filter(p => p.completed)
            .map(p => p.date)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        if (sorted.length === 0) return 0;

        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // If today or yesterday is not the latest completed day, streak is broken/0
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
                break; // streak broken
            }
        }

        return streak;
    }
};
