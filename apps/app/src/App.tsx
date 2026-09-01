import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { useAuth } from "@/components/auth-provider"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useWorkspace } from "@/hooks/use-workspace"
import { BoardPage } from "@/routes/board"
import { HomePage } from "@/routes/home"
import { InvitePage } from "@/routes/invite"
import { OnboardingPage } from "@/routes/onboarding"
import { PlaceholderPage } from "@/routes/placeholder"
import { ProjectLayout } from "@/routes/project/project-layout"
import {
  FilesTab,
  MindmapTab,
  NotesTab,
  OverviewTab,
  PublishTab,
  RepurposedTab,
  ReviewTab,
} from "@/routes/project/tabs"
import { SignInPage } from "@/routes/sign-in"
import { TasksPage } from "@/routes/tasks"
import { TeamPage } from "@/routes/team"
import { WorkspacePage } from "@/routes/workspace"

/**
 * Everything inside the app shell requires a session.
 *
 * Renders nothing while the session is still resolving — redirecting during
 * that window would bounce a signed-in user to /sign-in on every refresh.
 */
function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

/**
 * The app shell, which every screen except onboarding needs a workspace for —
 * queries are scoped by workspace id, so there is nothing to render without
 * one.
 *
 * A signed-in user with no workspace is a normal state, not an error: it is
 * every new signup, and eventually every guest who arrives through an invite
 * before it has been redeemed.
 */
function AppShell() {
  const { workspace, loading } = useWorkspace()

  if (loading) return null
  if (!workspace) return <Navigate to="/onboarding" replace />

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex min-w-0 flex-col overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        {/* Outside the shell: redeeming happens before you belong anywhere. */}
        <Route path="/invite/:token" element={<InvitePage />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/projects" element={<BoardPage />} />
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OverviewTab />} />
            <Route path="notes" element={<NotesTab />} />
            <Route path="files" element={<FilesTab />} />
            <Route path="repurposed" element={<RepurposedTab />} />
            <Route path="mindmap" element={<MindmapTab />} />
            <Route path="review" element={<ReviewTab />} />
            <Route path="publish" element={<PublishTab />} />
          </Route>
          <Route path="/home" element={<HomePage />} />
          <Route path="/calendar" element={<PlaceholderPage title="Calendar" />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/settings" element={<PlaceholderPage title="Account" />} />
          <Route
            path="/integrations"
            element={<PlaceholderPage title="Integrations" />}
          />
          <Route path="*" element={<PlaceholderPage title="Not found" />} />
        </Route>
      </Route>
    </Routes>
  )
}
