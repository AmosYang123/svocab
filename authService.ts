import { Word, WordStatusMap, MarkedWordsMap, StudySet, ThemeMode, DailyProgress } from './types';

// ============================
// IndexedDB Configuration
// ============================
const DB_NAME = 'ssat_vocab_mastery_db';
const DB_VERSION = 2;

const STORES = {
    USERS: 'users',
    USER_DATA: 'userData',
    USER_PREFERENCES: 'userPreferences',
    DAILY_PROGRESS: 'dailyProgress',
};

// ============================
// Types
// ============================
interface User {
    username: string;
    passwordHash: string;
    createdAt: number;
}

interface UserData {
    username: string;
    wordStatuses: WordStatusMap;
    markedWords: MarkedWordsMap;
    savedSets: StudySet[];
    customVocab?: Word[];
}

interface UserPreferences {
    username: string;
    theme: ThemeMode;
    showDefaultVocab: boolean;
    showSatVocab?: boolean;
    isPro?: boolean;
    reminderEnabled?: boolean;
    reminderTime?: string;
}

interface AuthResult {
    success: boolean;
    message: string;
    user?: string;
}

// ============================
// Simple Password Hashing (for demo purposes)
// In production, use a proper library like bcrypt
// ============================
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'ssat_vocab_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================
// IndexedDB Helper Functions
// ============================
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Users store
            if (!db.objectStoreNames.contains(STORES.USERS)) {
                db.createObjectStore(STORES.USERS, { keyPath: 'username' });
            }

            // User data store (progress, groups, etc.)
            if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
                db.createObjectStore(STORES.USER_DATA, { keyPath: 'username' });
            }

            // User preferences store (theme, settings)
            if (!db.objectStoreNames.contains(STORES.USER_PREFERENCES)) {
                db.createObjectStore(STORES.USER_PREFERENCES, { keyPath: 'username' });
            }

            // Daily progress store (daily vocab assignments)
            if (!db.objectStoreNames.contains(STORES.DAILY_PROGRESS)) {
                db.createObjectStore(STORES.DAILY_PROGRESS, { keyPath: 'key' });
            }
        };
    });
}

async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        transaction.oncomplete = () => db.close();
    });
}

async function dbPut<T>(storeName: string, data: T): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
        transaction.oncomplete = () => db.close();
    });
}

async function dbDelete(storeName: string, key: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
        transaction.oncomplete = () => db.close();
    });
}

// ============================
// Session Management
// ============================
const SESSION_KEY = 'ssat_current_user';

function setSession(username: string): void {
    localStorage.setItem(SESSION_KEY, username);
}

function getSession(): string | null {
    return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
}

function clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
}

