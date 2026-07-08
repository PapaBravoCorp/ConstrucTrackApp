import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, X, Building, Users, AlertTriangle, Settings } from 'lucide-react';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import type { Notification } from '../api';
import { useAuth } from '../auth';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─── Position the portal dropdown anchored to the bell button ───────────────
  const updatePosition = useCallback(() => {
    if (!bellButtonRef.current) return;
    const rect = bellButtonRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      // Align right edge of dropdown to right edge of bell button
      right: window.innerWidth - rect.right,
      // Responsive width: full width on small screens, capped on larger ones
      width: Math.min(384, window.innerWidth - 16),
    });
  }, []);

  // Reposition on open, scroll, and resize
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  // ─── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // ─── Close on Escape ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // ─── Load notifications ───────────────────────────────────────────────────────
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const result = await fetchNotifications();
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (notif.reference_id && user) {
      const rolePrefix = user.role === 'Admin' ? '/admin' : user.role === 'Manager' ? '/manager' : '/agent';
      setOpen(false);
      navigate(`${rolePrefix}/projects/${notif.reference_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'update':     return <Building       className="w-4 h-4 text-blue-500" />;
      case 'assignment': return <Users          className="w-4 h-4 text-green-500" />;
      case 'delay':      return <AlertTriangle  className="w-4 h-4 text-orange-500" />;
      case 'system':     return <Settings       className="w-4 h-4 text-gray-500" />;
      default:           return <Bell           className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1)  return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // ─── The dropdown rendered into document.body via a Portal ──────────────────
  const dropdown = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          style={dropdownStyle}
          // z-[200] is safe here because this element is in the root stacking
          // context (document.body), not trapped inside the sticky header.
          className="z-[200] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden origin-top-right"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Notification list — max-height ~70vh, scrolls independently */}
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-50">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${
                    !notif.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getTypeIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!notif.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />
                      )}
                    </div>
                    {notif.body && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{formatTime(notif.created_at)}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-12 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications yet</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Bell trigger button — stays in the header DOM as normal */}
      <button
        ref={bellButtonRef}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Open notifications"
        aria-expanded={open}
        aria-haspopup="true"
        className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown portal — rendered directly into document.body */}
      {createPortal(dropdown, document.body)}
    </>
  );
}
