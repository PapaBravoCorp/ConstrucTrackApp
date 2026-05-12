import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { fetchProjects as apiFetchProjects, updateProject as apiUpdateProject, deleteProject as apiDeleteProject } from './api';
import { useAuth } from './auth';
import type { Project } from './api';

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
  updateProject: (id: string, data: any) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetchProjects();
      setProjects(data);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshProjects();
    } else {
      setProjects([]);
      setLoading(false);
    }
  }, [user, refreshProjects]);

  const updateProject = async (id: string, data: any) => {
    await apiUpdateProject(id, data);
    await refreshProjects();
  };

  const deleteProject = async (id: string) => {
    await apiDeleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  return (
    <ProjectContext.Provider value={{ projects, loading, error, refreshProjects, updateProject, deleteProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}
