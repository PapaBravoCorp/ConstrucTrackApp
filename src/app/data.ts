/**
 * Data types and legacy compatibility layer.
 *
 * All types are now defined in api.ts — this file re-exports them
 * for backward compatibility and provides any conversion helpers.
 */

// Re-export all types from api.ts
export type {
  Role,
  Profile,
  ProjectStatus,
  Project,
  ProjectDetail,
  Milestone,
  MilestoneUpdate,
  MilestoneWithUpdates,
  Template,
  Notification,
  ActivityLogEntry,
} from './api';

// Re-export API functions
export {
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  fetchMilestones,
  submitProgressUpdate,
  fetchUsers,
  fetchUsersByRole,
  createUser,
  updateUser as updateUserProfile,
  deactivateUser,
  fetchTemplates,
  fetchTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchActivityLog,
  uploadSitePhoto,
  requestPasswordReset,
} from './api';

// Legacy User type for auth context
export type User = {
  id: string;
  name: string;
  role: 'Admin' | 'Manager' | 'Agent';
  avatar?: string;
};
