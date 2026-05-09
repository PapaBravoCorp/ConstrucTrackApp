import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './auth';
import { ProjectProvider } from './projectsContext';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProjectProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" />
        </ProjectProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
