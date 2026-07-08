// useProjects.ts — hook in its own file so Vite Fast Refresh works correctly.
// Fast Refresh requires that a file exports ONLY components OR ONLY hooks/values,
// not a mix. Since projectsContext.tsx exports ProjectProvider (component) + useProjects (hook),
// we re-export useProjects from here so page files can import from this file instead.
export { useProjects } from './projectsContext';
