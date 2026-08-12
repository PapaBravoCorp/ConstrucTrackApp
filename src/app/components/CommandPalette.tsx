import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth';
import {
  LayoutDashboard, Building, LayoutTemplate, Users, History,
  LogOut, Search, HelpCircle, CircleUserRound,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './ui/command';
import { supabase } from '../supabaseClient';

interface CommandAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  shortcut?: string;
  keywords?: string;
}

/**
 * CommandPalette — Ctrl+K / ⌘+K quick navigation.
 * Shows role-specific navigation items, plus global actions.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─── Keyboard shortcut: Ctrl+K / ⌘+K ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate],
  );

  const handleSignOut = useCallback(async () => {
    setOpen(false);
    await supabase.auth.signOut();
    navigate('/login');
  }, [navigate]);

  if (!user) return null;

  // ─── Build role-specific nav items ─────────────────────────
  const rolePrefix = `/${user.role.toLowerCase()}`;

  const navItems: CommandAction[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      onSelect: () => go(rolePrefix),
      keywords: 'home overview main',
    },
  ];

  if (user.role === 'Admin') {
    navItems.push(
      {
        id: 'projects',
        label: 'Projects',
        icon: <Building className="w-4 h-4" />,
        onSelect: () => go('/admin/projects'),
        keywords: 'sites construction',
      },
      {
        id: 'templates',
        label: 'Templates',
        icon: <LayoutTemplate className="w-4 h-4" />,
        onSelect: () => go('/admin/templates'),
        keywords: 'milestones phases',
      },
      {
        id: 'users',
        label: 'Users & Roles',
        icon: <Users className="w-4 h-4" />,
        onSelect: () => go('/admin/users'),
        keywords: 'team members invite access',
      },
      {
        id: 'activity',
        label: 'Activity Log',
        icon: <History className="w-4 h-4" />,
        onSelect: () => go('/admin/activity'),
        keywords: 'audit trail history',
      },
    );
  }

  const globalActions: CommandAction[] = [
    {
      id: 'profile',
      label: 'My Profile',
      icon: <CircleUserRound className="w-4 h-4" />,
      onSelect: () => { setOpen(false); },
      keywords: 'account settings',
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: <HelpCircle className="w-4 h-4" />,
      onSelect: () => { setOpen(false); },
      keywords: 'docs documentation faq',
    },
    {
      id: 'signout',
      label: 'Sign Out',
      icon: <LogOut className="w-4 h-4" />,
      onSelect: handleSignOut,
      shortcut: '',
      keywords: 'logout exit',
    },
  ];

  return (
    <>
      {/* Trigger button visible in the header area (optional — the shortcut is the main entry) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        aria-label="Open command palette"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="font-medium">Search…</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-white text-gray-400 border border-gray-200 rounded shadow-sm">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-1 py-4">
              <Search className="w-6 h-6 text-gray-300" />
              <p className="text-sm text-gray-500">No results found</p>
            </div>
          </CommandEmpty>

          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={item.onSelect}
                keywords={item.keywords ? [item.keywords] : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            {globalActions.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={item.onSelect}
                keywords={item.keywords ? [item.keywords] : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
