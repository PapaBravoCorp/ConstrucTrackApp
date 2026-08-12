import React from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
  onAction?: () => void;
}

/**
 * EmptyState — A reusable component for zero-data screens.
 * Shows an icon, title, description, and optional CTA button.
 */
export function EmptyState({ icon, title, description, actionLabel, actionLink, onAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm"
    >
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto">{description}</p>
      {actionLabel && actionLink && (
        <Link
          to={actionLink}
          className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionLink && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
