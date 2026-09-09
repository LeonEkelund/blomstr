import type { ContentItem, Platform } from "@blomstr/types"
import { Check, Copy, Download, Loader2, PackageCheck } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MotionStatus } from "@/components/ui/motion"
import { Skeleton } from "@/components/ui/skeleton"
import { useContent } from "@/hooks/use-content"
import { useCurrentMember } from "@/hooks/use-members"
import {
  type PublishTarget,
  type PublishTargetDraft,
  usePublishTargets,
} from "@/hooks/use-publish"
import { useVersions } from "@/hooks/use-review"
import { platformLabels, platforms } from "@/lib/content"
import { cn } from "@/lib/utils"

const TAG_PLATFORMS: Platform[] = ["youtube", "tiktok", "instagram"]

function toLocalDateTime(iso: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function targetIsComplete(platform: Platform, target?: PublishTarget) {
  if (!target?.caption.trim()) return false
  return platform !== "youtube" || Boolean(target.title.trim())
}

function copyText(platform: Platform, target: PublishTarget) {
  const parts = platform === "youtube" ? [target.title, target.caption] : [target.caption]
  if (target.tags.length) {
    parts.push(
      platform === "youtube"
        ? `Tags: ${target.tags.join(", ")}`
        : target.tags.map((tag) => `#${tag}`).join(" "),
    )
  }
  return parts.filter(Boolean).join("\n\n")
}

function TargetEditor({
  platform,
  target,
  projectTitle,
  canEdit,
  onSave,
  saving,
  saveFailed,
}: {
  platform: Platform
  target?: PublishTarget
  projectTitle: string
  canEdit: boolean
  onSave: (draft: PublishTargetDraft) => void
  saving: boolean
  saveFailed: boolean
}) {
  const [title, setTitle] = useState(
    target?.title ?? (platform === "youtube" ? projectTitle : ""),
  )
  const [caption, setCaption] = useState(target?.caption ?? "")
  const [tags, setTags] = useState(target?.tags.join(", ") ?? "")
  const [copied, setCopied] = useState(false)
  const lastAttempted = useRef("")
  const normalizedTags = useMemo(
    () =>
      [
        ...new Set(
          tags
            .split(",")
            .map((tag) => tag.trim().replace(/^#+/, ""))
            .filter(Boolean),
        ),
      ].slice(0, 30),
    [tags],
  )
  const dirty =
    !target ||
    title.trim() !== target.title ||
    caption.trim() !== target.caption ||
    normalizedTags.join("|") !== target.tags.join("|")
  const draftSignature = `${title.trim()}\u0000${caption.trim()}\u0000${normalizedTags.join("|")}`

  useEffect(() => {
    if (!canEdit || !dirty || saving || lastAttempted.current === draftSignature) return
    const timer = window.setTimeout(() => {
      lastAttempted.current = draftSignature
      onSave({ platform, title, caption, tags: normalizedTags })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [
    canEdit,
    caption,
    dirty,
    draftSignature,
    normalizedTags,
    onSave,
    platform,
    saving,
    title,
  ])

  async function copyPackage() {
    await navigator.clipboard.writeText(
      copyText(platform, {
        id: target?.id ?? "",
        platform,
        title,
        caption,
        tags: normalizedTags,
        updatedAt: target?.updatedAt ?? "",
      }),
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="surface-panel">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-sm font-medium">{platformLabels[platform]} package</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {canEdit ? "Changes save automatically." : "View-only publishing copy."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <MotionStatus
              text={saveFailed ? "Could not save" : saving || dirty ? "Saving…" : "Saved"}
              className={cn(
                "text-xs text-muted-foreground",
                saveFailed && "text-destructive",
              )}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={copyPackage}
            disabled={!caption.trim()}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        {platform === "youtube" && (
          <label htmlFor={`publish-title-${platform}`} className="block space-y-2">
            <span className="text-xs font-medium">Title</span>
            <Input
              id={`publish-title-${platform}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              disabled={!canEdit}
              placeholder="Video title"
            />
          </label>
        )}
        <label htmlFor={`publish-caption-${platform}`} className="block space-y-2">
          <span className="flex items-center justify-between text-xs font-medium">
            <span>{platform === "youtube" ? "Description" : "Post copy"}</span>
            <span className="font-normal text-muted-foreground">
              {caption.length}/5000
            </span>
          </span>
          <textarea
            id={`publish-caption-${platform}`}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={5000}
            disabled={!canEdit}
            placeholder={`Write the ${platformLabels[platform]} copy…`}
            className="min-h-40 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground/70 focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        {TAG_PLATFORMS.includes(platform) && (
          <label htmlFor={`publish-tags-${platform}`} className="block space-y-2">
            <span className="text-xs font-medium">Tags</span>
            <Input
              id={`publish-tags-${platform}`}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              disabled={!canEdit}
              placeholder="launch, behind the scenes, studio"
            />
            <span className="block text-xs text-muted-foreground">
              Separate tags with commas. Up to 30 are saved.
            </span>
          </label>
        )}
      </div>
    </section>
  )
}

export function PublishPanel({ project }: { project: ContentItem }) {
  const { updateItem } = useContent()
  const { member } = useCurrentMember()
  const { versions, loading: versionsLoading } = useVersions(project.id)
  const { targets, loading: targetsLoading, save } = usePublishTargets(project.id)
  const canEdit = Boolean(member && member.role !== "guest")
  const [activePlatform, setActivePlatform] = useState<Platform>(
    project.platforms[0] ?? "youtube",
  )
  const latest = versions[0]
  const selectedTargets = project.platforms.map((platform) => ({
    platform,
    target: targets.find((target) => target.platform === platform),
  }))
  const completedTargets = selectedTargets.filter(({ platform, target }) =>
    targetIsComplete(platform, target),
  ).length
  const approved = latest?.approvalState === "approved"
  const scheduled = Boolean(
    project.publishAt && new Date(project.publishAt).getTime() > Date.now(),
  )
  const hasDestinations = project.platforms.length > 0
  const copyReady = hasDestinations && completedTargets === project.platforms.length
  const ready = approved && scheduled && copyReady

  useEffect(() => {
    if (project.platforms.length && !project.platforms.includes(activePlatform)) {
      setActivePlatform(project.platforms[0] ?? "youtube")
    }
  }, [activePlatform, project.platforms])

  function togglePlatform(platform: Platform) {
    if (!canEdit) return
    const selected = project.platforms.includes(platform)
    const next = selected
      ? project.platforms.filter((value) => value !== platform)
      : [...project.platforms, platform]
    updateItem(project.id, { platforms: next })
    if (!selected) setActivePlatform(platform)
    else if (activePlatform === platform) setActivePlatform(next[0] ?? "youtube")
  }

  if (targetsLoading || versionsLoading)
    return (
      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  const activeTarget = targets.find((target) => target.platform === activePlatform)

  return (
    <div className="project-shell">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="page-title">Prepare publishing</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Prepare the files, copy and planned date for each destination. Publishing is
            manual.
          </p>
        </div>
        <Badge variant={ready ? "default" : "secondary"}>
          {ready ? "Ready to publish" : "Not ready"}
        </Badge>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-5">
          <section className="surface-panel p-4 sm:p-5">
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_15rem]">
              <div>
                <h3 className="text-sm font-medium">Destinations</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add only the places this project is actually going.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {platforms.map((platform) => {
                    const selected = project.platforms.includes(platform)
                    return (
                      <Button
                        key={platform}
                        variant={selected ? "secondary" : "outline"}
                        size="sm"
                        aria-pressed={selected}
                        disabled={!canEdit}
                        onClick={() => togglePlatform(platform)}
                      >
                        {selected && <Check />}
                        {platformLabels[platform]}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <label htmlFor="publish-date" className="block space-y-2">
                <span className="text-sm font-medium">Publish date</span>
                <Input
                  id="publish-date"
                  type="datetime-local"
                  value={toLocalDateTime(project.publishAt)}
                  disabled={!canEdit}
                  onChange={(event) => {
                    const date = new Date(event.target.value)
                    updateItem(project.id, {
                      publishAt:
                        event.target.value && !Number.isNaN(date.getTime())
                          ? date.toISOString()
                          : null,
                    })
                  }}
                />
                <span className="block text-xs text-muted-foreground">
                  Uses your local time.
                </span>
              </label>
            </div>
          </section>
          {hasDestinations ? (
            <>
              <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
                {project.platforms.map((platform) => (
                  <button
                    type="button"
                    key={platform}
                    onClick={() => setActivePlatform(platform)}
                    className={cn(
                      "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                      activePlatform === platform &&
                        "bg-background text-foreground shadow-xs",
                    )}
                  >
                    {platformLabels[platform]}
                  </button>
                ))}
              </div>
              {project.platforms.includes(activePlatform) && (
                <TargetEditor
                  key={activePlatform}
                  platform={activePlatform}
                  target={activeTarget}
                  projectTitle={project.title}
                  canEdit={canEdit}
                  onSave={save.mutate}
                  saving={save.isPending && save.variables?.platform === activePlatform}
                  saveFailed={save.isError && save.variables?.platform === activePlatform}
                />
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed px-5 py-14 text-center">
              <PackageCheck className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Choose a destination</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Each selected platform gets its own clean copy package.
              </p>
            </div>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="surface-panel p-4">
            <h3 className="text-sm font-medium">Before publishing</h3>
            <div className="mt-4 space-y-3">
              {(
                [
                  [
                    approved,
                    approved ? `V${latest?.number} approved` : "Approved version",
                  ],
                  [scheduled, "Future publish date"],
                  [hasDestinations, "Destination selected"],
                  [
                    copyReady,
                    hasDestinations
                      ? `${completedTargets}/${project.platforms.length} packages complete`
                      : "Platform copy",
                  ],
                ] as [boolean, string][]
              ).map(([complete, label]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border text-muted-foreground",
                      complete && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {complete && <Check className="size-2.5" />}
                  </span>
                  <span className={cn(!complete && "text-muted-foreground")}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="surface-panel p-4">
            <h3 className="text-sm font-medium">Media to publish</h3>
            {latest ? (
              <>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  V{latest.number} · {latest.fileName || "Version file"}
                </p>
                {latest.downloadUrl ? (
                  <Button
                    className="mt-4 w-full"
                    variant="outline"
                    size="sm"
                    render={<a href={latest.downloadUrl} download={latest.fileName} />}
                  >
                    <Download />
                    Download file
                  </Button>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    This version has no uploaded file.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Add the final version before publishing this project.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  size="sm"
                  render={<Link to="../review" relative="path" />}
                >
                  Add final version
                </Button>
              </>
            )}
          </section>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Automatic publishing is not connected yet. Download the final file and copy
            each platform package to publish it manually.
          </p>
          {save.isPending && (
            <Loader2 className="mx-auto size-3.5 animate-spin text-muted-foreground" />
          )}
        </aside>
      </div>
    </div>
  )
}
