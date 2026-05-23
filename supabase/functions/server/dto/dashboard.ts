export interface ManagerDashboardProject {
  id: string;
  title: string;
  completionPercent: number;
  overdueMilestones: number;
  pendingApprovals: number;
  latestActivityAt: string | null;
}

export interface DashboardResponse {
  items: ManagerDashboardProject[];
  nextCursor?: string;
  totalCount: number;
}
