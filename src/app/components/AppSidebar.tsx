import React from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../auth';
import {
  LayoutDashboard,
  FolderKanban,
  LayoutTemplate,
  Users,
  ClipboardList,
  HardHat,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from './ui/sidebar';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Projects', path: '/admin/projects', icon: FolderKanban },
  { label: 'Templates', path: '/admin/templates', icon: LayoutTemplate },
  { label: 'Users & Roles', path: '/admin/users', icon: Users },
  { label: 'Activity Log', path: '/admin/activity', icon: ClipboardList },
];

const MANAGER_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/manager', icon: LayoutDashboard },
];

const AGENT_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/agent', icon: LayoutDashboard },
];

function getNavItems(role: string): NavItem[] {
  switch (role) {
    case 'Admin': return ADMIN_NAV;
    case 'Manager': return MANAGER_NAV;
    case 'Agent': return AGENT_NAV;
    default: return [];
  }
}

export function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location, isMobile, setOpenMobile]);

  if (!user) return null;

  const navItems = getNavItems(user.role);

  /**
   * Determine if a nav item is "active":
   * - For root paths (e.g. /admin), match exactly.
   * - For sub-paths (e.g. /admin/projects), match prefix so that
   *   /admin/projects/new also highlights the "Projects" item.
   */
  const isActive = (path: string): boolean => {
    const current = location.pathname;
    // Exact match for root role paths
    if (path === '/admin' || path === '/manager' || path === '/agent') {
      return current === path;
    }
    // Prefix match for sub-paths
    return current.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      {/* Sidebar Header — Brand */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-sm shrink-0">
            <HardHat className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm text-slate-900 tracking-tight truncate">
            Construc<span className="text-orange-500">Track</span>
          </span>
        </div>
      </SidebarHeader>

      {/* Sidebar Content — Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                    onClick={() => setOpenMobile(false)}
                  >
                    <Link to={item.path}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer — User info summary */}
      <SidebarFooter>
        <div className="flex items-center gap-2 px-1 py-1">
          <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-xs shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0 truncate">
            <p className="text-xs font-semibold text-gray-900 truncate">{user.name}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{user.role}</p>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
