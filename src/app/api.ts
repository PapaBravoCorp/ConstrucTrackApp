/**
 * Centralized API client for ConstrucTrack.
 * Handles auth headers, base URL, and typed request/response.
 */
import { supabase } from './supabaseClient';
import { projectId } from '../../utils/supabase/info';

// const API_BASE = `http://localhost:8000/server/api`;
const API_BASE = `https://${projectId}.supabase.co/functions/v1/server/api`;

// ─── Helpers ─────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  const json = await res.json();

  if (!res.ok) {
    // Handle expired or invalid tokens by logging out
    const isUnauthorized = res.status === 401 || 
                           json.error?.toLowerCase().includes('expired') || 
                           json.error?.toLowerCase().includes('invalid token');

    if (isUnauthorized && window.location.pathname !== '/') {
      console.warn('Session expired or invalid, logging out...');
      supabase.auth.signOut().then(() => {
        window.location.href = '/';
      });
    }
    throw new Error(json.error || `API error: ${res.status}`);
  }

  return json;
}

// ─── Projects ────────────────────────────────────────────

export async function fetchProjects() {
  const result = await apiRequest<{ data: Project[] }>('/projects');
  return result.data;
}

export async function fetchProject(id: string) {
  const result = await apiRequest<{ data: ProjectDetail }>(`/projects/${id}`);
  return result.data;
}

