import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Shown once, immediately after creating an invite.
 *
 * The token exists only in that response — the database stores a hash — so if
 * this is dismissed without copying, the invite has to be revoked and reissued.
 * Hence the warning rather than a quiet close button.
 *
 * Shared by the team page and the project guest panel: both hand out a link
 * they can never show again, so both need the same warning.
 */
export function InviteLink({ token, onDone }: { token: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/invite/${token}`

  return (
    <div className="mt-4 rounded-lg border bg-card p-3">
      <p className="text-sm font-medium">Invite link</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Shown once. Copy it now — it cannot be retrieved later.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
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
