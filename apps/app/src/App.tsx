import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { BoardPage } from "@/routes/board"
import { PlaceholderPage } from "@/routes/placeholder"

export function App() {
  return (
    <Routes>
      <Route
        element={
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex min-w-0 flex-col overflow-hidden">
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        }
      >
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<BoardPage />} />
        <Route path="/home" element={<PlaceholderPage title="Home" />} />
        <Route path="/calendar" element={<PlaceholderPage title="Calendar" />} />
        <Route path="/tasks" element={<PlaceholderPage title="My Tasks" />} />
        <Route path="/ideas" element={<PlaceholderPage title="Ideas" />} />
        <Route path="/team" element={<PlaceholderPage title="Team" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="/integrations" element={<PlaceholderPage title="Integrations" />} />
        <Route path="*" element={<PlaceholderPage title="Not found" />} />
      </Route>
    </Routes>
  )
}
