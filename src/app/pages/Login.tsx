import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../auth';
import { Loader2, HardHat, ArrowLeft, ShieldCheck, Lock, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';

export function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (user && !authLoading) {
      navigate(`/${user.role.toLowerCase()}`);
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userRole = data.user.user_metadata.role || 'Agent';
      toast.success('Welcome back!');
      navigate(`/${userRole.toLowerCase()}`);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      toast.error(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Background glow blobs — same as landing hero */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
            <HardHat className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Construc<span className="text-orange-400">Track</span>
          </span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>

      {/* Card */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Card container */}
          <div className="bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-3xl px-8 py-10 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 items-center justify-center shadow-lg shadow-orange-500/30 mb-4">
                <HardHat className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Welcome back</h1>
              <p className="text-slate-400 text-sm mt-1">Sign in to your ConstrucTrack account</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/40 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                    Password
                  </label>
                  <Link
                    to="/reset-password"
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/40 transition-all"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400"
                >
                  {error}
                </motion.div>
              )}

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 disabled:opacity-60 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
              </button>
            </form>

            {/* Footer note */}
            <p className="mt-6 text-center text-xs text-slate-600">
              Don't have an account?{' '}
              <span className="text-slate-500">Contact your administrator to get access.</span>
            </p>
          </div>

          {/* Trust badges below card */}
          <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
            {[
              { icon: <ShieldCheck className="w-3.5 h-3.5 text-green-400" />, label: 'SOC 2 Secure' },
              { icon: <Lock className="w-3.5 h-3.5 text-blue-400" />, label: 'End-to-end encrypted' },
              { icon: <Globe className="w-3.5 h-3.5 text-purple-400" />, label: '99.9% Uptime' },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-1.5 text-slate-500 text-xs">
                {b.icon}
                {b.label}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
