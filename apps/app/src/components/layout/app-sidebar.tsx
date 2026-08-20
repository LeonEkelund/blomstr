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
  LogOut,
  Monitor,
  Moon,
  Plug,
  Settings,
  SquareKanban,
  Sun,
  Users,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { type Theme, useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
  { to: "/team", label: "Team", icon: Users },
  { to: "/sponsors", label: "Sponsors", icon: Handshake, soon: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, soon: true },
]

// Settings lives in the account menu instead, so it isn't duplicated here.
const secondaryNav: NavItem[] = [
  { to: "/integrations", label: "Integrations", icon: Plug },
]

/**
 * Rows sit flush against each other so there is no dead zone between them —
 * a gap on the list would drop the pointer cursor and blink the highlight off
 * as you move down. The visual separation instead comes from a transparent
 * border plus `bg-clip-padding`, which stops the background painting under it.
 */
const navButton = [
  "h-9 border-y-2 border-transparent bg-clip-padding group-data-[collapsible=icon]:border-y-0",
  // Hover is a hint, active is state — so hover sits at half strength and the
  // current page stays the most prominent row even while pointing elsewhere.
  "hover:bg-sidebar-accent/50 data-active:hover:bg-sidebar-accent",
  "text-sidebar-foreground/70 hover:text-sidebar-foreground data-active:text-sidebar-foreground",
  // No weight change on active: it shifts the label by ~1px and reads as jitter
  // when navigating. Background and text opacity carry the state instead.
  "data-active:font-normal",
].join(" ")

function NavRows({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon

        if (item.soon) {
          return (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                disabled
                className={navButton}
                tooltip={`${item.label} — coming soon`}
              >
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
              className={navButton}
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

const themeOptions: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

function ThemeMenuGroup() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Theme
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme}
        onValueChange={(value) => setTheme(value as Theme)}
      >
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            <Icon />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
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
            <DropdownMenuItem render={<Link to="/settings" />}>
              <CircleUser />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/settings" />}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ThemeMenuGroup />
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
      {/*
        h-14 + border-b so this rule lines up exactly with the page header's.

        px-3 stays constant in both states, deliberately: the collapsed rail is
        48px and the mark is 24px, so 12px of padding centres it without needing
        `justify-center` — which would make the logo slide sideways during the
        width transition.
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