// ============================
// Auth Service
// ============================
export const authService = {
    // ----------------
    // Authentication
    // ----------------
    async register(username: string, password: string): Promise<AuthResult> {
        const trimmedUsername = username.trim();
        if (!trimmedUsername || trimmedUsername.length < 3) {
            return { success: false, message: 'Username must be at least 3 characters.' };
        }
        if (!password || password.length < 4) {
            return { success: false, message: 'Password must be at least 4 characters.' };
        }

        const normalized = trimmedUsername.toLowerCase();
        const existingUser = await dbGet<User>(STORES.USERS, normalized);
        if (existingUser) {
            return { success: false, message: 'Username already exists. Please choose another.' };
        }

        const passwordHash = await hashPassword(password);
        const newUser: User = {
            username: normalized,
            passwordHash,
            createdAt: Date.now(),
        };

        await dbPut(STORES.USERS, newUser);

        // Initialize user data
        const userData: UserData = {
            username: normalized,
            wordStatuses: {},
            markedWords: {},
            savedSets: [],
            customVocab: [],
        };
        await dbPut(STORES.USER_DATA, userData);

        // Initialize preferences
        const preferences: UserPreferences = {
            username: normalized,
            theme: 'light',
            showDefaultVocab: true,
            showSatVocab: false,
        };
        await dbPut(STORES.USER_PREFERENCES, preferences);

        return { success: true, message: 'Account created successfully!', user: normalized };
    },

    async login(username: string, password: string): Promise<AuthResult> {
        const trimmedUsername = username.trim();
        if (!trimmedUsername || !password) {
            return { success: false, message: 'Please enter username and password.' };
        }

        const normalized = trimmedUsername.toLowerCase();
        const user = await dbGet<User>(STORES.USERS, normalized);
        if (!user) {
            return { success: false, message: 'Account not found. Please register first.' };
        }

        const passwordHash = await hashPassword(password);
        if (user.passwordHash !== passwordHash) {
            return { success: false, message: 'Incorrect password. Please try again.' };
        }

        setSession(normalized);
        return { success: true, message: 'Login successful!', user: normalized };
    },

    loginGuest(): AuthResult {
        const guestName = 'guest_' + Math.floor(Math.random() * 1000000);
        sessionStorage.setItem(SESSION_KEY, guestName);
        return { success: true, message: 'Guest session started. No data will be saved.', user: guestName };
    },

    logout(): void {
        clearSession();
    },

    getCurrentUser(): string | null {
        return getSession();
    },

    // ----------------
    // Password Change
    // ----------------
    async changePassword(oldPassword: string, newPassword: string): Promise<AuthResult> {
        const username = getSession();
        if (!username) {
            return { success: false, message: 'Not logged in.' };
        }

        if (!newPassword || newPassword.length < 4) {
            return { success: false, message: 'New password must be at least 4 characters.' };
        }

        const user = await dbGet<User>(STORES.USERS, username);
        if (!user) {
            return { success: false, message: 'User not found.' };
        }

        const oldHash = await hashPassword(oldPassword);
        if (user.passwordHash !== oldHash) {
            return { success: false, message: 'Current password is incorrect.' };
        }

        const newHash = await hashPassword(newPassword);
        user.passwordHash = newHash;
        await dbPut(STORES.USERS, user);

        return { success: true, message: 'Password changed successfully!' };
    },

    // ----------------
    // Username Change
    // ----------------
    async changeUsername(newUsername: string, password: string): Promise<AuthResult> {
        const currentUsername = getSession();
        if (!currentUsername) {
            return { success: false, message: 'Not logged in.' };
        }

        if (!newUsername || newUsername.length < 3) {
            return { success: false, message: 'New username must be at least 3 characters.' };
        }

        const normalizedNew = newUsername.toLowerCase();
        if (normalizedNew === currentUsername) {
            return { success: false, message: 'New username is the same as current.' };
        }

        // Check if new username exists
        const existingUser = await dbGet<User>(STORES.USERS, normalizedNew);
        if (existingUser) {
            return { success: false, message: 'Username already taken.' };
        }

        // Verify password
        const user = await dbGet<User>(STORES.USERS, currentUsername);
        if (!user) {
            return { success: false, message: 'User not found.' };
        }

        const passwordHash = await hashPassword(password);
        if (user.passwordHash !== passwordHash) {
            return { success: false, message: 'Incorrect password.' };
        }

        // Migrate all data to new username
        const userData = await dbGet<UserData>(STORES.USER_DATA, currentUsername);
        const preferences = await dbGet<UserPreferences>(STORES.USER_PREFERENCES, currentUsername);

        // Create new records
        const newUser: User = { ...user, username: normalizedNew };
        await dbPut(STORES.USERS, newUser);

        if (userData) {
            await dbPut(STORES.USER_DATA, { ...userData, username: normalizedNew });
        }
        if (preferences) {
            await dbPut(STORES.USER_PREFERENCES, { ...preferences, username: normalizedNew });
        }

        // Delete old records
        await dbDelete(STORES.USERS, currentUsername);
        await dbDelete(STORES.USER_DATA, currentUsername);
        await dbDelete(STORES.USER_PREFERENCES, currentUsername);

        // Update session
        setSession(normalizedNew);

        return { success: true, message: 'Username changed successfully!', user: normalizedNew };
    },

    // ----------------
    // User Data (Progress)
    // ----------------
    async getCurrentUserData(): Promise<UserData | null> {
        const username = getSession();
        if (!username) return null;

        // Try IndexedDB first
        const data = await dbGet<UserData>(STORES.USER_DATA, username);
        if (data) return data;

        // Fallback to localStorage (the "side-by-side" local storage option)
        const normalized = username.toLowerCase();
        const oldStatuses = localStorage.getItem(`ssat_vocab_statuses_${normalized}`);
        const oldMarked = localStorage.getItem(`ssat_vocab_marked_${normalized}`);
        const oldSets = localStorage.getItem(`ssat_vocab_sets_${normalized}`);

        if (oldStatuses || oldMarked || oldSets) {
            return {
                username: normalized,
                wordStatuses: oldStatuses ? JSON.parse(oldStatuses) : {},
                markedWords: oldMarked ? JSON.parse(oldMarked) : {},
                savedSets: oldSets ? JSON.parse(oldSets) : [],
                customVocab: JSON.parse(localStorage.getItem(`ssat_vocab_custom_${normalized}`) || '[]'),
            };
        }

        return null;
    },

    async saveUserData(
        username: string,
        data: { wordStatuses: WordStatusMap; markedWords: MarkedWordsMap; savedSets: StudySet[]; customVocab?: Word[] }
    ): Promise<void> {
        if (username.startsWith('guest_')) return; // Don't save guest data

        const normalized = username.toLowerCase();
        const userData: UserData = {
            username: normalized,
            ...data,
        };

        // Save to IndexedDB (Database logic)
        await dbPut(STORES.USER_DATA, userData);

        // Save to localStorage (Local storage option side-by-side)
        localStorage.setItem(`ssat_vocab_statuses_${normalized}`, JSON.stringify(data.wordStatuses));
        localStorage.setItem(`ssat_vocab_marked_${normalized}`, JSON.stringify(data.markedWords));
        localStorage.setItem(`ssat_vocab_sets_${normalized}`, JSON.stringify(data.savedSets));
        if (data.customVocab) {
            localStorage.setItem(`ssat_vocab_custom_${normalized}`, JSON.stringify(data.customVocab));
        }
    },

    // ----------------
    // User Preferences
    // ----------------
    async getUserPreferences(): Promise<UserPreferences | null> {
        const username = getSession();
        if (!username) return null;

        const normalized = username.toLowerCase();

        // Try IndexedDB first
        const prefs = await dbGet<UserPreferences>(STORES.USER_PREFERENCES, normalized);
        if (prefs) return prefs;

        // Fallback to localStorage
        const localPrefs = localStorage.getItem(`ssat_prefs_${normalized}`);
        if (localPrefs) {
            try {
                return JSON.parse(localPrefs);
            } catch (e) {
                return null;
            }
        }

        return null;
    },

    async saveUserPreferences(
        theme: ThemeMode, 
        showDefaultVocab: boolean, 
        isPro?: boolean, 
        showSatVocab?: boolean,
        reminderEnabled?: boolean,
        reminderTime?: string
    ): Promise<void> {
        const username = getSession() || sessionStorage.getItem(SESSION_KEY);
        if (!username || username.startsWith('guest_')) return;

        const normalized = username.toLowerCase();
        const existing = await this.getUserPreferences();
        const preferences: UserPreferences = {
            username: normalized,
            theme,
            showDefaultVocab,
            showSatVocab: showSatVocab ?? existing?.showSatVocab ?? false,
            isPro: isPro ?? existing?.isPro ?? false,
            reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : (existing as any)?.reminderEnabled ?? false,
            reminderTime: reminderTime !== undefined ? reminderTime : (existing as any)?.reminderTime ?? '09:00'
        };

        // Save to IndexedDB
        await dbPut(STORES.USER_PREFERENCES, preferences);

        // Save to localStorage
        localStorage.setItem(`ssat_prefs_${normalized}`, JSON.stringify(preferences));
    },

    // ----------------
    // Reset Data
    // ----------------
    async resetAllData(): Promise<void> {
        const username = getSession();
        if (!username) return;

        const normalized = username.toLowerCase();
        const userData: UserData = {
            username: normalized,
            wordStatuses: {},
            markedWords: {},
            savedSets: [],
            customVocab: [],
        };

        // Reset Database
        await dbPut(STORES.USER_DATA, userData);

        // Reset Local Storage (side-by-side)
        localStorage.removeItem(`ssat_vocab_statuses_${normalized}`);
        localStorage.removeItem(`ssat_vocab_marked_${normalized}`);
        localStorage.removeItem(`ssat_vocab_sets_${normalized}`);
        localStorage.removeItem(`ssat_vocab_custom_${normalized}`);
        localStorage.removeItem(`ssat_prefs_${normalized}`);

        // Clear localStorage navigation data
        localStorage.removeItem(`ssat_${normalized}_mode`);
        localStorage.removeItem(`ssat_${normalized}_set_id`);
        localStorage.removeItem(`ssat_${normalized}_index`);
    },

    // ----------------
    // Migration & Backup
    // ----------------
    async migrateLegacyData(username: string): Promise<void> {
        const normalized = username.toLowerCase();
        // Check if there's old localStorage data for this user
        const oldStatuses = localStorage.getItem(`ssat_vocab_statuses_${normalized}`);
        const oldMarked = localStorage.getItem(`ssat_vocab_marked_${normalized}`);
        const oldSets = localStorage.getItem(`ssat_vocab_sets_${normalized}`);

        if (oldStatuses || oldMarked || oldSets) {
            const currentData = await this.getCurrentUserData();
            const updatedData: UserData = {
                username: normalized,
                wordStatuses: oldStatuses ? JSON.parse(oldStatuses) : (currentData?.wordStatuses || {}),
                markedWords: oldMarked ? JSON.parse(oldMarked) : (currentData?.markedWords || {}),
                savedSets: oldSets ? JSON.parse(oldSets) : (currentData?.savedSets || []),
            };
            await this.saveUserData(normalized, updatedData);

            // We no longer remove items here as they are now used for side-by-side storage.
        }
    },

    // ----------------
    // Enhanced Export/Import System
    // ----------------

    /**
     * Generate a checksum for data integrity verification
     */
    async generateChecksum(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Export all user data with comprehensive metadata for safe backup
     */
    async exportAllData(): Promise<string> {
        const username = getSession();
        if (!username) throw new Error('Not logged in');

        const userData = await this.getCurrentUserData();
        const preferences = await this.getUserPreferences();
        const user = await dbGet<User>(STORES.USERS, username);

        // Compute statistics
        const wordStatuses = userData?.wordStatuses || {};
        const markedWords = userData?.markedWords || {};
        const savedSets = userData?.savedSets || [];

        const masteredWords = Object.entries(wordStatuses).filter(([_, status]) => status === 'mastered');
        const reviewWords = Object.entries(wordStatuses).filter(([_, status]) => status === 'review');
        const markedCount = Object.values(markedWords).filter(Boolean).length;

        // Get localStorage navigation state
        const navigationState = {
            mode: localStorage.getItem(`ssat_${username}_mode`),
            setId: localStorage.getItem(`ssat_${username}_set_id`),
            cardIndex: localStorage.getItem(`ssat_${username}_index`),
        };

        // Build comprehensive export object
        const exportData = {
            // Metadata
            _meta: {
                exportVersion: 2,
                dbVersion: DB_VERSION,
                appName: 'SSAT Vocab Mastery',
                exportedAt: new Date().toISOString(),
                exportedAtTimestamp: Date.now(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },

            // User Account Info
            account: {
                username: username,
                createdAt: user?.createdAt || null,
                createdAtDate: user?.createdAt ? new Date(user.createdAt).toISOString() : null,
            },

            // Statistics Summary (for quick reference)
            statistics: {
                totalWordsStudied: Object.keys(wordStatuses).length,
                masteredCount: masteredWords.length,
                reviewCount: reviewWords.length,
                markedCount: markedCount,
                customSetsCount: savedSets.length,
                customSetsTotalWords: savedSets.reduce((sum, set) => sum + set.wordNames.length, 0),
            },

            // Full Data
            data: {
                wordStatuses: wordStatuses,
                markedWords: markedWords,
                savedSets: savedSets.map(set => ({
                    ...set,
                    wordCount: set.wordNames.length,
                })),
                customVocab: [...(userData?.customVocab || [])].sort((a, b) => a.name.localeCompare(b.name)),
            },

            // Preferences
            preferences: {
                theme: preferences?.theme || 'light',
            },

            // App State (for full restoration)
            appState: navigationState,

            // Lists for human readability
            wordLists: {
                mastered: masteredWords.map(([word]) => word).sort(),
                review: reviewWords.map(([word]) => word).sort(),
                marked: Object.entries(markedWords)
                    .filter(([_, isMarked]) => isMarked)
                    .map(([word]) => word)
                    .sort(),
            },
        };

        // Generate checksum of the data portion
        const dataString = JSON.stringify(exportData.data);
        const checksum = await this.generateChecksum(dataString);

        const finalExport = {
            ...exportData,
            _integrity: {
                checksum: checksum,
                algorithm: 'SHA-256',
            },
        };

        return JSON.stringify(finalExport, null, 2);
    },

    /**
     * Validate import data structure
     */
    validateImportData(imported: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!imported) {
            errors.push('Empty or invalid JSON');
            return { valid: false, errors };
        }

        // Check for v2 format
        if (imported._meta?.exportVersion === 2) {
            if (!imported.account?.username) {
                errors.push('Missing username in account data');
            }
            if (!imported.data) {
                errors.push('Missing data section');
            }
            if (imported.data && typeof imported.data.wordStatuses !== 'object') {
                errors.push('Invalid wordStatuses format');
            }
            if (imported.data && typeof imported.data.markedWords !== 'object') {
                errors.push('Invalid markedWords format');
            }
            if (imported.data && !Array.isArray(imported.data.savedSets)) {
                errors.push('Invalid savedSets format');
            }
            if (imported.data && imported.data.customVocab && !Array.isArray(imported.data.customVocab)) {
                errors.push('Invalid customVocab format');
            }
        }
        // Check for v1 (legacy) format
        else if (imported.version && imported.username && imported.data) {
            // Legacy format is valid
        }
        // Invalid format
        else {
            errors.push('Unrecognized backup format. Expected v1 or v2 format.');
        }

        return { valid: errors.length === 0, errors };
    },

    /**
     * Import user data with validation and optional merge
     */
    async importAllData(jsonString: string, options?: { merge?: boolean }): Promise<AuthResult> {
        try {
            const imported = JSON.parse(jsonString);

            // Validate structure
            const validation = this.validateImportData(imported);
            if (!validation.valid) {
                return {
                    success: false,
                    message: `Invalid backup file: ${validation.errors.join(', ')}`
                };
            }

            const currentUsername = getSession();

            // Handle v2 format
            if (imported._meta?.exportVersion === 2) {
                const importUsername = imported.account.username;

                if (currentUsername && currentUsername !== importUsername) {
                    return {
                        success: false,
                        message: `This backup belongs to user "${importUsername}". You are logged in as "${currentUsername}". Please log in as "${importUsername}" first, or use the full database restore feature.`
                    };
                }

                // Verify checksum if present
                if (imported._integrity?.checksum) {
                    const dataString = JSON.stringify(imported.data);
                    const computedChecksum = await this.generateChecksum(dataString);
                    if (computedChecksum !== imported._integrity.checksum) {
                        return {
                            success: false,
                            message: 'Data integrity check failed. The backup file may be corrupted.'
                        };
                    }
                }

                // Get existing data if merging
                let finalData: any = {
                    wordStatuses: imported.data.wordStatuses || {},
                    markedWords: imported.data.markedWords || {},
                    savedSets: (imported.data.savedSets || []).map((set: any) => ({
                        id: set.id,
                        name: set.name,
                        wordNames: set.wordNames,
                    })),
                    customVocab: imported.data.customVocab || [],
                };

                if (options?.merge && currentUsername) {
                    const existingData = await this.getCurrentUserData();
                    if (existingData) {
                        // Merge word statuses (imported takes precedence)
                        finalData.wordStatuses = {
                            ...existingData.wordStatuses,
                            ...finalData.wordStatuses,
                        };
                        // Merge marked words (imported takes precedence)
                        finalData.markedWords = {
                            ...existingData.markedWords,
                            ...finalData.markedWords,
                        };
                        // Merge saved sets (avoid duplicates by id)
                        const existingIds = new Set(existingData.savedSets.map(s => s.id));
                        const newSets = finalData.savedSets.filter((s: StudySet) => !existingIds.has(s.id));
                        finalData.savedSets = [...existingData.savedSets, ...newSets];

                        // Merge custom vocab (avoid duplicates by name)
                        const existingWordNames = new Set((existingData.customVocab || []).map(w => w.name.toLowerCase()));
                        const newCustomWords = (finalData.customVocab || []).filter((w: Word) => !existingWordNames.has(w.name.toLowerCase()));
                        finalData.customVocab = [...(existingData.customVocab || []), ...newCustomWords];
                    }
                }

                await this.saveUserData(importUsername, finalData);

                // Restore preferences
                if (imported.preferences) {
                    await dbPut(STORES.USER_PREFERENCES, {
                        username: importUsername,
                        theme: imported.preferences.theme || 'light',
                    });
                }

                // Restore app state if present
                if (imported.appState && currentUsername === importUsername) {
                    if (imported.appState.mode) {
                        localStorage.setItem(`ssat_${importUsername}_mode`, imported.appState.mode);
                    }
                    if (imported.appState.setId) {
                        localStorage.setItem(`ssat_${importUsername}_set_id`, imported.appState.setId);
                    }
                    if (imported.appState.cardIndex) {
                        localStorage.setItem(`ssat_${importUsername}_index`, imported.appState.cardIndex);
                    }
                }

                const stats = imported.statistics || {};
                return {
                    success: true,
                    message: `Data restored successfully! (${stats.masteredCount || 0} mastered, ${stats.reviewCount || 0} review, ${stats.customSetsCount || 0} custom sets)`
                };
            }

            // Handle v1 (legacy) format
            if (!imported.username || !imported.data) {
                return { success: false, message: 'Invalid backup file format (v1).' };
            }

            if (currentUsername && currentUsername !== imported.username) {
                return {
                    success: false,
                    message: `This backup belongs to user "${imported.username}". Please log in as that user first.`
                };
            }

            await this.saveUserData(imported.username, imported.data);
            if (imported.preferences) {
                await dbPut(STORES.USER_PREFERENCES, imported.preferences);
            }

            return { success: true, message: 'Legacy backup restored successfully! Refreshing...' };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            return { success: false, message: `Could not parse backup file: ${errorMessage}` };
        }
    },

    /**
     * Export entire database (all users) - for pre-migration backup
     * This is useful before migrating to a real database
     */
    async exportFullDatabase(): Promise<string> {
        const db = await openDatabase();

        const getAllFromStore = <T>(storeName: string): Promise<T[]> => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        };

        try {
            const users = await getAllFromStore<User>(STORES.USERS);
            const userData = await getAllFromStore<UserData>(STORES.USER_DATA);
            const userPreferences = await getAllFromStore<UserPreferences>(STORES.USER_PREFERENCES);

            // Build comprehensive database export
            const dbExport = {
                _meta: {
                    exportVersion: 2,
                    exportType: 'full_database',
                    dbVersion: DB_VERSION,
                    appName: 'SSAT Vocab Mastery',
                    exportedAt: new Date().toISOString(),
                    exportedAtTimestamp: Date.now(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                statistics: {
                    totalUsers: users.length,
                    usersWithData: userData.length,
                    usersWithPreferences: userPreferences.length,
                },
                users: users.map(u => ({
                    username: u.username,
                    createdAt: u.createdAt,
                    createdAtDate: new Date(u.createdAt).toISOString(),
                    // Password hash included for full restoration
                    passwordHash: u.passwordHash,
                })),
                userData: userData.map(ud => ({
                    username: ud.username,
                    wordStatuses: ud.wordStatuses,
                    markedWords: ud.markedWords,
                    savedSets: ud.savedSets,
                    customVocab: [...(ud.customVocab || [])].sort((a, b) => a.name.localeCompare(b.name)),
                })),
                userPreferences: userPreferences,
            };

            db.close();

            // Generate checksum on the actual data keys
            const dataToHash = {
                users: dbExport.users,
                userData: dbExport.userData,
                userPreferences: dbExport.userPreferences
            };
            const dataString = JSON.stringify(dataToHash);
            const checksum = await this.generateChecksum(dataString);

            const finalExport = {
                ...dbExport,
                _integrity: {
                    checksum: checksum,
                    algorithm: 'SHA-256',
                },
            };

            return JSON.stringify(finalExport, null, 2);
        } catch (e) {
            db.close();
            throw e;
        }
    },

    /**
     * Import full database backup - for post-migration recovery
     */
    async importFullDatabase(jsonString: string): Promise<AuthResult> {
        try {
            const imported = JSON.parse(jsonString);

            // Validate it's a full database export
            if (imported._meta?.exportType !== 'full_database') {
                return {
                    success: false,
                    message: 'This is not a full database backup. Use regular import for single-user backups.'
                };
            }

            if (!imported.users || !Array.isArray(imported.users)) {
                return { success: false, message: 'Invalid database backup: missing users array.' };
            }

            // Verify checksum if present
            if (imported._integrity?.checksum) {
                const dataToVerify = {
                    users: imported.users,
                    userData: imported.userData,
                    userPreferences: imported.userPreferences,
                };
                const dataString = JSON.stringify(dataToVerify);
                const computedChecksum = await this.generateChecksum(dataString);
                if (computedChecksum !== imported._integrity.checksum) {
                    return {
                        success: false,
                        message: 'Data integrity check failed. The backup file may be corrupted.'
                    };
                }
            }

            // Restore all users
            for (const user of imported.users) {
                const userRecord: User = {
                    username: user.username,
                    passwordHash: user.passwordHash,
                    createdAt: user.createdAt,
                };
                await dbPut(STORES.USERS, userRecord);
            }

            // Restore all user data
            for (const ud of imported.userData || []) {
                const userDataRecord: UserData = {
                    username: ud.username,
                    wordStatuses: ud.wordStatuses || {},
                    markedWords: ud.markedWords || {},
                    savedSets: ud.savedSets || [],
                    customVocab: ud.customVocab || [],
                };
                await dbPut(STORES.USER_DATA, userDataRecord);
            }

            // Restore all preferences
            for (const pref of imported.userPreferences || []) {
                await dbPut(STORES.USER_PREFERENCES, pref);
            }

            return {
                success: true,
                message: `Database restored successfully! ${imported.users.length} user(s) recovered.`
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            return { success: false, message: `Could not restore database: ${errorMessage}` };
        }
    },

    /**
     * Get a summary of all data for display purposes
     */
    async getDataSummary(): Promise<{
        username: string;
        masteredCount: number;
        reviewCount: number;
        markedCount: number;
        customSetsCount: number;
        lastActivity: string | null;
    } | null> {
        const username = getSession();
        if (!username) return null;

        const userData = await this.getCurrentUserData();
        if (!userData) return null;

        const masteredCount = Object.values(userData.wordStatuses).filter(s => s === 'mastered').length;
        const reviewCount = Object.values(userData.wordStatuses).filter(s => s === 'review').length;
        const markedCount = Object.values(userData.markedWords).filter(Boolean).length;

        return {
            username,
            masteredCount,
            reviewCount,
            markedCount,
            customSetsCount: userData.savedSets.length,
            lastActivity: null, // Could be enhanced to track this
        };
    },

    // ----------------
    // Daily Progress
    // ----------------
    async getDailyProgress(date: string): Promise<DailyProgress | null> {
        const username = getSession();
        if (!username) return null;

        const key = `${username.toLowerCase()}_${date}`;

        // Try IndexedDB first
        try {
            const record = await dbGet<{ key: string } & DailyProgress>(STORES.DAILY_PROGRESS, key);
            if (record) {
                const { key: _k, ...progress } = record;
                return progress;
            }
        } catch (e) {
            // IndexedDB might not have the store yet (version migration)
        }

        // Fallback to localStorage
        const local = localStorage.getItem(`ssat_daily_${key}`);
        if (local) {
            try { return JSON.parse(local); } catch { return null; }
        }

        return null;
    },

    async saveDailyProgress(progress: DailyProgress): Promise<void> {
        const username = getSession();
        if (!username || username.startsWith('guest_')) return;

        const key = `${username.toLowerCase()}_${progress.date}`;

        // Save to IndexedDB
        try {
            await dbPut(STORES.DAILY_PROGRESS, { key, ...progress });
        } catch (e) {
            // IndexedDB might not have the store yet
        }

        // Save to localStorage
        localStorage.setItem(`ssat_daily_${key}`, JSON.stringify(progress));
    },

    async getAllDailyProgress(): Promise<DailyProgress[]> {
        const username = getSession();
        if (!username) return [];

        const normalized = username.toLowerCase();
        const results: DailyProgress[] = [];

        // Try IndexedDB
        try {
            const db = await openDatabase();
            const tx = db.transaction(STORES.DAILY_PROGRESS, 'readonly');
            const store = tx.objectStore(STORES.DAILY_PROGRESS);
            const allRecords = await new Promise<any[]>((resolve, reject) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
            tx.oncomplete = () => db.close();

            for (const record of allRecords) {
                if (record.key && record.key.startsWith(normalized + '_')) {
                    const { key: _k, ...progress } = record;
                    results.push(progress);
                }
            }
            if (results.length > 0) return results;
        } catch (e) {
            // Fallback below
        }

        // Fallback: scan localStorage
        const prefix = `ssat_daily_${normalized}_`;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) {
                try {
                    results.push(JSON.parse(localStorage.getItem(k)!));
                } catch { /* skip */ }
            }
        }
        return results;
    },
};
