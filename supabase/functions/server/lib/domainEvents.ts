import { getServiceClient } from "../middleware/auth.ts";

export type DomainEventType = 
  | 'MilestoneSubmittedForReview'
  | 'MilestoneApproved'
  | 'MilestoneRejected'
  | 'MilestoneReopened'
  | 'MilestoneBlocked'
  | 'MilestoneArchived'
  | 'MilestoneDependencyViolated'
  | 'SlaBreached';

export interface DomainEventPayload {
  organizationId: string;
  projectId: string;
  milestoneId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  message: string;
}

/**
 * Emits a lightweight, synchronous domain event.
 * Currently, it logs activity to `milestone_activity` and handles basic alerting logic.
 * Avoid introducing message queues (Kafka, etc.) per Enterprise Constraints.
 */
export async function emitDomainEvent(eventType: DomainEventType, payload: DomainEventPayload) {
  const supabase = getServiceClient();

  // Map DomainEventType to Activity Type
  let activityType = 'SYSTEM_EVENT';
  if (['MilestoneApproved', 'MilestoneRejected', 'MilestoneReopened'].includes(eventType)) {
    activityType = eventType.replace('Milestone', '').toUpperCase(); // 'APPROVED', 'REJECTED', 'REOPENED'
  } else if (eventType === 'MilestoneSubmittedForReview' || eventType === 'MilestoneBlocked') {
    activityType = 'STATUS_CHANGE';
  } else if (eventType === 'MilestoneArchived') {
    activityType = 'MILESTONE_ARCHIVED';
  } else if (eventType === 'MilestoneDependencyViolated') {
    activityType = 'DEPENDENCY_VIOLATED';
  } else if (eventType === 'SlaBreached') {
    activityType = 'SLA_BREACHED';
  }

  // 1. Log to milestone_activity
  if (payload.milestoneId) {
    const { error: actError } = await supabase.from('milestone_activity').insert({
      organization_id: payload.organizationId,
      project_id: payload.projectId,
      milestone_id: payload.milestoneId,
      user_id: payload.userId || null,
      activity_type: activityType,
      message: payload.message,
      metadata: payload.metadata || {}
    });

    if (actError) {
      console.error(`Failed to log domain event ${eventType} to activity:`, actError.message);
    }
  }

  // 2. Generate Notification if necessary (SlaBreached, Blocked, etc.)
  if (eventType === 'SlaBreached' || eventType === 'MilestoneDependencyViolated') {
    // Notify the Project Manager
    const { data: project } = await supabase
      .from('projects')
      .select('manager_id')
      .eq('id', payload.projectId)
      .single();

    if (project?.manager_id) {
      await supabase.from('notifications').insert({
        organization_id: payload.organizationId,
        user_id: project.manager_id,
        title: eventType === 'SlaBreached' ? 'SLA Breach Detected' : 'Dependency Violation',
        body: payload.message,
        type: 'system',
        reference_id: payload.milestoneId || payload.projectId
      });
    }
  }
}
