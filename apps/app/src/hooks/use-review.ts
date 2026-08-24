import type { ApprovalState } from "@blomstr/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

export interface Version {
  id: string
  number: number
  approvalState: ApprovalState
  storagePath: string | null
  createdBy: string
  createdAt: string
  /** Signed, because the bucket is private. Expires. */
  url: string | null
  /** The name it was uploaded as, for the download. */
  fileName: string
  /** Same URL, but asks the browser to save rather than navigate to it. */
  downloadUrl: string | null
}

/**
 * Recovers the original filename from a storage path.
 *
 * Uploads are stored as `<uuid>-<name>` so two files called thumbnail.png
 * cannot collide. A uuid is always 36 characters, so the name is whatever
 * follows the separator after it.
 */
function fileNameFromPath(path: string) {
  const last = path.split("/").pop() ?? ""
  return last.length > 37 ? last.slice(37) : last
}

/** How long a signed file URL lasts. Long enough to review, short enough to leak badly. */
const URL_TTL_SECONDS = 60 * 60

/**
 * One asset per project, for now.
 *
 * The schema allows many — a video, its thumbnails, its script are all assets
 * of the same project — but the review loop only needs one thing under review
 * at a time to be useful. Uploading again makes V2 of the same asset rather
 * than a second asset, which is what makes "approve the latest version" mean
 * anything.
 */
async function ensureAsset(workspaceId: string, contentItemId: string) {
  const { data: existing, error: findError } = await supabase
    .from("assets")
    .select("id")
    .eq("content_item_id", contentItemId)
    .order("created_at")
    .limit(1)
  if (findError) throw findError
  if (existing?.[0]) return existing[0].id

  const { data, error } = await supabase
    .from("assets")
    .insert({
      workspace_id: workspaceId,
      content_item_id: contentItemId,
      kind: "storage_object",
      title: "Review",
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export function useVersions(contentItemId: string) {
  const { data: versions = [], isPending } = useQuery({
    queryKey: ["versions", contentItemId],
    queryFn: async (): Promise<Version[]> => {
      const { data: assets, error: assetError } = await supabase
        .from("assets")
        .select("id")
        .eq("content_item_id", contentItemId)
      if (assetError) throw assetError
      if (assets.length === 0) return []

      const { data, error } = await supabase
        .from("asset_versions")
        .select("*")
        .in(
          "asset_id",
          assets.map((a) => a.id),
        )
        .order("version_number", { ascending: false })
      if (error) throw error

      /*
        Signed in one batch rather than per row. The bucket is private, so a
        path is not a URL — it has to be exchanged for a temporary one, and
        doing that per version would be a request each.
      */
      const paths = data.map((v) => v.storage_path).filter((p): p is string => Boolean(p))
      const signed = paths.length
        ? await supabase.storage.from("assets").createSignedUrls(paths, URL_TTL_SECONDS)
        : { data: [] }

      const urlByPath = new Map(
        (signed.data ?? []).map((s) => [s.path ?? "", s.signedUrl]),
      )

      return data.map((v) => {
        const url = v.storage_path ? (urlByPath.get(v.storage_path) ?? null) : null
        const fileName = v.storage_path ? fileNameFromPath(v.storage_path) : ""

        return {
          id: v.id,
          number: v.version_number,
          approvalState: v.approval_state,
          storagePath: v.storage_path,
          createdBy: v.created_by,
          createdAt: v.created_at,
          url,
          fileName,
          /*
            `download` sets Content-Disposition on the response, so the browser
            saves the file under its original name. Without it the link just
            navigates to the image, and the `download` attribute cannot help —
            it is ignored cross-origin, and storage is a different origin.
          */
          downloadUrl: url ? `${url}&download=${encodeURIComponent(fileName)}` : null,
        }
      })
    },
  })

  return { versions, loading: isPending }
}

export interface Comment {
  id: string
  body: string
  authorId: string
  createdAt: string
  /** Null when the comment is about the project rather than a version. */
  versionNumber: number | null
}

/** What a comment hangs off — a version, or the project itself. */
export type Subject =
  | { type: "asset_version"; id: string }
  | { type: "content_item"; id: string }

/**
 * The thread on one version.
 *
 * Requesting changes writes its note here rather than into a field of its own,
 * so the reason for sending something back sits in the same place as anything
 * else said about it — and the reply is just another comment.
 */
export function useComments(versionId: string | undefined) {
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", versionId],
    enabled: Boolean(versionId),
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("subject_type", "asset_version")
        .eq("subject_id", versionId ?? "")
        .order("created_at")
      if (error) throw error

      return data.map((c) => ({
        id: c.id,
        body: c.body,
        authorId: c.author_id,
        createdAt: c.created_at,
        versionNumber: null,
      }))
    },
  })

  return { comments }
}

