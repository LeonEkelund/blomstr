import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

export interface DriveConnection {
  id: string
  connectedBy: string
  email: string
  updatedAt: string
}

export interface DriveFile {
  id: string
  driveFileId: string
  title: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
}

export interface PickedDriveFile {
  id: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
}

export function useDriveConnection() {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ["drive-connection", workspace?.id]

  const { data: connection = null, isPending } = useQuery({
    queryKey,
    enabled: Boolean(workspace),
    queryFn: async (): Promise<DriveConnection | null> => {
      const { data, error } = await supabase
        .from("drive_connections")
        .select("id, connected_by, google_email, updated_at")
        .eq("workspace_id", workspace?.id ?? "")
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        id: data.id,
        connectedBy: data.connected_by,
        email: data.google_email,
        updatedAt: data.updated_at,
      }
    },
  })

  const connect = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("No workspace selected")
      const { data, error } = await supabase.functions.invoke("drive-auth-start", {
        body: { workspaceId: workspace.id },
      })
      if (error) throw error
      const url = (data as { url?: string } | null)?.url
      if (!url) throw new Error("Drive authorization URL was not returned")
      window.location.assign(url)
    },
  })

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("No workspace selected")
      const { error } = await supabase.rpc("disconnect_drive", {
        p_workspace_id: workspace.id,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    connection,
    loading: Boolean(workspace) && isPending,
    connect,
    disconnect,
  }
}

export function useDriveFiles(contentItemId: string) {
  const queryClient = useQueryClient()
  const queryKey = ["drive-files", contentItemId]

  const { data: files = [], isPending } = useQuery({
    queryKey,
    queryFn: async (): Promise<DriveFile[]> => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, drive_file_id, title, mime_type, size_bytes, created_at")
        .eq("content_item_id", contentItemId)
        .eq("kind", "drive_file")
        .order("created_at")
      if (error) throw error

      return data.flatMap((file) =>
        file.drive_file_id
          ? [
              {
                id: file.id,
                driveFileId: file.drive_file_id,
                title: file.title,
                mimeType: file.mime_type,
                sizeBytes: file.size_bytes,
                createdAt: file.created_at,
              },
            ]
          : [],
      )
    },
  })

  const link = useMutation({
    mutationFn: async (picked: PickedDriveFile[]) => {
      for (const file of picked) {
        const { error } = await supabase.rpc("link_drive_file", {
          p_content_item_id: contentItemId,
          p_drive_file_id: file.id,
          p_title: file.name,
          p_mime_type: file.mimeType,
          p_size_bytes: file.sizeBytes,
        })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const remove = useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase.from("assets").delete().eq("id", assetId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { files, loading: isPending, link, remove }
}
