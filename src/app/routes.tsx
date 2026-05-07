import { createBrowserRouter } from "react-router";
import { AppShell } from "./components/AppShell";
import { Login } from "./pages/Login";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { ProjectList as AdminProjectList } from "./pages/admin/ProjectList";
import { CreateProject } from "./pages/admin/CreateProject";
import { TemplatesLibrary } from "./pages/admin/Templates";
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
    path: "/admin",
    Component: AppShell,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "projects", Component: AdminProjectList },
      { path: "projects/new", Component: CreateProject },
      { path: "templates", Component: TemplatesLibrary },
    ],
  },
  {
    path: "/manager",
    Component: AppShell,
    children: [
      { index: true, Component: ManagerDashboard },
      { path: "projects/:id", Component: ManagerProjectDetail },
    ],
  },
  {
    path: "/agent",
    Component: AppShell,
    children: [
      { index: true, Component: AgentDashboard },
      { path: "projects/:id", Component: AgentProjectDetail },
      { path: "projects/:id/update/:milestoneId", Component: UpdateProgress },
    ],
  }
]);
