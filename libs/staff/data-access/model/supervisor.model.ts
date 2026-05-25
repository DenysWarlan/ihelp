export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly activeCases: number;
  readonly resolvedThisMonth: number;
  readonly avgResponseHours: number;
}

export interface TeamAnalytics {
  readonly totalCasesThisMonth: number;
  readonly resolvedCases: number;
  readonly avgResolutionDays: number;
  readonly satisfactionScore: number;
  readonly teamMembers: TeamMember[];
}
