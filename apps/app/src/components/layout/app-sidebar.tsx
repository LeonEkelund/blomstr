import { Logo } from "@blomstr/ui"
import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  CalendarDays,
  ChevronsUpDown,
  CircleCheck,
  CircleUser,
  Handshake,
  House,
  Lightbulb,
  LogOut,
  Plug,
  Settings,
  SquareKanban,
  Users,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { currentUser } from "@/lib/mock-data"

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

function NavUser() {
  const initials = currentUser.name.slice(0, 2).toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" tooltip={currentUser.name}>
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">{currentUser.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {currentUser.email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent side="top" align="end" className="w-56">
            {/* Base UI's Label is a *group* label — it throws unless wrapped. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="grid leading-tight">
                  <span className="text-sm font-medium text-foreground">
                    {currentUser.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currentUser.email}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <CircleUser />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      {/* h-14 + border-b so this rule lines up exactly with the page header's. */}
      {/*
        Constant px-3 in both states, deliberately: the collapsed rail is 48px
        and the mark is 24px, so 12px of padding centres it without needing
        `justify-center`. Centring instead would make the logo slide sideways
        during the width transition.
      */}
      <SidebarHeader className="h-14 flex-row items-center gap-2 border-b px-3 py-0">
        <Logo className="size-6 shrink-0" />
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
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