/**
 * Everything said about a project, in one thread.
 *
 * Comments on the project and comments on each of its versions, merged by
 * time. Two separate conversations would mean every message starts with
 * deciding where to put it, and half the context ending up wherever you are
 * not looking — so there is one thread, and the Review tab simply shows a
 * slice of it.
 */
export function useProjectThread(contentItemId: string) {
  const { data: comments = [], isPending } = useQuery({
    queryKey: ["thread", contentItemId],
    queryFn: async (): Promise<Comment[]> => {
      const { data: assets, error: assetError } = await supabase
        .from("assets")
        .select("id")
        .eq("content_item_id", contentItemId)
      if (assetError) throw assetError

      const { data: versions, error: versionError } = assets.length
        ? await supabase
            .from("asset_versions")
            .select("id, version_number")
            .in(
              "asset_id",
              assets.map((a) => a.id),
            )
        : { data: [], error: null }
      if (versionError) throw versionError

      const versionNumberById = new Map(
        (versions ?? []).map((v) => [v.id, v.version_number]),
      )

      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .in("subject_id", [contentItemId, ...versionNumberById.keys()])
        .order("created_at")
      if (error) throw error

      return data.map((c) => ({
        id: c.id,
        body: c.body,
        authorId: c.author_id,
        createdAt: c.created_at,
        versionNumber: versionNumberById.get(c.subject_id) ?? null,
      }))
    },
  })

  return { comments, loading: isPending }
}

/**
 * Upload, then record.
 *
 * Two steps because they answer to different systems: the bytes go to Storage,
 * and `create_version` decides what the upload *means* — which number it is,
 * and whether it needs reviewing or is approved on arrival because the person
 * uploading holds approve rights.
 */
export function useReviewActions(contentItemId: string) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()

  /*
    The board reads approval state through the content_item_status view, so it
    is stale after any of these — hence invalidating content_items too, not
    just the version list.
  */
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["versions", contentItemId] })
    queryClient.invalidateQueries({ queryKey: ["content_items", workspace?.id] })
    // Requesting changes writes a comment, so both views of the thread are stale.
    queryClient.invalidateQueries({ queryKey: ["comments"] })
    queryClient.invalidateQueries({ queryKey: ["thread", contentItemId] })
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!workspace) throw new Error("no workspace")

      const assetId = await ensureAsset(workspace.id, contentItemId)

      /*
        Path is <workspace>/<project>/<name>, which is what the storage
        policies read to decide who may see this. The random prefix keeps two
        uploads of "thumbnail.png" from colliding.
      */
      const path = `${workspace.id}/${contentItemId}/${crypto.randomUUID()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(path, file)
      if (uploadError) throw uploadError

      const { error } = await supabase.rpc("create_version", {
        p_asset_id: assetId,
        p_storage_path: path,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const approve = useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase.rpc("approve_version", {
        p_version_id: versionId,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  /*
    Anyone who can see the version can reply — including guests, who cannot
    upload but are often the reason a version exists. The policy on comments
    resolves through the same read rule as the project itself.
  */
  const comment = useMutation({
    mutationFn: async ({ subject, body }: { subject: Subject; body: string }) => {
      if (!workspace) throw new Error("no workspace")
      const { error } = await supabase.from("comments").insert({
        workspace_id: workspace.id,
        subject_type: subject.type,
        subject_id: subject.id,
        body: body.trim(),
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const requestChanges = useMutation({
    mutationFn: async ({ versionId, note }: { versionId: string; note: string }) => {
      const { error } = await supabase.rpc("request_changes", {
        p_version_id: versionId,
        p_note: note,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  return { upload, approve, requestChanges, comment }
}
