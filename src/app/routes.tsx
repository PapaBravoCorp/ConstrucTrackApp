import { createBrowserRouter } from "react-router";
import { AppShell } from "./components/AppShell";
import { RoleGuard } from "./components/RoleGuard";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { ProjectList as AdminProjectList } from "./pages/admin/ProjectList";
import { CreateProject } from "./pages/admin/CreateProject";
import { EditProject } from "./pages/admin/EditProject";
import { TemplatesLibrary } from "./pages/admin/Templates";
import { UserManagement } from "./pages/admin/UserManagement";
import { ActivityLog } from "./pages/admin/ActivityLog";
import { ManagerDashboard } from "./pages/manager/Dashboard";
import { ManagerProjectDetail } from "./pages/manager/ProjectDetail";
import { AgentDashboard } from "./pages/agent/Dashboard";
import { AgentProjectDetail } from "./pages/agent/ProjectDetail";
import { UpdateProgress } from "./pages/agent/UpdateProgress";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Login,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
  {
    path: "/admin",
    element: (
      <RoleGuard allowedRole="Admin">
        <AppShell />
      </RoleGuard>
    ),
    children: [
      { index: true, Component: AdminDashboard },
      { path: "projects", Component: AdminProjectList },
      { path: "projects/new", Component: CreateProject },
      { path: "projects/:id/edit", Component: EditProject },
      { path: "templates", Component: TemplatesLibrary },
      { path: "users", Component: UserManagement },
      { path: "activity", Component: ActivityLog },
    ],
  },
  {
    path: "/manager",
    element: (
      <RoleGuard allowedRole="Manager">
        <AppShell />
      </RoleGuard>
    ),
    children: [
      { index: true, Component: ManagerDashboard },
      { path: "projects/:id", Component: ManagerProjectDetail },
    ],
  },
  {
    path: "/agent",
    element: (
      <RoleGuard allowedRole="Agent">
        <AppShell />
      </RoleGuard>
    ),
    children: [
      { index: true, Component: AgentDashboard },
      { path: "projects/:id", Component: AgentProjectDetail },
      { path: "projects/:id/update/:milestoneId", Component: UpdateProgress },
    ],
  }
]);
