import React, { useState, useEffect, useRef } from 'react';

export type ReviewType = 'approve' | 'reject' | 'changes_requested' | 'rework_required' | 'blocked' | 'clarification_required';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string, category?: string) => Promise<void>;
  projectId: string;
  updateId: string; // Used for unique draft key
  reviewType: ReviewType;
  title: string;
}

export function ReviewModal({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  updateId,
  reviewType,
  title
}: ReviewModalProps) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const draftKey = `draft_${projectId}_${updateId}_${reviewType}`;

  // Focus Management & Accessibility
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Small timeout to ensure modal is rendered before focusing
      setTimeout(() => {
        const firstInput = modalRef.current?.querySelector('textarea, input, button') as HTMLElement;
        firstInput?.focus();
      }, 10);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Draft persistence
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = sessionStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const age = Date.now() - parsed.savedAt;
          if (age < 24 * 60 * 60 * 1000) {
            setText(parsed.text);
          } else {
            sessionStorage.removeItem(draftKey); // expired
          }
        }
      } catch (e) {
        // ignore parse error
      }
    }
  }, [isOpen, draftKey]);

  useEffect(() => {
    if (isOpen && text) {
      sessionStorage.setItem(draftKey, JSON.stringify({
        text,
        savedAt: Date.now()
      }));
    }
  }, [text, isOpen, draftKey]);

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const trimmedText = text.trim();
    if (reviewType !== 'approve' && trimmedText.length < 10) {
      setError('Please provide at least 10 characters for feedback.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await onSubmit(trimmedText, category);
      sessionStorage.removeItem(draftKey);
      setText('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showCategory = ['changes_requested', 'rework_required', 'blocked'].includes(reviewType);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 id="modal-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-800/50">
              {error}
            </div>
          )}
          
          {showCategory && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="">Select a category (optional)</option>
                <option value="Quality">Quality Control</option>
                <option value="Safety">Safety Violation</option>
                <option value="Incomplete">Incomplete Work</option>
                <option value="Documentation">Missing Documentation</option>
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {reviewType === 'approve' ? 'Approval Notes (Optional)' : 'Feedback / Reason (Required)'}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 h-32 resize-none"
              placeholder={reviewType === 'approve' ? 'Looks good...' : 'Please explain what needs to be fixed...'}
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2
              ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
