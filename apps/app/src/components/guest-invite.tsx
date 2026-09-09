import { Loader2, UserPlus } from "lucide-react"
import { useState } from "react"
import { InviteLink } from "@/components/invite-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCurrentMember } from "@/hooks/use-members"
import { useTeamActions } from "@/hooks/use-team"

/**
 * Invites a guest to one project.
 *
 * Guests are invited from a project rather than from the team page, because
 * the grant is what gives them access: redeeming a project invite writes a
 * `guest_grants` row, and `can_read_item` cascades it down every derivative.
 * A guest with no grant would be in the workspace able to see nothing.
 *
 * Owner and admin only — `can_invite_guests` allows both, so a manager can
 * send a sponsor a review link without the creator. Editors cannot, so they
 * are not shown the control at all rather than being shown one that errors.
 */
export function GuestInvite({ contentItemId }: { contentItemId: string }) {
  const { member } = useCurrentMember()
  const { invite } = useTeamActions()
  const [email, setEmail] = useState("")
  const [token, setToken] = useState<string | null>(null)

  const canInvite = member?.role === "owner" || member?.role === "admin"
  if (!canInvite) return null

  return (
    <section className="pt-8">
      <h3 className="section-title">Guest access</h3>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        Share this project with someone outside the team — a sponsor or a client. They can
        read it and leave comments, including on anything cut from it. They cannot upload
        or approve.
      </p>

      {token ? (
        <InviteLink token={token} onDone={() => setToken(null)} />
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          {/*
            Optional, and it locks the invite to one address rather than sending
            anything — there is no email system yet, and a link handed over
            directly works today.
          */}
          <Input
            type="email"
            placeholder="Lock to an email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 w-full sm:w-56"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-fit gap-1.5"
            disabled={invite.isPending}
            onClick={() =>
              invite.mutate(
                { role: "guest", email, contentItemId },
                { onSuccess: (t) => setToken(t) },
              )
            }
          >
            {invite.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserPlus className="size-3.5" strokeWidth={1.5} />
            )}
            Create guest link
          </Button>
        </div>
      )}

      {invite.error && (
        <p className="mt-2 text-sm text-destructive">{invite.error.message}</p>
      )}
    </section>
  )
}
