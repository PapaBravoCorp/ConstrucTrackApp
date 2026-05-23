export type MilestoneStatus = 
  | 'Pending'
  | 'In Progress'
  | 'Under Review'
  | 'Completed'
  | 'Reopened'
  | 'Rejected'
  | 'Blocked'
  | 'Cancelled'
  | 'Archived';

// Explicit allowed transitions as defined in the Enterprise Design
const allowedTransitions: Record<MilestoneStatus, MilestoneStatus[]> = {
  'Pending': ['In Progress'],
  'In Progress': ['Under Review', 'Blocked'],
  'Under Review': ['Completed', 'Rejected', 'Blocked'],
  'Rejected': ['In Progress'],
  'Completed': ['Reopened', 'Archived'],
  'Reopened': ['Blocked'], // Assuming Reopened can be Blocked, or perhaps go to In Progress? The prompt says: "Reopened -> Blocked"
  'Blocked': ['In Progress', 'Cancelled'],
  'Cancelled': [],
  'Archived': []
};

/**
 * Validates if a state transition is permitted.
 * @param currentState The current status of the milestone
 * @param nextState The requested new status
 * @returns true if valid, false otherwise
 */
export function isValidTransition(currentState: MilestoneStatus, nextState: MilestoneStatus): boolean {
  // If the state is not changing, it's not a transition (e.g. updating fields but not status)
  if (currentState === nextState) {
    return true;
  }
  
  const allowed = allowedTransitions[currentState];
  if (!allowed) {
    return false;
  }
  
  return allowed.includes(nextState);
}

/**
 * Throws an error if the transition is invalid. Can be used directly in API routes.
 */
export function assertValidTransition(currentState: MilestoneStatus, nextState: MilestoneStatus) {
  if (!isValidTransition(currentState, nextState)) {
    throw new Error(`Invalid state transition from ${currentState} to ${nextState}`);
  }
}
