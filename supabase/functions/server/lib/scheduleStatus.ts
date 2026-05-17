import { MilestoneStatus } from './workflowTransitions.ts';

export type ScheduleStatus = 'ON_TRACK' | 'AT_RISK' | 'DELAYED';

/**
 * Computes the operational schedule status based on the workflow status and due date.
 * This is an authoritative server-side calculation.
 */
export function computeScheduleStatus(
  status: MilestoneStatus,
  dueDateStr: string | null
): ScheduleStatus {
  // Terminal or completed states are not considered delayed operationally anymore
  if (['Completed', 'Archived', 'Cancelled'].includes(status)) {
    return 'ON_TRACK';
  }

  if (!dueDateStr) {
    return 'ON_TRACK';
  }

  const dueDate = new Date(dueDateStr);
  const now = new Date();
  
  const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) {
    return 'DELAYED';
  } else if (diffHours <= 48) {
    // Within 48 hours of deadline is considered at risk
    return 'AT_RISK';
  }

  return 'ON_TRACK';
}
