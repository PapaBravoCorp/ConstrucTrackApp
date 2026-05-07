import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Project, fetchProjects, saveProjects } from './data';

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  updateProject: (updatedProject: Project) => Promise<void>;
  addProject: (newProject: Project) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects().then(data => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  const updateProject = async (updatedProject: Project) => {
    const newProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    setProjects(newProjects);
    await saveProjects(newProjects);
  };

  const addProject = async (newProject: Project) => {
    const newProjects = [...projects, newProject];
    setProjects(newProjects);
    await saveProjects(newProjects);
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
