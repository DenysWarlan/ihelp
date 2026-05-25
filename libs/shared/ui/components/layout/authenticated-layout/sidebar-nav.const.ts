import { SidebarNavItem } from './sidebar-nav.model';

export const SIDEBAR_NAV_ITEMS: readonly SidebarNavItem[] = [
  // Person
  { label: 'person.cabinet', icon: 'LayoutDashboard', route: '/person', roles: ['person'] },
  { label: 'person.courses', icon: 'BookOpen', route: '/person/courses', roles: ['person'] },
  { label: 'person.chat', icon: 'MessageCircle', route: '/person/chat', roles: ['person'] },

  // Consultant
  { label: 'staff.consultant', icon: 'Briefcase', route: '/staff/consultant', roles: ['consultant'] },

  // Supervisor
  { label: 'staff.supervisor', icon: 'ClipboardList', route: '/staff/supervisor', roles: ['supervisor'] },

  // Coordinator
  { label: 'staff.coordinator', icon: 'BarChart3', route: '/staff/coordinator', roles: ['coordinator'] },

  // Admin
  { label: 'staff.admin', icon: 'Settings', route: '/staff/admin', roles: ['admin'] },
] as const;
