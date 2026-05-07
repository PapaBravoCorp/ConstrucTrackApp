import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './auth';
import { ProjectProvider } from './projectsContext';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </ProjectProvider>
    </AuthProvider>
  );
}