export async function createProject(data: CreateProjectPayload) {
  const result = await apiRequest<{ data: any }>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateProject(id: string, data: UpdateProjectPayload) {
  const result = await apiRequest<{ data: any }>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function deleteProject(id: string) {
  await apiRequest<{ success: boolean }>(`/projects/${id}`, {
    method: 'DELETE',
  });
}

// ─── Milestones ──────────────────────────────────────────

export async function fetchMilestones(projectId: string) {
  const result = await apiRequest<{ data: MilestoneWithUpdates[] }>(`/milestones/${projectId}`);
  return result.data;
}

export async function submitProgressUpdate(milestoneId: string, data: ProgressUpdatePayload) {
  const result = await apiRequest<{ data: any }>(`/milestones/${milestoneId}/update`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateMilestoneStatus(milestoneId: string, status: string) {
  const result = await apiRequest<{ data: any; warning?: string }>(`/milestones/${milestoneId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return result;
}

// ─── Users ───────────────────────────────────────────────

export async function fetchUsers() {
  const result = await apiRequest<{ data: Profile[] }>('/users');
  return result.data;
}

export async function fetchUsersByRole(role: string) {
  const result = await apiRequest<{ data: Profile[] }>(`/users/by-role/${role}`);
  return result.data;
}

export async function createUser(data: CreateUserPayload) {
  const result = await apiRequest<{ data: any }>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateUser(id: string, data: UpdateUserPayload) {
  const result = await apiRequest<{ data: Profile }>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function deleteUser(id: string) {
  const result = await apiRequest<{ success: boolean }>(`/users/${id}`, {
    method: 'DELETE',
  });
  return result;
}

// ─── Templates ───────────────────────────────────────────

export async function fetchTemplates() {
  const result = await apiRequest<{ data: Template[] }>('/templates');
  return result.data;
}

export async function fetchTemplate(id: string) {
  const result = await apiRequest<{ data: Template }>(`/templates/${id}`);
  return result.data;
}

export async function createTemplate(data: CreateTemplatePayload) {
  const result = await apiRequest<{ data: Template }>('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateTemplate(id: string, data: UpdateTemplatePayload) {
  const result = await apiRequest<{ data: Template }>(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function deleteTemplate(id: string) {
  await apiRequest<{ success: boolean }>(`/templates/${id}`, {
    method: 'DELETE',
  });
}

// ─── Notifications ───────────────────────────────────────

export async function fetchNotifications() {
  const result = await apiRequest<{ data: Notification[]; unreadCount: number }>('/notifications');
  return result;
}

export async function markNotificationRead(id: string) {
  await apiRequest<{ success: boolean }>(`/notifications/${id}/read`, {
    method: 'PUT',
  });
}

export async function markAllNotificationsRead() {
  await apiRequest<{ success: boolean }>('/notifications/read-all', {
    method: 'PUT',
  });
}

// ─── Activity Log ────────────────────────────────────────

export async function fetchActivityLog(params?: { limit?: number; offset?: number; entityType?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  if (params?.entityType) searchParams.set('entityType', params.entityType);

  const query = searchParams.toString();
  const result = await apiRequest<{ data: ActivityLogEntry[]; total: number }>(
    `/activity${query ? `?${query}` : ''}`
  );
  return result;
}

// ─── File Upload ─────────────────────────────────────────

export async function uploadSitePhoto(file: File, projectId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${projectId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('site-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('site-photos')
    .getPublicUrl(data.path);

  return publicUrl;
}

// ─── Password Reset (public, no auth required) ──────────

export async function requestPasswordReset(email: string) {
  // Use the same base as API_BASE but replace /api with /auth
  const base = API_BASE.replace(/\/api$/, '/auth');
  
  const res = await fetch(`${base}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to send reset email');
  return json;
}

// ─── Types ───────────────────────────────────────────────

export type Role = 'Admin' | 'Manager' | 'Agent';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = 'On Track' | 'Delayed' | 'Completed';

export interface Project {
  id: string;
  name: string;
  address: string;
  type: 'Residential' | 'Commercial';
  start_date: string;
  end_date: string;
  client: string;
  status: ProjectStatus;
  percent_done: number;
  manager_id: string | null;
  template_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  manager: Profile | null;
  agents: { agent_id: string; profile: Profile }[];
  milestones: Milestone[];
}

export interface ProjectDetail extends Project {
  milestones: MilestoneWithUpdates[];
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  weight: number;
  percent_done: number;
  sort_order: number;
  status?: string;          // Milestone workflow status
  schedule_status?: string; // Derived operational schedule status
  start_date?: string;
  due_date?: string;
  last_update: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface MilestoneUpdate {
  id: string;
  milestone_id: string;
  agent_id: string;
  percent_done: number;
  note: string | null;
  photo_urls: string[];
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  agent: { id: string; name: string };
}

export interface MilestoneWithUpdates extends Milestone {
  updates: MilestoneUpdate[];
}

export interface Template {
  id: string;
  name: string;
  project_type: 'Residential' | 'Commercial';
  phases: { name: string; weight: number }[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: { id: string; name: string } | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: 'update' | 'assignment' | 'delay' | 'system';
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: 'project' | 'milestone' | 'user' | 'template';
  entity_id: string | null;
  details: any;
  created_at: string;
  user: { id: string; name: string; role: string };
}

// ─── Payload Types ───────────────────────────────────────

export interface CreateProjectPayload {
  name: string;
  address: string;
  type: 'Residential' | 'Commercial';
  startDate: string;
  endDate: string;
  client: string;
  managerId?: string;
  agentIds?: string[];
  milestones?: { name: string; weight: number }[];
  templateId?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  address?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  client?: string;
  status?: ProjectStatus;
  managerId?: string;
  agentIds?: string[];
  percentDone?: number;
}

export interface ProgressUpdatePayload {
  percentDone: number;
  note?: string;
  photoUrls?: string[];
  latitude?: number;
  longitude?: number;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: Role;
}

export interface UpdateUserPayload {
  name?: string;
  role?: Role;
  isActive?: boolean;
}

export interface CreateTemplatePayload {
  name: string;
  projectType: 'Residential' | 'Commercial';
  phases: { name: string; weight: number }[];
}

export interface UpdateTemplatePayload {
  name?: string;
  projectType?: 'Residential' | 'Commercial';
  phases?: { name: string; weight: number }[];
}
