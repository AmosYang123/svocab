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
    const [isLogin, setIsLogin] = useState(initialMode === 'login');
    const [emailOrUser, setEmailOrUser] = useState('');
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
            setError('Social sign-in failed. Please verify provider settings in your Supabase dashboard.');
            setLoading(false);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const rawInput = emailOrUser.trim().toLowerCase();
        if (!rawInput) {
            setError('Please enter an email address or username.');
            setLoading(false);
            return;
        }

        const isCloudAvailable = cloudService.isConfigured();

        try {
            if (isLogin) {
                // --- LOGIN ---
                let cloudRes: any = null;

                if (isCloudAvailable) {
                    hybridService.setStorageMode('hybrid');
                    if (rawInput.includes('@')) {
                        cloudRes = await cloudService.loginWithEmail(rawInput, password);
                    } else {
                        cloudRes = await cloudService.login(rawInput, password);
                    }
                }

                if (cloudRes && cloudRes.success && cloudRes.username) {
                    if (cloudRes.userId) {
                        hybridService.setCloudUserId(cloudRes.userId);
                    }
                    authService.setSession(cloudRes.username);
                    onLoginSuccess(cloudRes.username);
                    return;
                }

                // Local Device Account Fallback if Cloud Login failed or not available
                const localRes = await authService.login(rawInput.includes('@') ? rawInput.split('@')[0] : rawInput, password);
                if (localRes.success && localRes.user) {
                    hybridService.setStorageMode('local');
                    onLoginSuccess(localRes.user);
                } else {
                    setError(cloudRes?.message || localRes.message || 'Login failed. Invalid username/email or password.');
                }
            } else {
                // --- SIGN UP ---
                if (password !== confirmPassword) {
                    setError('Passwords do not match.');
                    setLoading(false);
                    return;
                }

                if (password.length < 4) {
                    setError('Password must be at least 4 characters long.');
                    setLoading(false);
                    return;
                }

                let cloudRes: any = null;
                if (isCloudAvailable) {
                    hybridService.setStorageMode('hybrid');
                    if (rawInput.includes('@')) {
                        cloudRes = await cloudService.registerWithEmail(rawInput, password);
                    } else {
                        cloudRes = await cloudService.register(rawInput, password);
                    }
                }

                // Register local account in IndexedDB too for seamless offline fallback
                const cleanUser = rawInput.includes('@') ? rawInput.split('@')[0] : rawInput;
                const localRes = await authService.register(cleanUser, password);

                if ((cloudRes && cloudRes.success && cloudRes.username) || (localRes && localRes.success && localRes.user)) {
                    const finalUsername = cloudRes?.username || localRes.user || cleanUser;
                    if (cloudRes?.userId) {
                        hybridService.setCloudUserId(cloudRes.userId);
                    }
                    authService.setSession(finalUsername);
                    onLoginSuccess(finalUsername);
                } else {
                    setError(cloudRes?.message || localRes.message || 'Registration failed.');
                }
            }
        } catch (err: any) {
            setError(err?.message || 'An unexpected error occurred during sign in.');
        } finally {
            setLoading(false);
        }
    };

    const isCloudConfigured = hybridService.isCloudAvailable();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 font-sans relative">
            <div className="w-full max-w-[380px]">
                {/* Header */}
                <div className="text-center mb-5">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        SAT & SSAT Vocab
                    </h1>
                    <p className="text-muted-foreground text-xs mt-1 font-medium">
                        Master vocabulary with intelligent study tools
                    </p>
                </div>

                {/* Main Single Card */}
                <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-5">
                    {/* Social Logins */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center mb-1">
                            OAuth Single Sign-On
                        </p>

                        <button
                            type="button"
                            onClick={() => handleSocialLogin('google')}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-2.5 border border-border rounded-lg hover:bg-muted transition-all text-xs font-semibold text-foreground active:scale-[0.98] disabled:opacity-50"
                        >
                            <Icons.Google className="w-4 h-4" /> Continue with Google
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSocialLogin('github')}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-2.5 border border-border rounded-lg hover:bg-muted transition-all text-xs font-semibold text-foreground active:scale-[0.98] disabled:opacity-50"
                        >
                            <Icons.GitHub className="w-4 h-4" /> Continue with GitHub
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="relative flex items-center gap-3">
                        <div className="flex-1 h-px bg-border"></div>
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">or email & password</span>
                        <div className="flex-1 h-px bg-border"></div>
                    </div>

                    {/* Email / Username Form */}
                    <form onSubmit={handleFormSubmit} className="space-y-3">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-1">
                                Email Address or Username
                            </label>
                            <input
                                type="text"
                                required
                                value={emailOrUser}
                                onChange={(e) => setEmailOrUser(e.target.value)}
                                className="w-full bg-background border border-input rounded-lg py-2 px-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all text-xs font-medium"
                                placeholder="name@example.com or username"
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
                                    className="w-full bg-background border border-input rounded-lg py-2 px-3 pr-10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all text-xs font-medium"
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
                                    className="w-full bg-background border border-input rounded-lg py-2 px-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all text-xs font-medium"
                                    placeholder="Confirm password"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-lg transition-all text-xs uppercase tracking-wider shadow-sm mt-1"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>

                        <div className="text-center pt-1">
                            <button
                                type="button"
                                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                                className="text-xs text-primary hover:underline font-medium"
                            >
                                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg p-3 font-medium">
                            <Icons.Alert className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="relative flex items-center gap-3">
                        <div className="flex-1 h-px bg-border"></div>
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">or guest</span>
                        <div className="flex-1 h-px bg-border"></div>
                    </div>

                    {/* Guest Access */}
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

                <p className="mt-5 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {isCloudConfigured ? 'Supabase Sync Available' : 'Local Storage Mode'}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
