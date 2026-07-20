import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from './Icons';
import { authService } from '../authService';
import { hybridService, StorageMode } from '../services/hybridService';
import { ThemeMode } from '../types';

interface SettingsModalProps {
    currentUser: string;
    theme: ThemeMode;
    showDefaultVocab: boolean;
    showSatVocab: boolean;
    onUpdatePreferences: (theme: ThemeMode, showDefault: boolean, showSat?: boolean) => void;
    onUsernameChange: (name: string) => void;
    onLogout: () => void;
    onClose: () => void;
    onShowImport: () => void;
    onShowPayment: () => void;
    isPro?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    currentUser,
    theme,
    showDefaultVocab,
    showSatVocab,
    onUpdatePreferences,
    onUsernameChange,
    onLogout,
    onClose,
    onShowImport,
    onShowPayment,
    isPro = false
}) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'general' | 'account'>('general');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [storageMode, setStorageMode] = useState<StorageMode>('local');
    const [isCloudConfigured] = useState(hybridService.isCloudAvailable());
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showFullRestoreConfirm, setShowFullRestoreConfirm] = useState(false);

    // Account form states
    const [newUsername, setNewUsername] = useState('');
    const [usernamePassword, setUsernamePassword] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    useEffect(() => {
        setStorageMode(hybridService.getStorageMode());
    }, []);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 15000);
    };

    const handleChangeUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername || !usernamePassword) {
            showMessage('error', 'Please fill in all fields.');
            return;
        }
        setLoading(true);
        try {
            const result = await authService.changeUsername(newUsername, usernamePassword);
            if (result.success) {
                showMessage('success', result.message);
                onUsernameChange(result.user!);
                setNewUsername('');
                setUsernamePassword('');
            } else {
                showMessage('error', result.message);
            }
        } catch {
            showMessage('error', 'An error occurred.');
        }
        setLoading(false);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            showMessage('error', 'New passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            const result = await authService.changePassword(oldPassword, newPassword);
            if (result.success) {
                showMessage('success', result.message);
                setOldPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
            } else {
                showMessage('error', result.message);
            }
        } catch {
            showMessage('error', 'An error occurred.');
        }
        setLoading(false);
    };

    const handleResetData = async () => {
        await authService.resetAllData();
        window.location.reload();
    };

    const handleSyncToCloud = async () => {
        setLoading(true);
        try {
            const result = await hybridService.migrateLocalToCloud();
            if (result.success) {
                showMessage('success', result.message);
                setStorageMode('hybrid');
            } else {
                showMessage('error', result.message);
            }
        } catch (e) {
            showMessage('error', 'Sync failed');
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'general' as const, label: 'General' },
        { id: 'account' as const, label: 'Account' },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-bold text-foreground">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <Icons.Close />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 py-2 border-b border-border bg-muted/30">
                    <div className="flex p-1 bg-muted rounded-xl">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-2 px-4 text-[10px] font-semibold uppercase tracking-widest rounded-lg transition-all
                                    ${activeTab === tab.id
                                        ? 'bg-card text-primary shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mx-6 mt-4 p-3 rounded-lg text-sm text-center
            ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
                    {/* General Tab */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            {/* User Info */}
                            <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-muted-foreground mb-1 font-medium">Signed in as</div>
                                    <div className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <div className="p-1 bg-primary/10 rounded-md text-primary">
                                            <Icons.User />
                                        </div>
                                        {currentUser}
                                    </div>
                                </div>

                                <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border ${storageMode === 'cloud' || storageMode === 'hybrid'
                                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                    : 'bg-muted text-muted-foreground border-border'
                                    }`}>
                                    {storageMode === 'cloud' || storageMode === 'hybrid'
                                        ? <><Icons.Cloud /> Cloud Sync</>
                                        : <><Icons.Device /> Local Storage</>
                                    }
                                </span>
                            </div>

                            {/* Pro Banner */}
                            {/* {!isPro && (
                                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icons.Lightning className="w-5 h-5 text-yellow-300" />
                                                <span className="font-black uppercase tracking-widest text-xs">Pro Membership</span>
                                            </div>
                                            <div className="text-sm font-medium opacity-90">Unlock advanced stats & sync</div>
                                        </div>
                                        <button
                                            onClick={onShowPayment}
                                            className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-indigo-50 transition-colors shadow-sm"
                                        >
                                            Upgrade
                                        </button>
                                    </div>
                                </div>
                            )} */}

                            {/* Theme Selector */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                                    <Icons.Settings /> App Appearance
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'light', name: 'Light', colors: ['#f8f5f0', '#c55933', '#1c1917'] },
                                        { id: 'dark', name: 'Dark', colors: ['#171412', '#d96a43', '#e7e0d6'] },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => onUpdatePreferences(t.id as ThemeMode, showDefaultVocab)}
                                            className={`flex items-center justify-between px-4 py-4 rounded-xl border transition-all text-left relative overflow-hidden group
                                                ${theme === t.id
                                                    ? 'border-primary bg-primary/10 text-foreground shadow-xs'
                                                    : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                                                }`}
                                        >
                                            <div className="flex flex-col gap-2 flex-1 relative z-10">
                                                <span className={`text-[11px] font-semibold uppercase tracking-widest transition-colors ${theme === t.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                                    {t.name}
                                                </span>
                                                <div className="flex gap-1.5">
                                                    {t.colors.map((c, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-4 h-4 rounded-md border border-border"
                                                            style={{ backgroundColor: c }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            {theme === t.id && (
                                                <div className="text-primary-foreground bg-primary p-1 rounded-full shadow-xs relative z-10">
                                                    <Icons.Check className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Vocabulary Options */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                                    <Icons.AcademicCap /> Vocabulary Focus
                                </h3>
                                <div className="flex bg-muted p-1 rounded-xl border border-border text-xs">
                                    <button
                                        onClick={() => onUpdatePreferences(theme, true, false)}
                                        className={`flex-1 py-2 px-3 rounded-lg font-semibold uppercase tracking-wider text-[10px] transition-all ${
                                            showDefaultVocab && !showSatVocab
                                                ? 'bg-card text-foreground shadow-xs font-bold'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        SSAT (~625)
                                    </button>
                                    <button
                                        onClick={() => onUpdatePreferences(theme, false, true)}
                                        className={`flex-1 py-2 px-3 rounded-lg font-semibold uppercase tracking-wider text-[10px] transition-all ${
                                            !showDefaultVocab && showSatVocab
                                                ? 'bg-card text-foreground shadow-xs font-bold'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        SAT (~1,270)
                                    </button>
                                    <button
                                        onClick={() => onUpdatePreferences(theme, true, true)}
                                        className={`flex-1 py-2 px-3 rounded-lg font-semibold uppercase tracking-wider text-[10px] transition-all ${
                                            showDefaultVocab && showSatVocab
                                                ? 'bg-card text-foreground shadow-xs font-bold'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Both (~1,895)
                                    </button>
                                </div>
                                <p className="text-[11px] text-muted-foreground font-medium px-1">
                                    Switching your vocabulary focus updates your active deck across flashcards, daily lessons, and practice tests.
                                </p>
                            </div>

                            {/* Cloud Sync */}
                            {isCloudConfigured && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                                        <Icons.Cloud /> Sync Status
                                    </h3>

                                    {storageMode === 'local' ? (
                                        <div className="bg-card border border-border rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="text-primary mt-0.5"><Icons.Info /></div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-3 font-medium leading-relaxed">
                                                        Your vocabulary progress is currently saved only on this device. Enable cloud sync to access your data from anywhere.
                                                    </p>
                                                    <button
                                                        onClick={handleSyncToCloud}
                                                        disabled={loading}
                                                        className="inline-flex items-center gap-2 py-2 px-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity text-xs uppercase tracking-wider shadow-sm"
                                                    >
                                                        {loading ? 'Syncing...' : <><Icons.Upload /> Sync Progress to Cloud</>}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="relative flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                                </span>
                                                <span className="text-xs font-semibold text-foreground">Sync Active</span>
                                            </div>
                                            <button
                                                onClick={handleSyncToCloud}
                                                disabled={loading}
                                                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                            >
                                                {loading ? 'Syncing...' : <><Icons.Check /> Force Sync</>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Data Backup */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                                    <Icons.Database /> Data Management
                                </h3>

                                {/* Export Options */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1">Export Backups</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    setLoading(true);
                                                    const data = await authService.exportAllData();
                                                    const blob = new Blob([data], { type: 'application/json' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `ssat_backup_${currentUser}_${new Date().toISOString().split('T')[0]}.json`;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                    showMessage('success', 'Backup exported successfully!');
                                                } catch (e) {
                                                    showMessage('error', 'Export failed');
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                            disabled={loading}
                                            className="group flex flex-col items-center justify-center gap-2 p-4 bg-card hover:bg-muted text-foreground rounded-xl transition-all border border-border shadow-xs disabled:opacity-50"
                                        >
                                            <div className="p-2.5 bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary rounded-full transition-colors">
                                                <Icons.Download />
                                            </div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider">My Data</span>
                                        </button>

                                        <button
                                            onClick={async () => {
                                                try {
                                                    setLoading(true);
                                                    const data = await authService.exportFullDatabase();
                                                    const blob = new Blob([data], { type: 'application/json' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `ssat_full_database_${new Date().toISOString().split('T')[0]}.json`;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                    showMessage('success', 'Full database exported!');
                                                } catch (e) {
                                                    showMessage('error', 'Database export failed');
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                            disabled={loading}
                                            className="group flex flex-col items-center justify-center gap-2 p-4 bg-card hover:bg-muted text-foreground rounded-xl transition-all border border-border shadow-xs disabled:opacity-50"
                                        >
                                            <div className="p-2.5 bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary rounded-full transition-colors">
                                                <Icons.Database />
                                            </div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider">Full DB</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Import Personal Words */}
                                <div className="space-y-2 pt-2">
                                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1">Custom Vocabulary</p>
                                    <button
                                        onClick={() => {
                                            onClose();
                                            onShowImport();
                                        }}
                                        className="w-full group flex flex-col items-center justify-center gap-2 p-4 bg-card hover:bg-muted text-foreground rounded-xl transition-all border border-border shadow-xs"
                                    >
                                        <div className="p-2.5 bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary rounded-full transition-colors">
                                            <Icons.Plus className="w-4 h-4" />
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider">Import New Vocabulary</div>
                                            <div className="text-[10px] text-muted-foreground font-mono">Add words via document, file, or paste</div>
                                        </div>
                                    </button>
                                </div>

                                {/* Import Options */}
                                <div className="space-y-2 pt-2">
                                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1">Restore Data</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="group flex flex-col items-center justify-center gap-2 p-4 bg-card hover:bg-muted text-foreground rounded-xl transition-all border border-border shadow-xs cursor-pointer">
                                            <div className="p-2.5 bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary rounded-full transition-colors">
                                                <Icons.Upload />
                                            </div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider">Import</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept=".json"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    setLoading(true);
                                                    const reader = new FileReader();
                                                    reader.onload = async (re) => {
                                                        try {
                                                            const content = re.target?.result as string;
                                                            const result = await authService.importAllData(content);
                                                            if (result.success) {
                                                                showMessage('success', result.message);
                                                                setTimeout(() => window.location.reload(), 1500);
                                                            } else {
                                                                showMessage('error', result.message);
                                                            }
                                                        } finally {
                                                            setLoading(false);
                                                        }
                                                    };
                                                    reader.onerror = () => {
                                                        showMessage('error', 'Failed to read file');
                                                        setLoading(false);
                                                    };
                                                    reader.readAsText(file);
                                                }}
                                            />
                                        </label>

                                        <label className="group flex flex-col items-center justify-center gap-2 p-4 bg-card hover:bg-muted text-foreground rounded-xl transition-all border border-border shadow-xs cursor-pointer">
                                            <div className="p-2.5 bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary rounded-full transition-colors">
                                                <Icons.Wrench />
                                            </div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider">Merge</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept=".json"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    setLoading(true);
                                                    const reader = new FileReader();
                                                    reader.onload = async (re) => {
                                                        try {
                                                            const content = re.target?.result as string;
                                                            const result = await authService.importAllData(content, { merge: true });
                                                            if (result.success) {
                                                                showMessage('success', 'Data merged! ' + result.message);
                                                                setTimeout(() => window.location.reload(), 1500);
                                                            } else {
                                                                showMessage('error', result.message);
                                                            }
                                                        } finally {
                                                            setLoading(false);
                                                        }
                                                    };
                                                    reader.onerror = () => {
                                                        showMessage('error', 'Failed to read file');
                                                        setLoading(false);
                                                    };
                                                    reader.readAsText(file);
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Full DB Restore (hidden by default, shown when needed) */}
                                <details className="group pt-2">
                                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 px-1 list-none flex items-center gap-2">
                                        <div className="p-1 bg-gray-100 rounded">
                                            <Icons.Settings />
                                        </div>
                                        <span>Advanced Restore Options</span>
                                    </summary>
                                    <div className="mt-3 p-4 bg-red-50 rounded-xl border border-red-100">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="text-red-500 mt-0.5"><Icons.Alert /></div>
                                            <p className="text-xs text-red-700 font-medium">
                                                Warning: This action restores the entire database and overwrites all user data. Proceed with caution.
                                            </p>
                                        </div>
                                        {!showFullRestoreConfirm ? (
                                            <button
                                                onClick={() => setShowFullRestoreConfirm(true)}
                                                className="w-full flex items-center justify-center gap-2 p-3 bg-white text-red-600 rounded-lg hover:bg-red-50 hover:shadow-md transition-all border border-red-200 text-xs font-bold uppercase tracking-wide shadow-sm"
                                            >
                                                <Icons.Database /> Restore Full Database
                                            </button>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-[10px] text-red-800 font-black text-center uppercase">Confirm Full DB Restore?</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setShowFullRestoreConfirm(false)}
                                                        className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold uppercase"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <label className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer text-[10px] font-bold uppercase shadow-md animate-pulse">
                                                        RESTORE
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept=".json"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (!file) return;
                                                                setLoading(true);
                                                                const reader = new FileReader();
                                                                reader.onload = async (re) => {
                                                                    try {
                                                                        const content = re.target?.result as string;
                                                                        const result = await authService.importFullDatabase(content);
                                                                        if (result.success) {
                                                                            showMessage('success', result.message);
                                                                            setTimeout(() => window.location.reload(), 1500);
                                                                        } else {
                                                                            showMessage('error', result.message);
                                                                        }
                                                                    } finally {
                                                                        setLoading(false);
                                                                        setShowFullRestoreConfirm(false);
                                                                    }
                                                                };
                                                                reader.onerror = () => {
                                                                    showMessage('error', 'Failed to read file');
                                                                    setLoading(false);
                                                                    setShowFullRestoreConfirm(false);
                                                                };
                                                                reader.readAsText(file);
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 border-t border-border mt-4">
                                {showResetConfirm ? (
                                    <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/30 mb-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <p className="text-xs text-destructive font-semibold text-center uppercase tracking-widest mb-3">Reset all progress?</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowResetConfirm(false)}
                                                className="flex-1 py-3 bg-card border border-border text-foreground font-semibold rounded-lg text-xs uppercase"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleResetData}
                                                className="flex-1 py-3 bg-destructive text-destructive-foreground font-semibold rounded-lg text-xs uppercase shadow-xs"
                                            >
                                                Confirm
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowResetConfirm(true)}
                                        className="w-full mb-3 py-3 px-4 bg-card border border-destructive/20 text-destructive font-semibold rounded-xl hover:bg-destructive/10 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                                    >
                                        <Icons.Trash /> Reset All Progress
                                    </button>
                                )}
                                <button
                                    onClick={onLogout}
                                    className="w-full py-3.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] shadow-xs uppercase tracking-[0.2em] text-xs"
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Account Tab */}
                    {activeTab === 'account' && (
                        <div className="space-y-6">
                            {/* Change Username */}
                            <form onSubmit={handleChangeUsername} className="space-y-3">
                                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                                    <Icons.User /> Change Username
                                </h3>
                                <input
                                    type="text"
                                    placeholder="New username"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="w-full border border-input rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-background text-foreground"
                                />
                                <input
                                    type="password"
                                    placeholder="Current password"
                                    value={usernamePassword}
                                    onChange={(e) => setUsernamePassword(e.target.value)}
                                    className="w-full border border-input rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-background text-foreground"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !newUsername || !usernamePassword}
                                    className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold py-3 rounded-lg transition-colors shadow-xs text-xs uppercase tracking-wider"
                                >
                                    {loading ? 'Updating...' : 'Update Username'}
                                </button>
                            </form>

                            <div className="border-t border-border" />

                            {/* Change Password */}
                            <form onSubmit={handleChangePassword} className="space-y-3">
                                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                                    <Icons.Wrench /> Change Password
                                </h3>
                                <input
                                    type="password"
                                    placeholder="Current password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="w-full border border-input rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-background text-foreground"
                                />
                                <input
                                    type="password"
                                    placeholder="New password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full border border-input rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-background text-foreground"
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    className="w-full border border-input rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring bg-background text-foreground"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !oldPassword || !newPassword || !confirmNewPassword}
                                    className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold py-3 rounded-lg transition-colors shadow-xs text-xs uppercase tracking-wider"
                                >
                                    {loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
