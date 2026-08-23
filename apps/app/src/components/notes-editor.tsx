import { Link } from "@tiptap/extension-link"
import { Placeholder } from "@tiptap/extension-placeholder"
import type { Editor } from "@tiptap/react"
import { EditorContent, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { StarterKit } from "@tiptap/starter-kit"
import { Bold, Code, Italic, Link2, Link2Off, Strikethrough } from "lucide-react"
import { useEffect, useRef } from "react"
import { Markdown } from "tiptap-markdown"
import { cn } from "@/lib/utils"

/**
 * Markdown from the editor, or null while it isn't ready.
 *
 * tiptap-markdown attaches `storage.markdown` at runtime and doesn't declare
 * it, so the cast lives here. The null case is not defensive padding: with a
 * lazily-loaded chunk, `useEditor` hands back an instance whose extensions
 * have not been applied yet, so an effect can run against an editor with an
 * empty storage bag. Returning null lets callers skip that tick rather than
 * throw — and every caller must skip, because treating "not ready" as an
 * empty document would autosave the notes away.
 */
function getMarkdown(editor: Editor): string | null {
  const storage = (editor.storage as unknown as { markdown?: { getMarkdown(): string } })
    .markdown
  return storage ? storage.getMarkdown() : null
}

/**
 * The project's notes — a brief, a hook, reference links.
 *
 * Stored as markdown in `content_items.notes`, not as editor JSON: notes stay
 * greppable, diffable and searchable by Postgres, and nothing here needs
 * blocks a paragraph can't express. The script is the thing that wants rich
 * structure, and it lives on the Review side as a versioned asset.
 *
 * No toolbar. Markdown shortcuts cover structure while typing (`#`, `-`, `>`),
 * and formatting appears on selection — so the page reads as a document until
 * you actually need a control.
 */

const AUTOSAVE_MS = 800

export function NotesEditor({
  value,
  onChange,
  editable = true,
}: {
  value: string
  onChange: (markdown: string) => void
  editable?: boolean
}) {
  // Held in a ref so the debounce closure always sees the current handler
  // without re-creating the timer on every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        // Nothing here needs a horizontal rule, and `---` is a markdown
        // shortcut people hit by accident.
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: "The brief, the hook, links — whatever the team needs.",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Markdown.configure({ transformPastedText: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        // The editor is the page. Padding lives here so the caret sits where
        // the text does, and clicking the margin still focuses the document.
        class: "outline-none min-h-full px-8 py-8 max-w-3xl mx-auto",
      },
    },
    onUpdate: ({ editor }) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const markdown = getMarkdown(editor)
        if (markdown !== null) onChangeRef.current(markdown)
      }, AUTOSAVE_MS)
    },
  })

  /*
    Flush on unmount, or navigating away within the debounce window loses
    whatever was typed last — the most likely moment to lose work, since people
    tab away the instant they stop typing.
  */
  useEffect(() => {
    return () => {
      if (!timer.current || !editor) return
      clearTimeout(timer.current)
      const markdown = getMarkdown(editor)
      if (markdown !== null) onChangeRef.current(markdown)
    }
  }, [editor])

  /*
    Only reset the document when it changes underneath us — a refetch, or
    another tab. Writing `value` back in unconditionally would fight the user's
    cursor on every keystroke, since our own autosave feeds this same prop.
  */
  useEffect(() => {
    if (!editor) return
    const current = getMarkdown(editor)
    // Not ready, or already showing this document.
    if (current === null || current === value) return
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  if (!editor) return null

  return (
    <>
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
      >
        <MarkButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="size-3.5" />
        </MarkButton>
        <MarkButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="size-3.5" />
        </MarkButton>
        <MarkButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </MarkButton>
        <MarkButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          label="Code"
        >
          <Code className="size-3.5" />
        </MarkButton>

        <div className="mx-0.5 h-4 w-px bg-border" />

        <MarkButton
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run()
              return
            }
            const url = window.prompt("Link to")
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          label={editor.isActive("link") ? "Remove link" : "Add link"}
        >
          {editor.isActive("link") ? (
            <Link2Off className="size-3.5" />
          ) : (
            <Link2 className="size-3.5" />
          )}
        </MarkButton>
      </BubbleMenu>

      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </>
  )
}

function MarkButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
