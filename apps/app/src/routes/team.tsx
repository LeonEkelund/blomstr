import type { WorkspaceRole } from "@blomstr/types"
import { Check, ChevronDown, Copy, Loader2, UserPlus } from "lucide-react"
import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useCurrentMember, useMembers } from "@/hooks/use-members"
import { useInvites, useTeamActions } from "@/hooks/use-team"
import { initials, roleDescriptions, roleLabels, roleOrder } from "@/lib/content"

/** Staff only — guests are invited from a project, not from here. */
const STAFF_ROLES: WorkspaceRole[] = ["admin", "editor"]

/**
 * Shown once, immediately after creating an invite.
 *
 * The token exists only in that response — the database stores a hash — so if
 * this is dismissed without copying, the invite has to be revoked and reissued.
 * Hence the warning rather than a quiet close button.
 */
function InviteLink({ token, onDone }: { token: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/invite/${token}`

  return (
    <div className="mt-4 rounded-lg border bg-card p-3">
      <p className="text-sm font-medium">Invite link</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Shown once. Copy it now — it cannot be retrieved later.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Input readOnly value={url} className="h-8 font-mono text-xs" />
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5"
          onClick={() => {
            navigator.clipboard.writeText(url)
            setCopied(true)
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}

function InviteForm() {
  const { invite } = useTeamActions()
  const [role, setRole] = useState<WorkspaceRole>("editor")
  const [email, setEmail] = useState("")
  const [token, setToken] = useState<string | null>(null)

  if (token) return <InviteLink token={token} onDone={() => setToken(null)} />

  return (
    <div className="mt-4 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5">
                {roleLabels[role]}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuRadioGroup
              value={role}
              onValueChange={(v) => setRole(v as WorkspaceRole)}
            >
              {STAFF_ROLES.map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">{roleLabels[r]}</span>
                    <span className="text-xs text-muted-foreground">
                      {roleDescriptions[r]}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/*
          Optional, and it locks the invite to one address rather than sending
          anything — there is no email system yet, and a link you hand over
          directly works today.
        */}
        <Input
          type="email"
          placeholder="Lock to an email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 w-56"
        />

        <Button
          size="sm"
          className="h-8 gap-1.5"
          disabled={invite.isPending}
          onClick={() =>
            invite.mutate({ role, email }, { onSuccess: (t) => setToken(t) })
          }
        >
          {invite.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UserPlus className="size-3.5" strokeWidth={1.5} />
          )}
          Create invite link
        </Button>
      </div>

      {invite.error && (
        <p className="mt-2 text-sm text-destructive">{invite.error.message}</p>
      )}
    </div>
  )
}

export function TeamPage() {
  const { members, loading } = useMembers()
  const { member: me } = useCurrentMember()
  const { invites } = useInvites()
  const { setRole, remove, revoke } = useTeamActions()

  const isOwner = me?.role === "owner"
  const pending = invites.filter(
    (i) => !i.revokedAt && i.usedCount < i.maxUses && new Date(i.expiresAt) > new Date(),
  )

  return (
    <>
      <PageHeader title="Team">
        <span className="text-xs text-muted-foreground">
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <section>
            <h2 className="text-sm font-medium">People</h2>

            <ul className="mt-3 divide-y rounded-lg border bg-card">
              {loading && <li className="p-3 text-sm text-muted-foreground">Loading…</li>}
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.name}
                      {m.id === me?.id && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          you
                        </span>
                      )}
                    </p>
                    {/*
                      What the role means, in a sentence, rather than making
                      someone go and look it up. This is the whole reason the
                      page exists beyond listing names.
                    */}
                    <p className="truncate text-xs text-muted-foreground">
                      {roleDescriptions[m.role]}
                    </p>
                  </div>

                  {isOwner ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 gap-1 px-2 text-xs"
                          >
                            {roleLabels[m.role]}
                            <ChevronDown className="size-3.5 text-muted-foreground" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuRadioGroup
                          value={m.role}
                          onValueChange={(v) =>
                            setRole.mutate({ userId: m.id, role: v as WorkspaceRole })
                          }
                        >
                          {roleOrder.map((r) => (
                            <DropdownMenuRadioItem key={r} value={r}>
                              <span className="flex flex-col items-start gap-0.5">
                                <span className="font-medium">{roleLabels[r]}</span>
                                <span className="text-xs text-muted-foreground">
                                  {roleDescriptions[r]}
                                </span>
                              </span>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => remove.mutate(m.id)}>
                          Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {roleLabels[m.role]}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>

            {(setRole.error || remove.error) && (
              <p className="mt-2 text-sm text-destructive">
                {(setRole.error ?? remove.error)?.message}
              </p>
            )}
          </section>

          {isOwner && (
            <section className="mt-8">
              <h2 className="text-sm font-medium">Invite someone</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Guests are invited from a project instead, so they only ever see that one.
              </p>
              <InviteForm />

              {pending.length > 0 && (
                <ul className="mt-4 divide-y rounded-lg border bg-card">
                  {pending.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          {roleLabels[i.role]} invite
                          {i.email && (
                            <span className="text-muted-foreground"> · {i.email}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(i.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => revoke.mutate(i.id)}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
