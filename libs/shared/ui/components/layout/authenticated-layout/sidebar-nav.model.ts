export interface SidebarNavItem {
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  readonly roles: readonly string[];
}

export type UserRole = 'person' | 'consultant' | 'supervisor' | 'coordinator' | 'admin';
