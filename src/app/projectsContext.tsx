import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Project, fetchProjects, saveProjects } from './data';
import { useAuth } from './auth';
import { supabase } from './supabaseClient';

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  updateProject: (updatedProject: Project) => Promise<void>;
  addProject: (newProject: Project) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (authLoading) return;
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const data = await fetchProjects(session?.access_token);
        setProjects(data);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading]);

  const updateProject = async (updatedProject: Project) => {
    const newProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    setProjects(newProjects);
    const { data: { session } } = await supabase.auth.getSession();
    await saveProjects(newProjects, session?.access_token);
  };

  const addProject = async (newProject: Project) => {
    const newProjects = [...projects, newProject];
    setProjects(newProjects);
    const { data: { session } } = await supabase.auth.getSession();
    await saveProjects(newProjects, session?.access_token);
  };

  return (
    <ProjectContext.Provider value={{ projects, loading, updateProject, addProject }}>
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
