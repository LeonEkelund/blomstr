import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useMembers } from "@/hooks/use-members"
import type { Comment } from "@/hooks/use-review"
import { initials } from "@/lib/content"
import { cn } from "@/lib/utils"

/**
 * One conversation, rendered two ways.
 *
 * The Review tab passes the current version's messages; Overview passes every
 * message about the project, with version ones tagged. Same component, because
 * it is the same thread — only the slice differs.
 */
export function CommentThread({
  comments,
  onSend,
  pending,
  placeholder,
  emptyText,
  className,
}: {
  comments: Comment[]
  onSend: (body: string) => void
  pending: boolean
  placeholder: string
  emptyText: string
  className?: string
}) {
  const { members } = useMembers()
  const [draft, setDraft] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  // Follow the conversation down as it grows, the way a chat does.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [])

  function send() {
    if (!draft.trim()) return
    onSend(draft)
    setDraft("")
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {comments.map((c) => {
              const author = members.find((m) => m.id === c.authorId)
              return (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar className="mt-0.5 size-6 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {initials(author?.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-medium">{author?.name ?? "Someone"}</span>
                      <span className="text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {/*
                        Tagged rather than separated: a message about V2 still
                        belongs in the same conversation, it just needs to say
                        what it was looking at.
                      */}
                      {c.versionNumber !== null && (
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px] font-normal"
                        >
                          on V{c.versionNumber}
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t p-3">
        <textarea
          rows={2}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — chat convention.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={!draft.trim() || pending}
            onClick={send}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
