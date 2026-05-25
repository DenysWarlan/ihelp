import { SidebarNavItem } from './sidebar-nav.model';

export const SIDEBAR_NAV_ITEMS: readonly SidebarNavItem[] = [
  // Person
  { label: 'nav.cabinet', icon: 'LayoutDashboard', route: '/person', roles: ['person'] },
  { label: 'nav.courses', icon: 'BookOpen', route: '/person/courses', roles: ['person'] },
  { label: 'nav.chat', icon: 'MessageCircle', route: '/person/chat', roles: ['person'] },
  { label: 'nav.meetings', icon: 'Calendar', route: '/person/meetings', roles: ['person'] },
  { label: 'nav.profile', icon: 'User', route: '/person/profile', roles: ['person'] },

  // Consultant
  { label: 'nav.dashboard', icon: 'LayoutDashboard', route: '/staff', roles: ['consultant'] },
  { label: 'nav.cases', icon: 'FolderOpen', route: '/staff/cases', roles: ['consultant'] },
  { label: 'nav.chat', icon: 'MessageCircle', route: '/staff/chat', roles: ['consultant'] },
  { label: 'nav.meetings', icon: 'Calendar', route: '/staff/meetings', roles: ['consultant'] },
  { label: 'nav.courses', icon: 'BookOpen', route: '/staff/courses', roles: ['consultant'] },

  // Supervisor
  { label: 'nav.dashboard', icon: 'LayoutDashboard', route: '/staff', roles: ['supervisor'] },
  { label: 'nav.team', icon: 'Users', route: '/staff/team', roles: ['supervisor'] },
  { label: 'nav.cases', icon: 'FolderOpen', route: '/staff/cases', roles: ['supervisor'] },
  { label: 'nav.analytics', icon: 'BarChart3', route: '/staff/analytics', roles: ['supervisor'] },
  { label: 'nav.meetings', icon: 'Calendar', route: '/staff/meetings', roles: ['supervisor'] },

  // Coordinator
  { label: 'nav.dashboard', icon: 'LayoutDashboard', route: '/staff', roles: ['coordinator'] },
  { label: 'nav.sla', icon: 'Timer', route: '/staff/sla', roles: ['coordinator'] },
  { label: 'nav.assignment', icon: 'UserCheck', route: '/staff/assignment', roles: ['coordinator'] },
  { label: 'nav.workload', icon: 'Activity', route: '/staff/workload', roles: ['coordinator'] },
  { label: 'nav.cases', icon: 'FolderOpen', route: '/staff/cases', roles: ['coordinator'] },
  { label: 'nav.crisis', icon: 'AlertTriangle', route: '/staff/crisis', roles: ['coordinator'] },

  // Admin
  { label: 'nav.dashboard', icon: 'LayoutDashboard', route: '/staff', roles: ['admin'] },
  { label: 'nav.users', icon: 'Users', route: '/staff/users', roles: ['admin'] },
  { label: 'nav.courseMgmt', icon: 'BookOpen', route: '/staff/courses', roles: ['admin'] },
  { label: 'nav.settings', icon: 'Settings', route: '/staff/settings', roles: ['admin'] },
  { label: 'nav.analytics', icon: 'BarChart3', route: '/staff/analytics', roles: ['admin'] },
  { label: 'nav.auditLog', icon: 'FileText', route: '/staff/audit', roles: ['admin'] },
  { label: 'nav.gdpr', icon: 'Shield', route: '/staff/gdpr', roles: ['admin'] },
] as const;
