import type { ContentItem } from "@blomstr/types"
import {
  Check,
  ChevronDown,
  Download,
  Loader2,
  MessageSquareReply,
  Upload,
} from "lucide-react"
import { type ChangeEvent, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentMember } from "@/hooks/use-members"
import { useReviewActions, useVersions, type Version } from "@/hooks/use-review"
import { approvalLabels, formatLongDate } from "@/lib/content"

function StateBadge({ state }: { state: Version["approvalState"] }) {
  return (
    <Badge
      variant={
        state === "changes_requested"
          ? "destructive"
          : state === "approved"
            ? "secondary"
            : "default"
      }
      className="font-normal"
    >
      {approvalLabels[state]}
    </Badge>
  )
}

export function ReviewPanel({ project }: { project: ContentItem }) {
  const { versions, loading } = useVersions(project.id)
  const { upload, approve, requestChanges } = useReviewActions(project.id)
  const { member } = useCurrentMember()

  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // Newest first, so the latest version is what you land on.
  const current = versions.find((v) => v.id === selectedId) ?? versions[0]

  /*
    Hidden rather than disabled for editors: a control you can never use is
    noise. The database refuses regardless — this only decides what is worth
    showing.
  */
  const canApprove = member?.role === "owner" || member?.role === "admin"
  const awaitingReview =
    current?.approvalState === "in_review" ||
    current?.approvalState === "changes_requested"

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) upload.mutate(file)
    // Cleared so choosing the same file twice still fires a change.
    event.target.value = ""
  }

  if (loading) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFile}
        className="hidden"
      />

      {versions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="rounded-full border bg-card p-3">
            <Upload className="size-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-sm font-medium">Nothing to review yet</h2>
          <p className="mt-1 max-w-xs text-sm text-balance text-muted-foreground">
            Upload a thumbnail or a still. It becomes V1, and whoever can approve gets it
            in their queue.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {upload.isPending && <Loader2 className="animate-spin" />}
            Upload a version
          </Button>
          {upload.error && (
            <p className="mt-3 text-sm text-destructive">{upload.error.message}</p>
          )}
        </div>
      ) : (
        <>
          <header className="flex shrink-0 items-center gap-2 border-b px-6 py-3">
            {/*
              The version picker lives here rather than in a strip along the
              bottom: a tall image pushed that strip off screen, so switching
              versions meant scrolling past the thing you were reviewing.

              A dropdown rather than a row of pills — it is the same size at V2
              or V12, and each entry can carry its own state, which a pill
              cannot.
            */}
            {versions.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      V{current?.number}
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuRadioGroup
                    value={current?.id ?? ""}
                    onValueChange={setSelectedId}
                  >
                    {versions.map((v) => (
                      <DropdownMenuRadioItem key={v.id} value={v.id}>
                        <span className="font-medium">V{v.number}</span>
                        <span className="text-muted-foreground">
                          {approvalLabels[v.approvalState]}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <h2 className="text-sm font-medium">V{current?.number}</h2>
            )}

            {current && <StateBadge state={current.approvalState} />}
            {current && (
              <span className="text-xs text-muted-foreground">
                {formatLongDate(current.createdAt)}
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/*
                Available to anyone who can see the version, guests included —
                a sponsor reviewing an ad read wants the file, not a screenshot
                of it. Uploading stays staff-only; taking a copy does not.
              */}
              {current?.downloadUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  render={
                    <a
                      href={current.downloadUrl}
                      // Same tab would navigate away from the review.
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <Download className="size-3.5" strokeWidth={1.5} />
                  Download
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                disabled={upload.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {upload.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" strokeWidth={1.5} />
                )}
                New version
              </Button>

              {canApprove && awaitingReview && current && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => setNote("")}
                  >
                    <MessageSquareReply className="size-3.5" strokeWidth={1.5} />
                    Request changes
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(current.id)}
                  >
                    {approve.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" strokeWidth={1.5} />
                    )}
                    Approve
                  </Button>
                </>
              )}
            </div>
          </header>

          {/*
            The note is required by the database, so asking for it here is not
            a formality — sending work back without saying why is the thing
            this replaces.
          */}
          {note !== null && current && (
            <div className="shrink-0 border-b px-6 py-3">
              <textarea
                // biome-ignore lint/a11y/noAutofocus: opened by an explicit user action
                autoFocus
                rows={2}
                value={note}
                placeholder="What needs changing?"
                onChange={(e) => setNote(e.target.value)}
                className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!note.trim() || requestChanges.isPending}
                  onClick={() =>
                    requestChanges.mutate(
                      { versionId: current.id, note },
                      { onSuccess: () => setNote(null) },
                    )
                  }
                >
                  Send back
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setNote(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto p-6">
            {current?.url ? (
              <img
                src={current.url}
                alt={`Version ${current.number}`}
                className="mx-auto max-h-full rounded-lg border bg-card"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No preview for this version.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
