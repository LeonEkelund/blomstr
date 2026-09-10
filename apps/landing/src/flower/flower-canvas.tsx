import { useEffect, useRef, useState } from "react"
import type { FlowerScene } from "@/flower/flower-scene"

/** One continuous bloom behind translucent section surfaces. */
export function FlowerCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    let scene: FlowerScene | null = null
    let disposed = false
    let loading = false
    let failed = false
    let visible = false
    const reduced = matchMedia("(prefers-reduced-motion: reduce)")
    const fine = matchMedia("(pointer: fine)")

    const clamp = (value: number) => Math.min(1, Math.max(0, value))
    const updateProgress = () => {
      const track = document.getElementById("workflow-track")?.getBoundingClientRect()
      const workflow = document.getElementById("how-it-works")?.getBoundingClientRect()
      const end = document.getElementById("capabilities")?.getBoundingClientRect()
      const hero = document.getElementById("top")?.getBoundingClientRect()
      if (!track || !workflow || !end || !hero) return
      const mobile = innerWidth < 768
      const entered = clamp((innerHeight * 1.15 - workflow.top) / (innerHeight * 0.6))
      const anchorX = mobile ? 0 : 1.02 - entered * 2.04
      const anchorY = mobile ? 0.48 : 0
      const progress = clamp(
        (innerHeight * 0.5 - track.top) / Math.max(track.height - innerHeight * 0.5, 1),
      )
      const opacity = mobile
        ? clamp(hero.bottom / (innerHeight * 0.6))
        : clamp(end.bottom / innerHeight)
      /*
        Viewport heights scrolled past the top of the hero. Unlike `progress`,
        which is pinned to the workflow track and completes, this keeps rising
        for the whole page — so the bloom is still turning long after it has
        finished opening.
      */
      const spin = Math.max(0, -hero.top) / Math.max(innerHeight, 1)

      host.style.opacity = String(opacity)
      host.style.setProperty("--flower-x", `${50 + anchorX * 22}%`)
      host.style.setProperty("--flower-y", `${50 - anchorY * 28}%`)
      scene?.setTargets({ progress, anchorX, anchorY, spin })
      if (opacity === 0) scene?.stop()
      else if (visible && !document.hidden && !reduced.matches) scene?.start()
    }
    const playback = () => {
      if (!scene) return
      scene.setReducedMotion(reduced.matches)
      updateProgress()
      if (visible && host.style.opacity !== "0" && !document.hidden && !reduced.matches)
        scene.start()
      else {
        scene.stop()
        if (visible) scene.renderStatic()
      }
    }
    const resize = () => {
      if (!scene || !host.clientWidth || !host.clientHeight) return
      scene.resize(host.clientWidth, host.clientHeight)
      updateProgress()
      scene.renderStatic()
    }
    const init = async () => {
      if (loading || scene || failed) return
      loading = true
      try {
        const { FlowerScene } = await import("@/flower/flower-scene")
        if (disposed) return
        scene = new FlowerScene(canvas, {
          isMobile: matchMedia("(max-width: 767px)").matches,
        })
        scene.setReducedMotion(reduced.matches)
        resize()
        scene.renderStatic()
        setReady(true)
        playback()
      } catch {
        scene?.dispose()
        scene = null
        failed = true
        if (!disposed) setReady(false)
      } finally {
        loading = false
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return
      visible = entry.isIntersecting
      if (visible) void init()
      playback()
    })
    observer.observe(document.getElementById("flower-zone") ?? host)
    updateProgress()
    const sizing = new ResizeObserver(resize)
    sizing.observe(host)
    const pointer = (event: PointerEvent) => {
      if (!scene || reduced.matches || !fine.matches) return
      const rect = host.getBoundingClientRect()
      scene.setTargets({
        pointerX: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        pointerY: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      })
    }
    const resetPointer = () => scene?.setTargets({ pointerX: 0, pointerY: 0 })
    const contextLost = () => {
      failed = true
      scene?.dispose()
      scene = null
      setReady(false)
    }
    const section = document.documentElement
    section?.addEventListener("pointermove", pointer)
    section?.addEventListener("pointerleave", resetPointer)
    canvas.addEventListener("webglcontextlost", contextLost)
    window.addEventListener("scroll", updateProgress, { passive: true })
    document.addEventListener("visibilitychange", playback)
    reduced.addEventListener("change", playback)
    return () => {
      disposed = true
      observer.disconnect()
      sizing.disconnect()
      section?.removeEventListener("pointermove", pointer)
      section?.removeEventListener("pointerleave", resetPointer)
      canvas.removeEventListener("webglcontextlost", contextLost)
      window.removeEventListener("scroll", updateProgress)
      document.removeEventListener("visibilitychange", playback)
      reduced.removeEventListener("change", playback)
      scene?.dispose()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden="true"
    >
      {!ready && (
        <img
          src="/flower-fallback.png"
          alt=""
          width="700"
          height="700"
          className="flower-still"
        />
      )}
      <canvas
        ref={canvasRef}
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ opacity: ready ? 1 : 0 }}
      />
    </div>
  )
}
