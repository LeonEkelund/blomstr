import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { useAuth } from "@/components/auth-provider"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { BoardPage } from "@/routes/board"
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
        <Route path="/" element={<Navigate to="/projects" replace />} />
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
        <Route path="/home" element={<PlaceholderPage title="Home" />} />
        <Route path="/calendar" element={<PlaceholderPage title="Calendar" />} />
        <Route path="/tasks" element={<PlaceholderPage title="My Tasks" />} />
        <Route path="/team" element={<PlaceholderPage title="Team" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="/integrations" element={<PlaceholderPage title="Integrations" />} />
        <Route path="*" element={<PlaceholderPage title="Not found" />} />
      </Route>
    </Routes>
  )
}
