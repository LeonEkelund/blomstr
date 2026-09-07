import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, LogOut, Monitor, Moon, Sun } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { PageHeader } from "@/components/layout/page-header"
import { type Theme, useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface Profile {
  displayName: string
  avatarUrl: string | null
}

const themeOptions: {
  value: Theme
  label: string
  description: string
  icon: typeof Sun
}[] = [
  { value: "light", label: "Light", description: "Always light", icon: Sun },
  { value: "dark", label: "Dark", description: "Always dark", icon: Moon },
  {
    value: "system",
    label: "System",
    description: "Match your device",
    icon: Monitor,
  },
]

function SettingSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function AccountPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const userId = user?.id
  const fallbackName = user?.email?.split("@")[0] ?? ""
  const [name, setName] = useState("")
  const [saved, setSaved] = useState(false)

  const profileKey = ["profile", userId]
  const {
    data: profile,
    isPending: loadingProfile,
    error: profileError,
  } = useQuery({
    queryKey: profileKey,
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", userId ?? "")
        .single()
      if (error) throw error
      return {
        displayName: data.display_name ?? fallbackName,
        avatarUrl: data.avatar_url,
      }
    },
  })

  useEffect(() => {
    if (profile) setName(profile.displayName)
  }, [profile])

  const updateProfile = useMutation({
    mutationFn: async (displayName: string) => {
      if (!userId) throw new Error("Not signed in")
      const { data, error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId)
        .select("display_name, avatar_url")
        .single()
      if (error) throw error
      return {
        displayName: data.display_name ?? displayName,
        avatarUrl: data.avatar_url,
      } satisfies Profile
    },
    onSuccess: (nextProfile) => {
      queryClient.setQueryData(profileKey, nextProfile)
      queryClient.invalidateQueries({ queryKey: ["members"] })
      queryClient.invalidateQueries({ queryKey: ["activity"] })
      queryClient.invalidateQueries({ queryKey: ["home"] })
      setSaved(true)
    },
  })

  const logOut = useMutation({ mutationFn: signOut })
  const cleanName = name.trim()
  const canSave =
    Boolean(cleanName) && cleanName !== profile?.displayName && !updateProfile.isPending
  const initials = (profile?.displayName || fallbackName).slice(0, 2).toUpperCase()

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return
    updateProfile.mutate(cleanName)
  }

  return (
    <>
      <PageHeader title="Account" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl pb-8">
          <SettingSection
            title="Profile"
            description="The name your teammates see across blomstr."
          >
            <form
              className="rounded-xl border bg-card p-4 sm:p-5"
              onSubmit={submitProfile}
            >
              <div className="flex items-center gap-3 border-b pb-4">
                {loadingProfile ? (
                  <Skeleton className="size-11 rounded-full" />
                ) : (
                  <Avatar className="size-11">
                    {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {profile?.displayName || fallbackName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="account-display-name"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Display name
                  </label>
                  {loadingProfile ? (
                    <Skeleton className="h-8 w-full" />
                  ) : (
                    <Input
                      id="account-display-name"
                      value={name}
                      maxLength={80}
                      autoComplete="name"
                      disabled={updateProfile.isPending}
                      onChange={(event) => {
                        setName(event.target.value)
                        setSaved(false)
                      }}
                    />
                  )}
                </div>

                <div>
                  <label
                    htmlFor="account-email"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Email
                  </label>
                  <Input id="account-email" value={user?.email ?? ""} readOnly />
                </div>
              </div>

              <div className="mt-4 flex min-h-7 items-center justify-end gap-3">
                {saved && !canSave && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3.5" />
                    Saved
                  </span>
                )}
                <Button type="submit" size="sm" disabled={!canSave}>
                  {updateProfile.isPending && <Loader2 className="animate-spin" />}
                  Save changes
                </Button>
              </div>

              {updateProfile.error && (
                <p className="mt-3 text-sm text-destructive">
                  {updateProfile.error.message}
                </p>
              )}
              {profileError && (
                <p className="mt-3 text-sm text-destructive">
                  Could not load your profile.
                </p>
              )}
            </form>
          </SettingSection>

          <SettingSection
            title="Appearance"
            description="Choose how blomstr looks on this device."
          >
            <div
              className="grid grid-cols-1 gap-2 rounded-xl border bg-card p-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Appearance"
            >
              {themeOptions.map(({ value, label, description, icon: Icon }) => {
                const selected = theme === value
                return (
                  <label
                    key={value}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:flex-col sm:items-start",
                      selected
                        ? "border-border bg-background shadow-xs"
                        : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="account-theme"
                      value={value}
                      checked={selected}
                      className="sr-only"
                      onChange={() => setTheme(value)}
                    />
                    <Icon className="size-4" strokeWidth={1.5} />
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </SettingSection>

          <SettingSection
            title="Session"
            description="Sign out of blomstr on this device."
          >
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Signed in as</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={logOut.isPending}
                onClick={() => logOut.mutate()}
              >
                {logOut.isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
                Log out
              </Button>
            </div>
          </SettingSection>
        </div>
      </main>
    </>
  )
}
