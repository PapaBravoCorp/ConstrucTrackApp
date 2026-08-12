import React from 'react';
import { HardHat, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

/**
 * BrandedLoader — A dark-themed loading screen displayed during auth resolution.
 * Bridges the visual gap between the dark login page and the light app.
 */
export function BrandedLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg mb-6">
          <HardHat className="w-8 h-8 text-white" />
        </div>

        {/* Brand name */}
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Construc<span className="text-orange-400">Track</span>
        </h1>

        {/* Loading text + spinner */}
        <div className="flex items-center gap-2 mt-4 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
          <span className="text-sm font-medium">Loading your workspace…</span>
        </div>

        {/* Shimmer bar */}
        <div className="mt-6 w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            style={{ width: '40%' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
