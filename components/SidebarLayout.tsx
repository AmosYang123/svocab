import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, BookOpen, Settings, LogOut, Menu, X, ClipboardCheck, Sun, Moon, Flame, Plus, Sparkles, Layers } from 'lucide-react';
import { hybridService } from '../services/hybridService';
import { notificationService } from '../services/notificationService';
import { ThemeMode } from '../types';

interface SidebarLayoutProps {
    children: React.ReactNode;
    currentUser: string | null;
    theme: ThemeMode;
    onUpdateTheme: (theme: ThemeMode) => void;
    onLogout: () => void;
    onShowSettings: () => void;
}

export default function SidebarLayout({
    children,
    currentUser,
    theme,
    onUpdateTheme,
    onLogout,
    onShowSettings
}: SidebarLayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        loadStreak();
    }, [location.pathname]);

    const loadStreak = async () => {
        try {
            const progressList = await hybridService.getAllDailyProgress();
            const calculatedStreak = notificationService.calculateStreak(progressList);
            setStreak(calculatedStreak);
        } catch (e) {
            console.error("Failed to load sidebar streak", e);
        }
    };

    const mainMenuItems = [
        {
            path: '/',
            label: 'Dashboard',
            icon: LayoutDashboard
        },
        {
            path: '/daily',
            label: 'Daily Lesson',
            icon: Calendar,
            badge: true
        },
        {
            path: '/learn',
            label: 'Study Cards',
            icon: BookOpen
        },
        {
            path: '/mtest',
            label: 'Practice Test',
            icon: ClipboardCheck
        }
    ];

    const activeItem = mainMenuItems.find(item => {
        if (item.path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(item.path);
    });

    const toggleTheme = () => {
        onUpdateTheme(theme === 'light' ? 'dark' : 'light');
    };

    return (
        <div className="min-h-screen flex bg-background text-foreground font-sans transition-colors duration-200">
            {/* Mobile Top Navigation */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-border/80 flex items-center justify-between px-4 z-40 backdrop-blur-md">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2.5"
                >
                    <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded-lg shadow-sm">
                        <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold tracking-tight text-foreground">SAT & SSAT Vocab</span>
                </button>

                <div className="flex items-center gap-2">
                    {streak > 0 && (
                        <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-mono px-2.5 py-0.5 rounded-full">
                            <Flame className="w-3.5 h-3.5 fill-current" />
                            <span>{streak}d</span>
                        </div>
                    )}
                    <button
                        onClick={() => setIsMobileOpen(true)}
                        className="p-1.5 border border-border hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Desktop Left Sidebar (Flush with linen background, matches reference image) */}
            <aside className="hidden md:flex flex-col w-64 bg-background fixed top-0 bottom-0 left-0 z-30 px-4 py-5 select-none">
                {/* Brand Header */}
                <div className="flex items-center gap-2.5 px-2 mb-6">
                    <div className="w-7 h-7 bg-foreground text-background flex items-center justify-center rounded-lg shadow-sm">
                        <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold tracking-tight text-foreground">SAT & SSAT Vocab</span>
                </div>

                {/* Primary Action Button ("+ Quick Create" / "+ Daily Practice" style) */}
                <button
                    onClick={() => navigate('/daily')}
                    className="w-full mb-6 py-2.5 px-4 bg-primary text-primary-foreground text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Start Daily Practice</span>
                </button>

                {/* Main Menu Section */}
                <div className="mb-4">
                    <div className="px-2.5 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 font-semibold">
                        STUDY STUDIO
                    </div>
                    <nav className="space-y-1">
                        {mainMenuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeItem?.path === item.path;
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                                        isActive
                                            ? 'bg-secondary text-foreground font-semibold shadow-xs'
                                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <span>{item.label}</span>
                                    </div>
                                    {item.badge && !isActive && (
                                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Quick Utilities Section */}
                <div className="flex-1">
                    <div className="px-2.5 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 font-semibold">
                        UTILITIES
                    </div>
                    <div className="space-y-1">
                        <button
                            onClick={onShowSettings}
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-xl transition-all"
                        >
                            <Settings className="w-4 h-4 text-muted-foreground" />
                            <span>Settings & Sync</span>
                        </button>
                    </div>
                </div>

                {/* Sidebar Footer User Profile */}
                <div className="pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 bg-secondary border border-border flex items-center justify-center text-xs font-semibold text-foreground rounded-full shrink-0">
                                {currentUser?.slice(0, 2).toUpperCase() || 'GU'}
                            </div>
                            <div className="min-w-0">
                                <span className="block text-xs font-semibold text-foreground truncate leading-none mb-1">
                                    {currentUser || 'Guest User'}
                                </span>
                                {streak > 0 ? (
                                    <span className="text-[10px] text-primary font-mono flex items-center gap-1 leading-none">
                                        <Flame className="w-3 h-3 fill-current" /> {streak}d active streak
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground font-mono leading-none">
                                        Active learner
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={toggleTheme}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                title="Toggle Theme"
                            >
                                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={onLogout}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                title="Log Out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Navigation Drawer */}
            {isMobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <div
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
                        onClick={() => setIsMobileOpen(false)}
                    />
                    <div className="relative w-64 bg-background border-r border-border h-full flex flex-col z-10 p-4">
                        <div className="flex items-center justify-between pb-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded-lg">
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-semibold tracking-tight">SAT & SSAT Vocab</span>
                            </div>
                            <button
                                onClick={() => setIsMobileOpen(false)}
                                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <nav className="flex-1 py-4 space-y-1">
                            {mainMenuItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeItem?.path === item.path;
                                return (
                                    <button
                                        key={item.path}
                                        onClick={() => {
                                            navigate(item.path);
                                            setIsMobileOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-all ${
                                            isActive
                                                ? 'bg-secondary text-foreground font-semibold'
                                                : 'text-muted-foreground hover:bg-muted'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            )}

            {/* Main Elevated Content Panel (Pure white/off-white rounded card container matching reference image) */}
            <div className="flex-1 flex flex-col md:pl-64 pt-14 md:pt-0 min-h-screen">
                <main className="flex-1 p-3 md:p-5 flex flex-col">
                    <div className="flex-1 bg-card border border-border rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-xs flex flex-col">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
