import type { ContentItem } from "@blomstr/types"
import { ExternalLink, File, FolderOpen, Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  type PickedDriveFile,
  useDriveConnection,
  useDriveFiles,
} from "@/hooks/use-drive"
import { useCurrentMember } from "@/hooks/use-members"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

interface PickerDocument extends Record<string, unknown> {
  id?: string
  name?: string
  mimeType?: string
  sizeBytes?: number | string
}

interface PickerBuilder {
  addView(view: unknown): PickerBuilder
  enableFeature(feature: unknown): PickerBuilder
  setAppId(appId: string): PickerBuilder
  setCallback(
    callback: (data: { action?: string; docs?: PickerDocument[] }) => void,
  ): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setOrigin(origin: string): PickerBuilder
  build(): { setVisible(visible: boolean): void }
}

interface PickerNamespace {
  Action: { CANCEL: string; PICKED: string }
  DocsView: new (viewId: unknown) => unknown
  Feature: { MULTISELECT_ENABLED: unknown }
  PickerBuilder: new () => PickerBuilder
  ViewId: { DOCS: unknown }
}

declare global {
  interface Window {
    gapi?: {
      load(
        api: string,
        options: {
          callback: () => void
          onerror: () => void
          ontimeout: () => void
          timeout: number
        },
      ): void
    }
    google?: { picker?: PickerNamespace }
  }
}

let pickerApiPromise: Promise<PickerNamespace> | null = null

function loadPickerApi() {
  if (window.google?.picker) return Promise.resolve(window.google.picker)
  if (pickerApiPromise) return pickerApiPromise

  pickerApiPromise = new Promise<PickerNamespace>((resolve, reject) => {
    function loadModule() {
      if (!window.gapi) {
        reject(new Error("Google Picker did not load"))
        return
      }
      window.gapi.load("picker", {
        callback: () => {
          if (window.google?.picker) resolve(window.google.picker)
          else reject(new Error("Google Picker is unavailable"))
        },
        onerror: () => reject(new Error("Could not load Google Picker")),
        ontimeout: () => reject(new Error("Google Picker took too long to load")),
        timeout: 10_000,
      })
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://apis.google.com/js/api.js"]',
    )
    if (existing) {
      if (window.gapi) loadModule()
      else existing.addEventListener("load", loadModule, { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = "https://apis.google.com/js/api.js"
    script.async = true
    script.addEventListener("load", loadModule, { once: true })
    script.addEventListener(
      "error",
      () => reject(new Error("Could not load Google Picker")),
      { once: true },
    )
    document.head.append(script)
  }).catch((error) => {
    pickerApiPromise = null
    throw error
  })

  return pickerApiPromise
}

function formatSize(bytes: number | null) {
  if (bytes === null) return "Google Drive"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function normalizePicked(document: PickerDocument): PickedDriveFile | null {
  if (typeof document.id !== "string" || typeof document.name !== "string") {
    return null
  }
  const size = Number(document.sizeBytes)
  return {
    id: document.id,
    name: document.name,
    mimeType: typeof document.mimeType === "string" ? document.mimeType : null,
    sizeBytes: Number.isFinite(size) && size >= 0 ? size : null,
  }
}

export function DriveFilesPanel({ project }: { project: ContentItem }) {
  const { workspace } = useWorkspace()
  const { member } = useCurrentMember()
  const { connection, loading: loadingConnection } = useDriveConnection()
  const { files, loading: loadingFiles, link, remove } = useDriveFiles(project.id)
  const [openingPicker, setOpeningPicker] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)

  const isOwner = member?.role === "owner"
  const canChoose = isOwner && connection?.connectedBy === member.id
  const canRemove = Boolean(member && member.role !== "guest")

  async function chooseFiles() {
    if (!workspace) return
    const apiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY
    const appId = import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_NUMBER
    if (!apiKey || !appId) {
      setPickerError("Google Picker is not configured for this deployment.")
      return
    }

    setPickerError(null)
    setOpeningPicker(true)
    try {
      const [{ data, error }, picker] = await Promise.all([
        supabase.functions.invoke("drive-access-token", {
          body: { workspaceId: workspace.id },
        }),
        loadPickerApi(),
      ])
      if (error) throw error
      const accessToken = (data as { accessToken?: string } | null)?.accessToken
      if (!accessToken) throw new Error("Drive access token was not returned")

      const view = new picker.DocsView(picker.ViewId.DOCS)
      const dialog = new picker.PickerBuilder()
        .addView(view)
        .enableFeature(picker.Feature.MULTISELECT_ENABLED)
        .setAppId(appId)
        .setDeveloperKey(apiKey)
        .setOAuthToken(accessToken)
        .setOrigin(window.location.origin)
        .setCallback((result) => {
          if (result.action !== picker.Action.PICKED) return
          const picked = (result.docs ?? []).flatMap((document) => {
            const file = normalizePicked(document)
            return file ? [file] : []
          })
          if (picked.length > 0) link.mutate(picked)
        })
        .build()
      dialog.setVisible(true)
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "Could not open Drive")
    } finally {
      setOpeningPicker(false)
    }
  }

  if (loadingConnection || loadingFiles) {
    return (
      <div className="space-y-2 p-6">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (!connection && files.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Connect Google Drive"
        description="Link footage and large files without uploading them to blomstr."
        action={
          isOwner ? (
            <Button variant="outline" size="sm" render={<Link to="/integrations" />}>
              Open integrations
            </Button>
          ) : undefined
        }
      />
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-full border bg-card p-3">
          <FolderOpen className="size-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-sm font-medium">No Drive files linked</h2>
        <p className="mt-1 max-w-xs text-sm text-balance text-muted-foreground">
          Files stay in Google Drive. Google sharing still controls who can open them.
        </p>
        {canChoose && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={openingPicker || link.isPending}
            onClick={() => void chooseFiles()}
          >
            {openingPicker || link.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus />
            )}
            Choose from Drive
          </Button>
        )}
        {isOwner && !canChoose && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            render={<Link to="/integrations" />}
          >
            Reconnect Drive
          </Button>
        )}
        {!isOwner && (
          <p className="mt-4 text-xs text-muted-foreground">
            The workspace owner can link Drive files.
          </p>
        )}
        {(pickerError || link.error) && (
          <p className="mt-3 text-sm text-destructive">
            {pickerError ?? link.error?.message}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          <div>
            <h2 className="text-sm font-medium">Google Drive</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {files.length} {files.length === 1 ? "file" : "files"}
            </p>
          </div>
          {canChoose && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={openingPicker || link.isPending}
              onClick={() => void chooseFiles()}
            >
              {openingPicker || link.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Plus />
              )}
              Add files
            </Button>
          )}
          {isOwner && !canChoose && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              render={<Link to="/integrations" />}
            >
              Reconnect Drive
            </Button>
          )}
        </div>

        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-2 p-3 sm:flex-nowrap sm:gap-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <File className="size-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {formatSize(file.sizeBytes)}
                  {file.mimeType ? ` · ${file.mimeType}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-12 sm:ml-0"
                render={
                  <a
                    href={`https://drive.google.com/open?id=${encodeURIComponent(file.driveFileId)}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <ExternalLink />
                Open
              </Button>
              {canRemove && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${file.title}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(file.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>

        {(pickerError || link.error || remove.error) && (
          <p className="mt-3 text-sm text-destructive">
            {pickerError ?? link.error?.message ?? remove.error?.message}
          </p>
        )}
      </div>
    </div>
  )
}
