import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth';
import { Shield, Briefcase, HardHat, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info.tsx';

export function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Admin' | 'Manager' | 'Agent'>('Agent');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user && !authLoading) {
      navigate(`/${user.role.toLowerCase()}`);
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      const userRole = data.user.user_metadata.role || 'Agent';
      toast.success('Login successful');
      navigate(`/${userRole.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Call our edge function to sign up and confirm user automatically
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-9bb778f6/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ email, password, name, role })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }

      toast.success('Account created successfully! You can now log in.');
      setIsLoginMode(true);
      
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (r: string) => {
    switch (r) {
      case 'Admin': return <Shield className="w-5 h-5" />;
      case 'Manager': return <Briefcase className="w-5 h-5" />;
      case 'Agent': return <HardHat className="w-5 h-5" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
            C
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          ConstructTrack
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isLoginMode ? 'Sign in to your account' : 'Create a new account'}
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={isLoginMode ? handleLogin : handleSignup}>
            {!isLoginMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <div className="mt-1">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 text-slate-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 text-slate-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 text-slate-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            {!isLoginMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {(['Admin', 'Manager', 'Agent'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex flex-col items-center justify-center py-3 px-2 border rounded-md shadow-sm text-xs font-medium transition-colors ${
                        role === r 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {getRoleIcon(r)}
                      <span className="mt-1">{r}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLoginMode ? 'Sign In' : 'Sign Up')}
              </button>
            </div>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {isLoginMode ? 'New to ConstructTrack?' : 'Already have an account?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {isLoginMode ? 'Create an account' : 'Sign in instead'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
