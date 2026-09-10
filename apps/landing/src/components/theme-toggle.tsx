import { MoonIcon, SunIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  )
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)")
    const sync = () => {
      let saved: string | null = null
      try {
        saved = localStorage.getItem("blomstr-landing-theme")
      } catch {
        /* Storage is optional. */
      }
      const next = saved === "dark" || (saved !== "light" && system.matches)
      document.documentElement.classList.toggle("dark", next)
      document.documentElement.style.colorScheme = next ? "dark" : "light"
      setDark(next)
    }
    system.addEventListener("change", sync)
    window.addEventListener("storage", sync)
    return () => {
      system.removeEventListener("change", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = !dark
        setDark(next)
        document.documentElement.classList.toggle("dark", next)
        document.documentElement.style.colorScheme = next ? "dark" : "light"
        try {
          localStorage.setItem("blomstr-landing-theme", next ? "dark" : "light")
        } catch {
          /* Storage is optional. */
        }
      }}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
