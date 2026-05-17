import { getServiceClient } from "../middleware/auth.ts";
import { emitDomainEvent } from "./domainEvents.ts";

export type EnforcementMode = 'STRICT' | 'WARNING_ONLY' | 'DISABLED';

export interface DependencyValidationResult {
  allowed: boolean;
  warning?: string;
}

/**
 * Validates dependencies before allowing a milestone to transition to 'In Progress'.
 */
export async function validateDependencies(
  organizationId: string,
  projectId: string,
  milestoneId: string,
  userId: string
): Promise<DependencyValidationResult> {
  const supabase = getServiceClient();

  // 1. Get org enforcement mode
  const { data: org } = await supabase
    .from('organizations')
    .select('dependency_enforcement_mode')
    .eq('id', organizationId)
    .single();

  const mode: EnforcementMode = (org?.dependency_enforcement_mode as EnforcementMode) || 'WARNING_ONLY';

  if (mode === 'DISABLED') {
    return { allowed: true };
  }

  // 2. Fetch uncompleted dependencies
  const { data: deps, error } = await supabase
    .from('milestone_dependencies')
    .select(`
      depends_on_milestone_id,
      milestone:milestones!depends_on_milestone_id(name, status)
    `)
    .eq('organization_id', organizationId)
    .eq('milestone_id', milestoneId);

  if (error || !deps || deps.length === 0) {
    return { allowed: true };
  }

  const uncompleted = deps.filter((d: any) => d.milestone?.status !== 'Completed');

  if (uncompleted.length === 0) {
    return { allowed: true };
  }

  // 3. Handle violations
  const missingNames = uncompleted.map((d: any) => d.milestone?.name).join(', ');
  const message = `Dependency violation: The following required milestones are not completed: ${missingNames}`;

  if (mode === 'STRICT') {
    await emitDomainEvent('MilestoneDependencyViolated', {
      organizationId,
      projectId,
      milestoneId,
      userId,
      message
    });
    return { allowed: false, warning: message };
  }

  if (mode === 'WARNING_ONLY') {
    await emitDomainEvent('MilestoneDependencyViolated', {
      organizationId,
      projectId,
      milestoneId,
      userId,
      message: `[WARNING] ${message}`
    });
    return { allowed: true, warning: message };
  }

  return { allowed: true };
}
