/**
 * Cloud Database Service (Supabase)
 * 
 * This service handles all cloud database operations for user data.
 * It provides the same interface as the local authService for easy migration.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Word, WordStatusMap, MarkedWordsMap, StudySet, ThemeMode } from '../types';

// ============================
// Types
// ============================
export interface CloudUserData {
    wordStatuses: WordStatusMap;
    markedWords: MarkedWordsMap;
    savedSets: StudySet[];
    customVocab?: Word[];
}

export interface CloudAuthResult {
    success: boolean;
    message: string;
    userId?: string;
    username?: string;
}

const CLOUD_TIMEOUT_MS = 2500;

function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number = CLOUD_TIMEOUT_MS): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Supabase database is paused or unreachable. Falling back to local offline mode.'));
        }, ms);
        Promise.resolve(promiseLike).then(
            (res) => {
                clearTimeout(timer);
                resolve(res);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

// ============================
// Cloud Database Service
// ============================
export const cloudService = {
    // ----------------
    // Configuration Check
    // ----------------
    isConfigured(): boolean {
        return isSupabaseConfigured;
    },

    // ----------------
    // Authentication
    // ----------------
    async ensureUserProfile(userId: string, emailOrUsername: string): Promise<string> {
        if (!isSupabaseConfigured) return emailOrUsername.split('@')[0];
        try {
            const cleanUsername = emailOrUsername.includes('@')
                ? emailOrUsername.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '')
                : emailOrUsername.toLowerCase().replace(/[^a-z0-9._]/g, '');

            const finalUsername = cleanUsername || 'user';

            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userId)
                .maybeSingle();

            if (profile?.username) {
                return profile.username;
            }

            // Check if username is already taken by another user
            let targetUsername = finalUsername;
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', targetUsername)
                .maybeSingle();

            if (existing && existing.id !== userId) {
                targetUsername = `${finalUsername}_${Math.floor(Math.random() * 1000)}`;
            }

            // Insert profile record explicitly if trigger didn't catch it
            await supabase
                .from('profiles')
                .upsert({ id: userId, username: targetUsername }, { onConflict: 'id' });

            return targetUsername;
        } catch {
            return emailOrUsername.split('@')[0];
        }
    },

    async registerWithEmail(email: string, password: string): Promise<CloudAuthResult> {
        if (!isSupabaseConfigured) {
            return { success: false, message: 'Cloud service not configured.' };
        }

        try {
            const normalizedEmail = email.trim().toLowerCase();
            const username = normalizedEmail.split('@')[0];

            const authResult = await withTimeout(supabase.auth.signUp({
                email: normalizedEmail,
                password,
                options: {
                    data: { username }
                }
            }));
            const { data, error } = authResult;

            if (error) {
                if (error.message.includes('already registered') || error.message.includes('User already registered')) {
                    return { success: false, message: 'An account with this email already exists. Please log in.' };
                }
                return { success: false, message: error.message };
            }

            if (!data.user) {
                return { success: false, message: 'Registration failed.' };
            }

            // If Supabase has email confirmation ON, user session will be null until confirmed
            if (!data.session) {
                const finalUsername = await this.ensureUserProfile(data.user.id, normalizedEmail);
                return {
                    success: true,
                    message: 'Account created! Please check your email to confirm your account before logging in.',
                    userId: data.user.id,
                    username: finalUsername
                };
            }

            // Ensure profile exists in profiles table
            const finalUsername = await this.ensureUserProfile(data.user.id, normalizedEmail);

            return {
                success: true,
                message: 'Account created successfully!',
                userId: data.user.id,
                username: finalUsername
            };
        } catch (error: any) {
            return { success: false, message: error?.message || 'Email registration failed.' };
        }
    },

    async loginWithEmail(email: string, password: string): Promise<CloudAuthResult> {
        if (!isSupabaseConfigured) {
            return { success: false, message: 'Cloud service not configured.' };
        }

        try {
            const normalizedEmail = email.trim().toLowerCase();

            const signInResult = await withTimeout(supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            }));
            const { data, error } = signInResult;

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    return { success: false, message: 'Invalid email or password.' };
                }
                if (error.message.includes('Email not confirmed')) {
                    return { success: false, message: 'Email not confirmed yet. Please check your inbox or disable email confirmation in Supabase.' };
                }
                return { success: false, message: error.message };
            }

            if (!data.user) {
                return { success: false, message: 'Login failed.' };
            }

            // Ensure profile exists in profiles table
            const finalUsername = await this.ensureUserProfile(data.user.id, normalizedEmail);

            return {
                success: true,
                message: 'Login successful!',
                userId: data.user.id,
                username: finalUsername,
            };
        } catch (error: any) {
            return { success: false, message: error?.message || 'Login failed. Please try again.' };
        }
    },

    async register(username: string, password: string): Promise<CloudAuthResult> {
        if (!isSupabaseConfigured) {
            return { success: false, message: 'Cloud service not configured.' };
        }

        try {
            const normalizedUsername = username.trim().toLowerCase();
            const email = normalizedUsername.includes('@') ? normalizedUsername : `${normalizedUsername}@vocab.app`;

            // Security: Username validation if not an email
            if (!normalizedUsername.includes('@')) {
                const usernameRegex = /^[a-z0-9._]{3,30}$/;
                if (!usernameRegex.test(normalizedUsername)) {
                    return { success: false, message: 'Username must be 3-30 characters, alphanumeric, dots, or underscores.' };
                }
            }

            // Create auth user in Supabase
            const authResult = await withTimeout(supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username: normalizedUsername.split('@')[0] }
                }
            }));
            const { data: authData, error: authError } = authResult;

            if (authError) {
                if (authError.message.includes('already registered')) {
                    return { success: false, message: 'Username or email already taken.' };
                }
                return { success: false, message: authError.message };
            }

            if (!authData.user) {
                return { success: false, message: 'Registration failed.' };
            }

            const finalUsername = await this.ensureUserProfile(authData.user.id, normalizedUsername);

            return {
                success: true,
                message: 'Account created successfully!',
                userId: authData.user.id,
                username: finalUsername,
            };
        } catch (error: any) {
            return { success: false, message: error?.message || 'Registration failed.' };
        }
    },

    async login(username: string, password: string): Promise<CloudAuthResult> {
        if (!isSupabaseConfigured) {
            return { success: false, message: 'Cloud service not configured.' };
        }

        try {
            const normalizedUsername = username.trim().toLowerCase();

            // Try with @vocab.app domain first
            let signInResult = await withTimeout(supabase.auth.signInWithPassword({
                email: `${normalizedUsername}@vocab.app`,
                password,
            }));

            // Fallback to @vocab.internal domain if needed
            if (signInResult.error) {
                const fallbackResult = await withTimeout(supabase.auth.signInWithPassword({
                    email: `${normalizedUsername}@vocab.internal`,
                    password,
                }));
                if (!fallbackResult.error) {
                    signInResult = fallbackResult;
                }
            }

            // Fallback to raw email if username contains @
            if (signInResult.error && normalizedUsername.includes('@')) {
                const rawEmailResult = await withTimeout(supabase.auth.signInWithPassword({
                    email: normalizedUsername,
                    password,
                }));
                if (!rawEmailResult.error) {
                    signInResult = rawEmailResult;
                }
            }

            const { data, error } = signInResult;

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    return { success: false, message: 'Invalid username or password.' };
                }
                if (error.message.includes('Email not confirmed')) {
                    return { success: false, message: 'Email not confirmed yet. Please check your inbox or disable email confirmation in Supabase.' };
                }
                return { success: false, message: error.message };
            }

            if (!data.user) {
                return { success: false, message: 'Login failed.' };
            }

            // Ensure profile exists in profiles table
            const finalUsername = await this.ensureUserProfile(data.user.id, normalizedUsername);

            return {
                success: true,
                message: 'Login successful!',
                userId: data.user.id,
                username: finalUsername,
            };
        } catch (error: any) {
            return { success: false, message: error?.message || 'Login failed. Please try again.' };
        }
    },

    async logout(): Promise<void> {
        if (!isSupabaseConfigured) return;
        await supabase.auth.signOut();
    },

    async signInWithOAuth(provider: 'google' | 'github' | 'apple' | 'azure'): Promise<CloudAuthResult> {
        if (!isSupabaseConfigured) {
            return { success: false, message: 'Cloud service not configured.' };
        }

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: window.location.origin,
                }
            });

            if (error) {
                return { success: false, message: error.message };
            }

            // Redirect happens automatically
            return { success: true, message: 'Redirecting to login...' };
        } catch (error) {
            return { success: false, message: 'Social login failed. Please try again.' };
        }
    },

    onAuthStateChange(callback: (userId: string | null) => void) {
        if (!isSupabaseConfigured) return () => { };
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                callback(session?.user.id || null);
            } else if (event === 'SIGNED_OUT') {
                callback(null);
            }
        });
        return () => subscription.unsubscribe();
    },

    async getCurrentUser(): Promise<{ id: string; username: string; isPro: boolean } | null> {
        if (!isSupabaseConfigured) return null;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const username = await this.ensureUserProfile(user.id, user.user_metadata?.username || user.email || 'user');

        return {
            id: user.id,
            username,
            isPro: user.user_metadata?.is_pro || false,
        };
    },

    async updateProStatus(isPro: boolean): Promise<boolean> {
        if (!isSupabaseConfigured) return false;
        try {
            const { error } = await supabase.auth.updateUser({
                data: { is_pro: isPro }
            });
            return !error;
        } catch (e) {
            return false;
        }
    },

    // ----------------
    // User Data Operations
    // ----------------
    async getUserData(userId: string): Promise<CloudUserData | null> {
        if (!isSupabaseConfigured) return null;

        try {
            // Fetch word statuses
            const { data: wordStatusRows } = await supabase
                .from('user_word_statuses')
                .select('word_name, status')
                .eq('user_id', userId);

            const wordStatuses: WordStatusMap = {};
            wordStatusRows?.forEach(row => {
                wordStatuses[row.word_name] = row.status;
            });

            // Fetch marked words
            const { data: markedRows } = await supabase
                .from('user_marked_words')
                .select('word_name, marked')
                .eq('user_id', userId);

            const markedWords: MarkedWordsMap = {};
            markedRows?.forEach(row => {
                markedWords[row.word_name] = row.marked;
            });

            // Fetch study sets
            const { data: setRows } = await supabase
                .from('user_study_sets')
                .select('id, name, word_names')
                .eq('user_id', userId);

            const savedSets: StudySet[] = (setRows || []).map(row => ({
                id: row.id,
                name: row.name,
                wordNames: row.word_names,
            }));

            // Fetch custom vocab
            const { data: vocabRows } = await supabase
                .from('user_custom_vocab')
                .select('data')
                .eq('user_id', userId);

            const customVocab: Word[] = (vocabRows || []).map(row => row.data);

            return { wordStatuses, markedWords, savedSets, customVocab };
        } catch (error) {
            // Error fetching user data silently handled
            return null;
        }
    },

    async saveUserData(userId: string, data: CloudUserData): Promise<boolean> {
        if (!isSupabaseConfigured) return false;

        try {
            // Upsert word statuses
            const wordStatusUpserts = Object.entries(data.wordStatuses)
                .filter(([_, status]) => status !== null)
                .map(([word_name, status]) => ({
                    user_id: userId,
                    word_name,
                    status,
                    updated_at: new Date().toISOString(),
                }));

            if (wordStatusUpserts.length > 0) {
                const { error: statusError } = await supabase
                    .from('user_word_statuses')
                    .upsert(wordStatusUpserts, { onConflict: 'user_id,word_name' });

                if (statusError) {
                    // Error saving word statuses
                }
            }

            // Delete unmarked words (status = null)
            const nullStatusWords = Object.entries(data.wordStatuses)
                .filter(([_, status]) => status === null)
                .map(([word_name]) => word_name);

            if (nullStatusWords.length > 0) {
                await supabase
                    .from('user_word_statuses')
                    .delete()
                    .eq('user_id', userId)
                    .in('word_name', nullStatusWords);
            }

            // Upsert marked words
            const markedUpserts = Object.entries(data.markedWords)
                .map(([word_name, marked]) => ({
                    user_id: userId,
                    word_name,
                    marked,
                }));

            if (markedUpserts.length > 0) {
                const { error: markedError } = await supabase
                    .from('user_marked_words')
                    .upsert(markedUpserts, { onConflict: 'user_id,word_name' });

                if (markedError) {
                    // Error saving marked words
                }
            }

            // Handle study sets - delete all and re-insert 
            await supabase
                .from('user_study_sets')
                .delete()
                .eq('user_id', userId);

            if (data.savedSets && data.savedSets.length > 0) {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                const setInserts = data.savedSets.map(set => ({
                    id: uuidRegex.test(set.id) ? set.id : crypto.randomUUID(),
                    user_id: userId,
                    name: set.name,
                    word_names: set.wordNames,
                }));

                const { error: setsError } = await supabase
                    .from('user_study_sets')
                    .insert(setInserts);

                if (setsError) {
                    console.error('[CloudService] Error saving study sets:', setsError.message);
                }
            }

            // Handle custom vocab - delete and re-insert
            await supabase
                .from('user_custom_vocab')
                .delete()
                .eq('user_id', userId);

            if (data.customVocab && data.customVocab.length > 0) {
                const vocabInserts = data.customVocab.map(word => ({
                    user_id: userId,
                    word_name: word.name,
                    data: word
                }));

                const { error: vocabError } = await supabase
                    .from('user_custom_vocab')
                    .insert(vocabInserts);

                if (vocabError) {
                    // Error saving custom vocab
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    },

    // ----------------
    // Preferences
    // ----------------
    async getPreferences(userId: string): Promise<{
        theme: ThemeMode;
        showDefaultVocab: boolean;
        showSatVocab: boolean;
        reminderEnabled?: boolean;
        reminderTime?: string;
        lastStudyMode?: string;
        lastActiveSetId?: string;
        lastCardIndex?: number;
        lastWordName?: string;
    } | null> {
        if (!isSupabaseConfigured) return null;

        try {
            const { data, error } = await supabase
                .from('user_preferences')
                .select('theme, show_default_vocab, show_sat_vocab, last_study_mode, last_active_set_id, last_card_index, reminder_enabled, reminder_time, last_word_name')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                // Fallback for database instances where newer columns haven't been added yet
                const { data: fallbackData } = await supabase
                    .from('user_preferences')
                    .select('theme, show_default_vocab, show_sat_vocab, last_study_mode, last_active_set_id, last_card_index')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (fallbackData) {
                    const casted = fallbackData as any;
                    return {
                        theme: casted.theme as ThemeMode,
                        showDefaultVocab: casted.show_default_vocab ?? true,
                        showSatVocab: casted.show_sat_vocab ?? false,
                        reminderEnabled: false,
                        reminderTime: '09:00',
                        lastStudyMode: casted.last_study_mode || 'all',
                        lastActiveSetId: casted.last_active_set_id || null,
                        lastCardIndex: casted.last_card_index ?? 0,
                        lastWordName: casted.last_word_name || null
                    };
                }
                return null;
            }

            const castedData = data as any;

            return data ? {
                theme: data.theme as ThemeMode,
                showDefaultVocab: data.show_default_vocab ?? true,
                showSatVocab: castedData?.show_sat_vocab ?? false,
                reminderEnabled: castedData?.reminder_enabled ?? false,
                reminderTime: castedData?.reminder_time ?? '09:00',
                lastStudyMode: castedData?.last_study_mode || 'all',
                lastActiveSetId: castedData?.last_active_set_id || null,
                lastCardIndex: castedData?.last_card_index ?? 0,
                lastWordName: castedData?.last_word_name || null
            } : null;
        } catch (error) {
            return null;
        }
    },

    async savePreferences(
        userId: string,
        theme: ThemeMode,
        showDefaultVocab: boolean,
        showSatVocab?: boolean,
        lastStudyMode?: string,
        lastActiveSetId?: string,
        lastCardIndex?: number,
        reminderEnabled?: boolean,
        reminderTime?: string,
        lastWordName?: string
    ): Promise<boolean> {
        if (!isSupabaseConfigured) return false;

        try {
            const updateObj: any = {
                user_id: userId,
                theme,
                show_default_vocab: showDefaultVocab,
                updated_at: new Date().toISOString(),
            };

            if (showSatVocab !== undefined) updateObj.show_sat_vocab = showSatVocab;
            if (lastStudyMode !== undefined) updateObj.last_study_mode = lastStudyMode;
            if (lastActiveSetId !== undefined) updateObj.last_active_set_id = lastActiveSetId;
            if (lastCardIndex !== undefined) updateObj.last_card_index = lastCardIndex;
            if (lastWordName !== undefined) updateObj.last_word_name = lastWordName;
            if (reminderEnabled !== undefined) updateObj.reminder_enabled = reminderEnabled;
            if (reminderTime !== undefined) updateObj.reminder_time = reminderTime;

            let { error } = await supabase
                .from('user_preferences')
                .upsert(updateObj);

            if (error) {
                // If new columns (reminder_enabled, last_word_name) don't exist yet in user's Supabase schema, strip them and retry
                delete updateObj.reminder_enabled;
                delete updateObj.reminder_time;
                delete updateObj.last_word_name;
                const retry = await supabase.from('user_preferences').upsert(updateObj);
                return !retry.error;
            }

            return !error;
        } catch (error) {
            return false;
        }
    },

    // ----------------
    // Migration Helper
    // ----------------
    async migrateFromLocal(
        userId: string,
        localData: CloudUserData
    ): Promise<{ success: boolean; message: string }> {
        if (!isSupabaseConfigured) {
            return { success: false, message: 'Cloud service not configured.' };
        }

        try {
            const saved = await this.saveUserData(userId, localData);
            if (saved) {
                return {
                    success: true,
                    message: `Successfully migrated ${Object.keys(localData.wordStatuses).length} word statuses, ${Object.keys(localData.markedWords).length} marked words, and ${localData.savedSets.length} study sets.`
                };
            }
            return { success: false, message: 'Failed to save data to cloud.' };
        } catch (error) {
            return { success: false, message: 'Migration failed. Please try again.' };
        }
    },

    // ----------------
    // Real-time Subscription
    // ----------------
    subscribeToChanges(userId: string, callback: (data: CloudUserData) => void) {
        if (!isSupabaseConfigured) return null;

        const subscription = supabase
            .channel(`user-data-${userId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_word_statuses',
                filter: `user_id=eq.${userId}`,
            }, async () => {
                const data = await this.getUserData(userId);
                if (data) callback(data);
            })
            .subscribe();

        return subscription;
    },

    unsubscribe(subscription: any) {
        if (subscription) {
            supabase.removeChannel(subscription);
        }
    },

    // ----------------
    // Daily Progress
    // ----------------
    async getDailyProgress(userId: string, date: string): Promise<{
        date: string;
        wordNames: string[];
        completed: boolean;
        completedAt: string | null;
        progress: any;
    } | null> {
        if (!isSupabaseConfigured) return null;

        try {
            const { data } = await supabase
                .from('user_daily_progress')
                .select('date, word_names, completed, completed_at, progress')
                .eq('user_id', userId)
                .eq('date', date)
                .single();

            if (!data) return null;

            return {
                date: data.date,
                wordNames: data.word_names || [],
                completed: data.completed || false,
                completedAt: data.completed_at || null,
                progress: data.progress || {},
            };
        } catch {
            return null;
        }
    },

    async getAllDailyProgress(userId: string): Promise<{
        date: string;
        wordNames: string[];
        completed: boolean;
        completedAt: string | null;
        progress: any;
    }[]> {
        if (!isSupabaseConfigured) return [];

        try {
            const { data } = await supabase
                .from('user_daily_progress')
                .select('date, word_names, completed, completed_at, progress')
                .eq('user_id', userId)
                .order('date', { ascending: false });

            return (data || []).map(row => ({
                date: row.date,
                wordNames: row.word_names || [],
                completed: row.completed || false,
                completedAt: row.completed_at || null,
                progress: row.progress || {},
            }));
        } catch {
            return [];
        }
    },

    async saveDailyProgress(userId: string, dailyProgress: {
        date: string;
        wordNames: string[];
        completed: boolean;
        completedAt: string | null;
        progress: any;
    }): Promise<boolean> {
        if (!isSupabaseConfigured) return false;

        try {
            const { error } = await supabase
                .from('user_daily_progress')
                .upsert({
                    user_id: userId,
                    date: dailyProgress.date,
                    word_names: dailyProgress.wordNames,
                    completed: dailyProgress.completed,
                    completed_at: dailyProgress.completedAt,
                    progress: dailyProgress.progress,
                }, { onConflict: 'user_id,date' });

            return !error;
        } catch {
            return false;
        }
    },
};
