import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import { X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Role-specific descriptions shown in the welcome modal.
 */
const ROLE_CAPABILITIES: Record<string, string[]> = {
  Admin: [
    'Create and manage construction projects',
    'Set up milestone templates for consistent tracking',
    'Invite Managers and Site Agents to your organization',
  ],
  Manager: [
    'Monitor project progress across all your assigned sites',
    'Review and approve milestone updates from Site Agents',
    'Get alerts for delays, stalls, and pending approvals',
  ],
  Agent: [
    'Submit progress updates with photos and GPS data',
    'Track your assigned milestones and due dates',
    'Respond to manager feedback and rework requests',
  ],
};

/**
 * WelcomeModal — shown on first login only (tracked via localStorage).
 * Displays the user's name, role, and role-specific capabilities.
 */
export function WelcomeModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const storageKey = `constructrack_welcome_seen_${user.id}`;
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        // Delay slightly so the dashboard renders first
        const timer = setTimeout(() => setIsOpen(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage blocked — silently skip
    }
  }, [user]);

  const handleDismiss = () => {
    setIsOpen(false);
    if (user) {
      try {
        localStorage.setItem(`constructrack_welcome_seen_${user.id}`, 'true');
      } catch {
        // localStorage blocked — silently skip
      }
    }
  };

  if (!user) return null;

  const capabilities = ROLE_CAPABILITIES[user.role] || ROLE_CAPABILITIES.Agent;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleDismiss}
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 text-white relative">
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close welcome dialog"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 id="welcome-title" className="text-xl font-bold">
                    Welcome, {user.name.split(' ')[0]}!
                  </h2>
                  <p className="text-sm text-slate-300 font-medium">
                    You're signed in as <span className="text-orange-400 font-bold">{user.role}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Here's what you can do:
              </p>
              <ul className="space-y-2.5">
                {capabilities.map((cap, idx) => (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + idx * 0.1 }}
                    className="flex items-start gap-2.5 text-sm text-gray-700"
                  >
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{cap}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={handleDismiss}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors active:scale-[0.98] shadow-sm"
              >
                Got it, let's go!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
