/*
  Throwaway CDP harness: screenshots the landing page at several scroll
  positions so the flower's scroll choreography can actually be looked at.
  Chrome headless with SwiftShader, driven over the built-in WebSocket.
*/
import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const PORT = 9333
const BASE = process.argv[2] ?? "http://localhost:4173/"
const OUT = process.argv[3] ?? "."

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--window-size=1440,900",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--user-data-dir=${process.env.TEMP}\\flower-shot-profile`,
    "about:blank",
  ],
  { stdio: "ignore" },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error("Chrome never exposed a debuggable page")
}

const ws = new WebSocket(await findTarget())
await new Promise((r) => ws.addEventListener("open", r, { once: true }))

let nextId = 0
const pending = new Map()
const logs = []
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id !== undefined) {
    const entry = pending.get(msg.id)
    if (!entry) return
    pending.delete(msg.id)
    if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)))
    else entry.resolve(msg.result)
    return
  }
  if (msg.method === "Runtime.consoleAPICalled")
    logs.push(msg.params.args.map((a) => a.value ?? a.description).join(" "))
  if (msg.method === "Log.entryAdded") logs.push(`[${msg.params.entry.level}] ${msg.params.entry.text}`)
  if (msg.method === "Runtime.exceptionThrown")
    logs.push(`[exception] ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description ?? ""}`)
})

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

const evaluate = async (expression) => {
  const { result } = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  return result.value
}

await send("Page.enable")
await send("Runtime.enable")
await send("Log.enable")
await send("Page.navigate", { url: BASE })
await sleep(6000)

console.log("WEBGL:", await evaluate(`(() => {
  const c = document.createElement("canvas")
  const gl = c.getContext("webgl2") || c.getContext("webgl")
  if (!gl) return "none"
  const d = gl.getExtension("WEBGL_debug_renderer_info")
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "ok"
})()`))

if (process.env.PROBE) console.log("PROBE:", await evaluate(process.env.PROBE))

const shots = JSON.parse(process.env.SHOTS ?? '[["top",0]]')
for (const [name, target] of shots) {
  await evaluate(
    typeof target === "number"
      ? `window.scrollTo(0, ${target} * document.body.scrollHeight)`
      : target.startsWith("y:")
        ? `window.scrollTo(0, ${target.slice(2)})`
        : `document.querySelector(${JSON.stringify(target)}).scrollIntoView()`,
  )
  // Let the damped scroll targets settle before capturing.
  await sleep(2500)
  if (process.env.PREP) await evaluate(process.env.PREP)
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    ...(process.env.CLIP ? { clip: { ...JSON.parse(process.env.CLIP), scale: 1 } } : {}),
  })
  writeFileSync(`${OUT}/shot-${name}.png`, Buffer.from(data, "base64"))
  const state = await evaluate(`JSON.stringify({
    scrollY: Math.round(window.scrollY),
    heroTop: Math.round(document.getElementById("top").getBoundingClientRect().top),
    trackTop: Math.round(document.getElementById("workflow-track").getBoundingClientRect().top),
    canvasOpacity: document.querySelector("canvas")?.parentElement.style.opacity,
  })`)
  console.log(name, state)
}

console.log("LOGS:", logs.slice(0, 40).join("\n") || "(none)")
ws.close()
chrome.kill()
