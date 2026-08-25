import type { ContentItem } from "@blomstr/types"
import { Excalidraw } from "@excalidraw/excalidraw"
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "@/components/theme-provider"
import { useCurrentMember } from "@/hooks/use-members"
import { supabase } from "@/lib/supabase"

type SaveState = "idle" | "saving" | "saved" | "error"

interface StoredFile {
  id: string
  mimeType: BinaryFileData["mimeType"]
  created: number
  version?: number
  storagePath: string
}

interface StoredScene {
  type: "excalidraw"
  version: 1
  elements: ExcalidrawInitialDataState["elements"]
  appState: ExcalidrawInitialDataState["appState"]
  files: Record<string, StoredFile>
}

interface PendingScene {
  elements: readonly OrderedExcalidrawElement[]
  appState: AppState
  files: BinaryFiles
}

const EMPTY_SCENE: StoredScene = {
  type: "excalidraw",
  version: 1,
  elements: [],
  appState: {},
  files: {},
}

/** Selection and open dialogs are session state, not part of the document. */
function persistentAppState(appState: AppState) {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
    gridSize: appState.gridSize,
    gridStep: appState.gridStep,
    gridModeEnabled: appState.gridModeEnabled,
    objectsSnapModeEnabled: appState.objectsSnapModeEnabled,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
  }
}

function extensionFor(mimeType: string) {
  const subtype = mimeType.split("/")[1]?.split("+")[0]
  return subtype?.replace("jpeg", "jpg") || "bin"
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error("Could not prepare a mindmap image for upload")
  return response.blob()
}

function isStoredScene(value: unknown): value is StoredScene {
  if (!value || typeof value !== "object") return false
  const scene = value as Partial<StoredScene>
  return scene.type === "excalidraw" && Array.isArray(scene.elements)
}

async function loadMindmap(project: ContentItem) {
  const { data, error } = await supabase
    .from("mindmaps")
    .select("scene")
    .eq("content_item_id", project.id)
    .maybeSingle()
  if (error) throw error

  const stored = isStoredScene(data?.scene) ? data.scene : EMPTY_SCENE
  const metadata = stored.files ?? {}
  const paths = Object.values(metadata).map((file) => file.storagePath)
  const files: BinaryFiles = {}

  if (paths.length > 0) {
    const { data: urls, error: urlError } = await supabase.storage
      .from("assets")
      .createSignedUrls(paths, 60 * 60)
    if (urlError) throw urlError

    for (const result of urls) {
      if (!result.signedUrl) continue
      const file = Object.values(metadata).find(
        (candidate) => candidate.storagePath === result.path,
      )
      if (!file) continue
      files[file.id] = {
        id: file.id as BinaryFileData["id"],
        mimeType: file.mimeType,
        created: file.created,
        version: file.version,
        dataURL: result.signedUrl as BinaryFileData["dataURL"],
        lastRetrieved: Date.now(),
      }
    }
  }

  return {
    initialData: {
      elements: stored.elements ?? [],
      appState: stored.appState ?? {},
      files,
    } satisfies ExcalidrawInitialDataState,
    metadata,
  }
}

export function MindmapEditor({ project }: { project: ContentItem }) {
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()
  const { member } = useCurrentMember()
  const canEdit = member !== undefined && member.role !== "guest"
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const pendingRef = useRef<PendingScene | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveChainRef = useRef(Promise.resolve())
  const knownFilesRef = useRef<Record<string, StoredFile>>({})
  const loadedProjectRef = useRef<string | null>(null)

  const { data, isPending, error } = useQuery({
    queryKey: ["mindmap", project.id],
    queryFn: () => loadMindmap(project),
  })

  if (data && loadedProjectRef.current !== project.id) {
    loadedProjectRef.current = project.id
    knownFilesRef.current = data.metadata
  }

  const saveScene = useCallback(
    async (pending: PendingScene) => {
      setSaveState("saving")
      const metadata = { ...knownFilesRef.current }

      for (const file of Object.values(pending.files)) {
        const stored = metadata[file.id]
        if (stored && stored.version === file.version) continue
        if (!file.dataURL.startsWith("data:")) continue

        const storagePath = `${project.workspaceId}/${project.id}/mindmap/${file.id}.${extensionFor(file.mimeType)}`
        const blob = await dataUrlToBlob(file.dataURL)
        const { error: uploadError } = await supabase.storage
          .from("assets")
          .upload(storagePath, blob, {
            contentType: file.mimeType,
            upsert: true,
          })
        if (uploadError) throw uploadError

        metadata[file.id] = {
          id: file.id,
          mimeType: file.mimeType,
          created: file.created,
          version: file.version,
          storagePath,
        }
      }

      const scene: StoredScene = {
        type: "excalidraw",
        version: 1,
        elements: pending.elements,
        appState: persistentAppState(pending.appState),
        files: metadata,
      }

      const { error: saveError } = await supabase.from("mindmaps").upsert(
        {
          content_item_id: project.id,
          workspace_id: project.workspaceId,
          scene,
        },
        { onConflict: "content_item_id" },
      )
      if (saveError) throw saveError

      knownFilesRef.current = metadata
      queryClient.invalidateQueries({ queryKey: ["activity", project.id] })
      setSaveState("saved")
    },
    [project.id, project.workspaceId, queryClient],
  )

  const flush = useCallback(() => {
    const pending = pendingRef.current
    pendingRef.current = null
    if (!pending) return

    saveChainRef.current = saveChainRef.current
      .then(() => saveScene(pending))
      .catch(() => setSaveState("error"))
  }, [saveScene])

  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      if (!canEdit) return
      pendingRef.current = { elements, appState, files }
      setSaveState("idle")
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, 900)
    },
    [canEdit, flush],
  )

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      flush()
    },
    [flush],
  )

  if (isPending) return <div className="mindmap-message">Opening canvas…</div>
  if (error) {
    return (
      <div className="mindmap-message mindmap-message-error">
        Could not open this mindmap. Make sure the mindmap migration has been applied.
      </div>
    )
  }

  const statusLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Couldn’t save"
        : saveState === "saved"
          ? "Saved"
          : ""

  return (
    <div className="mindmap-canvas">
      <Excalidraw
        key={project.id}
        initialData={data?.initialData}
        name={`${project.title} mindmap`}
        theme={resolvedTheme}
        viewModeEnabled={!canEdit}
        onChange={handleChange}
        renderTopRightUI={() =>
          statusLabel ? (
            <span
              className={`mindmap-save-state${saveState === "error" ? " mindmap-save-state-error" : ""}`}
            >
              {statusLabel}
            </span>
          ) : null
        }
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  )
}
