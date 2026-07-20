import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hybridService } from '../services/hybridService';
import { cloudService } from '../services/cloudService';
import { authService } from '../authService';
import { Icons } from './Icons';

interface LoginPageProps {
    onLoginSuccess: (username: string) => void;
    initialMode?: 'login' | 'signup';
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, initialMode = 'login' }) => {
    const navigate = useNavigate();
    const [authTab, setAuthTab] = useState<'social' | 'local'>('social');
    const [isLogin, setIsLogin] = useState(initialMode === 'login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Auto-clear error after 15 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 15000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    useEffect(() => {
        setIsLogin(initialMode === 'login');
        setError('');
    }, [initialMode]);

    const handleSocialLogin = async (provider: 'google' | 'github') => {
        setError('');
        setLoading(true);
        try {
            const res = await cloudService.signInWithOAuth(provider);
            if (!res.success) {
                setError(res.message);
                setLoading(false);
            }
            // Supabase handles OAuth redirection automatically
        } catch {
            setError('Social login failed. Please ensure Supabase keys are configured in your Vercel project.');
            setLoading(false);
        }
    };

    const handleLocalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            hybridService.setStorageMode('local');

            if (isLogin) {
                const res = await authService.login(username, password);
                if (res.success && res.user) {
                    onLoginSuccess(res.user.username);
                } else {
                    setError(res.message || 'Local login failed. Invalid username or password.');
                }
            } else {
                if (password !== confirmPassword) {
                    setError('Passwords do not match.');
                    setLoading(false);
                    return;
                }

                const res = await authService.register(username, password);
                if (res.success && res.user) {
                    onLoginSuccess(res.user);
                } else {
                    setError(res.message || 'Registration failed.');
                }
            }
        } catch {
            setError('An unexpected error occurred during local sign in.');
        } finally {
            setLoading(false);
        }
    };

    const isCloudConfigured = hybridService.isCloudAvailable();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 font-sans relative">
            <div className="w-full max-w-[380px]">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        SAT & SSAT Vocab
                    </h1>
                    <p className="text-muted-foreground text-xs mt-1 font-medium">
                        Master vocabulary with intelligent study tools
                    </p>
                </div>

                {/* Form Container */}
                <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                    {/* Tab Navigation */}
                    <div className="flex bg-muted p-1 rounded-lg mb-6">
                        <button
                            type="button"
                            onClick={() => { setAuthTab('social'); setError(''); }}
                            className={`flex-1 py-1.5 text-[11px] font-semibold tracking-wide rounded-md transition-all ${
                                authTab === 'social' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Cloud Account
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAuthTab('local'); setError(''); }}
                            className={`flex-1 py-1.5 text-[11px] font-semibold tracking-wide rounded-md transition-all ${
                                authTab === 'local' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Local Device
                        </button>
                    </div>

                    {authTab === 'social' ? (
                        <div className="space-y-4">
                            <div className="text-center mb-2">
                                <p className="text-xs font-semibold text-foreground">Cloud Sync Account</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Sync your vocabulary progress across all your devices seamlessly.
                                </p>
                            </div>

                            {!isCloudConfigured && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-[11px] font-medium leading-relaxed">
                                    <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                                        <Icons.Info className="w-3.5 h-3.5 text-amber-600" />
                                        Supabase Keys Required for Cloud Sync
                                    </div>
                                    To use Cloud Sync, please add your Supabase URL & Key in Vercel settings, or switch to <strong>Local Device</strong> tab below.
                                </div>
                            )}

                            <div className="space-y-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => handleSocialLogin('google')}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-3 py-2.5 border border-border rounded-lg hover:bg-muted transition-all text-sm font-semibold text-foreground active:scale-[0.98] disabled:opacity-50"
                                >
                                    <Icons.Google className="w-4 h-4" /> Continue with Google
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSocialLogin('github')}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-3 py-2.5 border border-border rounded-lg hover:bg-muted transition-all text-sm font-semibold text-foreground active:scale-[0.98] disabled:opacity-50"
                                >
                                    <Icons.GitHub className="w-4 h-4" /> Continue with GitHub
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
                                <Icons.Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <p className="text-[11px] leading-relaxed text-blue-800 font-medium">
                                    <strong className="block text-blue-900 mb-0.5">Private Device Account</strong>
                                    Saved 100% on this browser. Zero cloud dependencies.
                                </p>
                            </div>

                            <form onSubmit={handleLocalSubmit} className="space-y-3">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-1">
                                        {isLogin ? 'Username' : 'Pick Username'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-background border border-input rounded-lg py-2 px-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all text-sm font-medium"
                                        placeholder="Enter username"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-1">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-background border border-input rounded-lg py-2 px-3 pr-10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all text-sm font-medium"
                                            placeholder="Enter password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                                        >
                                            {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                                        </button>
                                    </div>
                                </div>

                                {!isLogin && (
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-1">
                                            Confirm Password
                                        </label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-background border border-input rounded-lg py-2 px-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all text-sm font-medium"
                                            placeholder="Re-enter password"
                                        />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-lg transition-all text-xs uppercase tracking-wider shadow-sm mt-1"
                                >
                                    {loading ? 'Processing...' : (isLogin ? 'Sign In Locally' : 'Create Local Account')}
                                </button>

                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                                        className="text-xs text-primary hover:underline font-medium"
                                    >
                                        {isLogin ? "Need a local account? Sign up" : "Already have a local account? Sign in"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg p-3 font-medium">
                            <Icons.Alert className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="relative flex items-center gap-4 my-5">
                        <div className="flex-1 h-px bg-border"></div>
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-[0.2em]">or</span>
                        <div className="flex-1 h-px bg-border"></div>
                    </div>

                    {/* Guest Login */}
                    <button
                        type="button"
                        onClick={() => {
                            const res = hybridService.loginGuest();
                            if (res.success && res.username) {
                                onLoginSuccess(res.username);
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-all text-xs font-semibold text-secondary-foreground"
                    >
                        <Icons.User className="w-3.5 h-3.5" /> Continue as Guest
                    </button>
                </div>

                <p className="mt-6 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {authTab === 'social' ? (isCloudConfigured ? 'Supabase Sync Available' : 'Cloud Config Required') : 'Device Storage Mode'}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
