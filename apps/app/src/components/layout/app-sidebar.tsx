import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  CalendarDays,
  CircleCheck,
  Handshake,
  House,
  Lightbulb,
  Plug,
  Settings,
  SquareKanban,
  Users,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Listed but not built yet — shown disabled so the shape of the product reads. */
  soon?: boolean
}

const primaryNav: NavItem[] = [
  { to: "/home", label: "Home", icon: House },
  { to: "/projects", label: "Projects", icon: SquareKanban },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/tasks", label: "My Tasks", icon: CircleCheck },
  { to: "/ideas", label: "Ideas", icon: Lightbulb },
  { to: "/team", label: "Team", icon: Users },
  { to: "/sponsors", label: "Sponsors", icon: Handshake, soon: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, soon: true },
]

const secondaryNav: NavItem[] = [
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/settings", label: "Settings", icon: Settings },
]

function NavRows({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon

        if (item.soon) {
          return (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton disabled tooltip={`${item.label} — coming soon`}>
                <Icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>Soon</SidebarMenuBadge>
            </SidebarMenuItem>
          )
        }

        return (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              isActive={pathname.startsWith(item.to)}
              tooltip={item.label}
              render={<Link to={item.to} />}
            >
              <Icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      {/* h-14 + border-b so this rule lines up exactly with the page header's. */}
      <SidebarHeader className="h-14 flex-row items-center gap-2 border-b px-3 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <div className="size-6 shrink-0 rounded-md bg-foreground" />
        <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          blomstr
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavRows items={primaryNav} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavRows items={secondaryNav} pathname={pathname} />
      </SidebarFooter>
    </Sidebar>
  )
}
