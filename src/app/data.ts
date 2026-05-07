export type Role = 'Admin' | 'Manager' | 'Agent';

export type User = {
  id: string;
  name: string;
  role: Role;
  avatar?: string;
};

export type ProjectStatus = 'On Track' | 'Delayed' | 'Completed';

export type Milestone = {
  id: string;
  name: string;
  percentDone: number;
  weight: number;
  lastUpdate: string;
  thumbnail?: string;
  history: {
    date: string;
    percentDone: number;
    agentName: string;
    note?: string;
    thumbnail?: string;
  }[];
};

export type Project = {
  id: string;
  name: string;
  address: string;
  type: 'Residential' | 'Commercial';
  startDate: string;
  endDate: string;
  client: string;
  status: ProjectStatus;
  percentDone: number;
  managerId: string;
  agentIds: string[];
  milestones: Milestone[];
};

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Sunset Heights Villa',
    address: '123 Coastal Drive, Malibu',
    type: 'Residential',
    startDate: '2026-01-10',
    endDate: '2026-12-20',
    client: 'Stark Industries',
    status: 'On Track',
    percentDone: 45,
    managerId: 'u2',
    agentIds: ['u3'],
    milestones: [
      {
        id: 'm1',
        name: 'Mobilisation & Site Prep',
        percentDone: 100,
        weight: 5,
        lastUpdate: '2026-02-01',
        history: [{ date: '2026-02-01', percentDone: 100, agentName: 'Charlie Agent', note: 'Site cleared.' }]
      },
      {
        id: 'm2',
        name: 'Foundation & Substructure',
        percentDone: 100,
        weight: 15,
        lastUpdate: '2026-03-15',
        history: [{ date: '2026-03-15', percentDone: 100, agentName: 'Charlie Agent', note: 'Concrete poured.' }]
      },
      {
        id: 'm3',
        name: 'Superstructure (Framing)',
        percentDone: 60,
        weight: 30,
        lastUpdate: '2026-05-01',
        thumbnail: 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80',
        history: [
          { date: '2026-04-15', percentDone: 30, agentName: 'Charlie Agent', note: 'First floor framed.' },
          { date: '2026-05-01', percentDone: 60, agentName: 'Charlie Agent', note: 'Second floor framing ongoing.', thumbnail: 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80' }
        ]
      },
      {
        id: 'm4',
        name: 'Roofing & Windows',
        percentDone: 0,
        weight: 15,
        lastUpdate: '',
        history: []
      },
      {
        id: 'm5',
        name: 'MEP (Mechanical, Electrical, Plumbing)',
        percentDone: 0,
        weight: 20,
        lastUpdate: '',
        history: []
      },
      {
        id: 'm6',
        name: 'Finishing & Handover',
        percentDone: 0,
        weight: 15,
        lastUpdate: '',
        history: []
      }
    ]
  },
  {
    id: 'p2',
    name: 'Downtown Office Complex',
    address: '450 City Center Blvd',
    type: 'Commercial',
    startDate: '2025-06-01',
    endDate: '2026-11-30',
    client: 'Wayne Enterprises',
    status: 'Delayed',
    percentDone: 72,
    managerId: 'u2',
    agentIds: ['u3', 'u4'],
    milestones: [
      {
        id: 'm1',
        name: 'Foundation',
        percentDone: 100,
        weight: 20,
        lastUpdate: '2025-08-01',
        history: []
      },
      {
        id: 'm2',
        name: 'Structure',
        percentDone: 100,
        weight: 40,
        lastUpdate: '2026-01-20',
        history: []
      },
      {
        id: 'm3',
        name: 'Facade',
        percentDone: 80,
        weight: 20,
        lastUpdate: '2026-04-10',
        thumbnail: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&q=80',
        history: [{ date: '2026-04-10', percentDone: 80, agentName: 'Dave Agent', thumbnail: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&q=80' }]
      },
      {
        id: 'm4',
        name: 'Interior Fit-out',
        percentDone: 10,
        weight: 20,
        lastUpdate: '2026-05-02',
        history: [{ date: '2026-05-02', percentDone: 10, agentName: 'Dave Agent' }]
      }
    ]
  }
];

import { projectId } from '/utils/supabase/info.tsx';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-9bb778f6`;

export const fetchProjects = async (): Promise<Project[]> => {
  try {
    const res = await fetch(`${API_BASE}/kv/projects`);
    const data = await res.json();
    if (data.value) {
      return data.value;
    } else {
      // Initialize with mock data if empty
      await saveProjects(MOCK_PROJECTS);
      return MOCK_PROJECTS;
    }
  } catch (err) {
    console.error("Error fetching projects:", err);
    return MOCK_PROJECTS;
  }
};

export const saveProjects = async (projects: Project[]) => {
  try {
    await fetch(`${API_BASE}/kv/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: projects })
    });
  } catch (err) {
    console.error("Error saving projects:", err);
  }
};

export const getProjectsForUser = (user: User, projects: Project[]) => {
  if (user.role === 'Admin') return projects;
  if (user.role === 'Manager') return projects.filter(p => p.managerId === user.id);
  // Agents might not have strict ID matches if they just use the mock user flow vs Supabase Auth flow
  // For simplicity, agents can see all projects or we can do a better match later
  if (user.role === 'Agent') return projects; 
  return [];
};
