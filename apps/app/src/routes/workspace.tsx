import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Loader2, RotateCcw } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCurrentMember } from "@/hooks/use-members"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

interface ArchivedProject {
  id: string
  title: string
  archivedAt: string
}

function formatArchivedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function WorkspacePage() {
  const queryClient = useQueryClient()
  const { workspace } = useWorkspace()
  const { member } = useCurrentMember()
  const [name, setName] = useState(workspace?.name ?? "")

  const isOwner = member?.role === "owner"
  const isStaff = Boolean(member && member.role !== "guest")
  const workspaceId = workspace?.id

  useEffect(() => {
    setName(workspace?.name ?? "")
  }, [workspace?.name])

  const rename = useMutation({
    mutationFn: async (nextName: string) => {
      if (!workspaceId) throw new Error("No workspace selected")

      const { error } = await supabase
        .from("workspaces")
        .update({ name: nextName })
        .eq("id", workspaceId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
  })

  const archivedKey = ["archived-projects", workspaceId]
  const {
    data: archived = [],
    isPending: loadingArchived,
    error: archivedError,
  } = useQuery({
    queryKey: archivedKey,
    enabled: Boolean(workspaceId && isStaff),
    queryFn: async (): Promise<ArchivedProject[]> => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, archived_at")
        .eq("workspace_id", workspaceId ?? "")
        .is("parent_id", null)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
      if (error) throw error

      return data.flatMap((project) =>
        project.archived_at
          ? [
              {
                id: project.id,
                title: project.title,
                archivedAt: project.archived_at,
              },
            ]
          : [],
      )
    },
  })

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("content_items")
        .update({ archived_at: null })
        .or(`id.eq.${id},ancestor_ids.cs.{${id}}`)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: archivedKey })
      queryClient.invalidateQueries({ queryKey: ["content_items", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["home", workspaceId] })
    },
  })

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName || nextName === workspace?.name) return
    rename.mutate(nextName)
  }

  const cleanName = name.trim()
  const canSave =
    isOwner && Boolean(cleanName) && cleanName !== workspace?.name && !rename.isPending

  return (
    <>
      <PageHeader title="Workspace" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <section>
            <h2 className="text-sm font-medium">General</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The name shown to everyone in this workspace.
            </p>

            <form
              className="mt-4 flex items-end gap-2 rounded-lg border bg-card p-4"
              onSubmit={submitName}
            >
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Workspace name
                </span>
                <Input
                  aria-label="Workspace name"
                  value={name}
                  disabled={!isOwner || rename.isPending}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={!canSave}>
                {rename.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </Button>
            </form>

            {!isOwner && (
              <p className="mt-2 text-xs text-muted-foreground">
                Only the workspace owner can change its name.
              </p>
            )}
            {rename.error && (
              <p className="mt-2 text-sm text-destructive">{rename.error.message}</p>
            )}
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-medium">Archive</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Archived projects stay out of the board until you restore them.
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border bg-card">
              {loadingArchived ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading archive…
                </div>
              ) : archivedError ? (
                <p className="p-4 text-sm text-destructive">
                  Could not load archived projects.
                </p>
              ) : archived.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <Archive className="size-5 text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-3 text-sm font-medium">Archive is empty</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Projects you archive will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {archived.map((project) => (
                    <li key={project.id} className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{project.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Archived {formatArchivedDate(project.archivedAt)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(project.id)}
                      >
                        {restore.isPending && restore.variables === project.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {restore.error && (
              <p className="mt-2 text-sm text-destructive">{restore.error.message}</p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
