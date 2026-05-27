/**
 * Shared test data constants used across E2E specs.
 * Keep values deterministic so assertions are stable.
 */

export const TEST_USERS = {
  person: {
    name: 'Test Person',
    email: 'person@test.ihelp.org',
    role: 'person' as const,
  },
  consultant: {
    name: 'Test Consultant',
    email: 'consultant@test.ihelp.org',
    role: 'consultant' as const,
  },
  supervisor: {
    name: 'Test Supervisor',
    email: 'supervisor@test.ihelp.org',
    role: 'supervisor' as const,
  },
  coordinator: {
    name: 'Test Coordinator',
    email: 'coordinator@test.ihelp.org',
    role: 'coordinator' as const,
  },
  admin: {
    name: 'Test Admin',
    email: 'admin@test.ihelp.org',
    role: 'admin' as const,
  },
} as const;

export const TEST_CASE = {
  topic: 'Психологічна підтримка',
  urgency: 'medium' as const,
  country: 'Україна',
  language: 'uk',
  description: 'Потребую консультацію з психологом щодо стресу та тривожності.',
} as const;

export const TEST_COURSE = {
  title: 'Основи самодопомоги',
  description: 'Курс з базових технік самодопомоги',
  difficulty: 'beginner' as const,
  language: 'uk',
  lessonCount: 5,
} as const;

export const TEST_MEETING = {
  duration: 60,
  platform: 'zoom' as const,
  topic: 'Консультація',
} as const;

export const TEST_CHAT_MESSAGE = {
  text: 'Привіт, потребую допомоги з моїм запитом.',
} as const;

/** Route paths used across test suites. */
export const ROUTES = {
  // Public zone
  home: '/',
  catalog: '/catalog',
  needHelp: '/need-help',
  login: '/login',
  authCallback: '/auth/callback',

  // Person zone
  personHome: '/person',
  personCourses: '/person/courses',
  personChat: '/person/chat',
  personMeetings: '/person/meetings',
  personProfile: '/person/profile',

  // Staff zone
  staffLogin: '/staff/login',
  staffDashboard: '/staff',
  staffCases: '/staff/cases',
  staffChat: '/staff/chat',
  staffMeetings: '/staff/meetings',
  staffCourses: '/staff/courses',
  staffTeam: '/staff/team',
  staffAnalytics: '/staff/analytics',
  staffSla: '/staff/sla',
  staffAssignment: '/staff/assignment',
  staffWorkload: '/staff/workload',
  staffCrisis: '/staff/crisis',
  staffUsers: '/staff/users',
  staffSettings: '/staff/settings',
  staffAudit: '/staff/audit',
  staffGdpr: '/staff/gdpr',

  // Supervisor zone
  supervisorDashboard: '/staff/supervisor',
  supervisorCases: '/staff/supervisor/cases',
  supervisorCrisis: '/staff/supervisor/crisis',

  // Coordinator & Admin
  coordinatorDashboard: '/staff/coordinator',
  adminDashboard: '/staff/admin',
} as const;
