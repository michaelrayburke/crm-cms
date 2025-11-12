
import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'

function deepEqual(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export default function RichTextEditor({ value, onChange, options }) {
  const allowedHeadings = (options?.headings ?? [1,2,3,4]).filter(l => l >= 1 && l <= 6)

  const initialDoc = (value && typeof value === 'object')
    ? value
    : { type: 'doc', content: [{ type: 'paragraph' }] }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: allowedHeadings } }),
      Underline,
      Link.configure({
        openOnClick: false,
        validate: href => {
          try {
            const u = new URL(href.startsWith('http') ? href : `https://${href}`)
            return u.protocol === 'http:' || u.protocol === 'https:'
          } catch { return false }
        }
      }),
    ],
    content: initialDoc,
    onUpdate({ editor }) {
      const json = editor.getJSON()
      if (!deepEqual(json, value)) onChange(json)
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = (value && typeof value === 'object')
      ? value
      : { type: 'doc', content: [{ type: 'paragraph' }] }
    const current = editor.getJSON()
    if (!deepEqual(current, next)) {
      editor.commands.setContent(next, false)
    }
  }, [value, editor])

  if (!editor) return null

  const setLink = () => {
    if (typeof window === 'undefined') return
    const prev = editor.getAttributes('link').href || ''
    const href = window.prompt('Link URL (https://…):', prev || 'https://')
    if (href === null) return
    if (href === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    const normalized = href.startsWith('http://') || href.startsWith('https://') ? href : `https://${href}`
    editor.chain().focus().setLink({ href: normalized, target: '_blank' }).run()
  }

  const Btn = ({ on, active, children, disabled }) => (
    <button
      type="button"
      onClick={on}
      disabled={!!disabled}
      style={{
        padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6,
        background: active ? '#eee' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >{children}</button>
  )

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {allowedHeadings.map(l => (
          <Btn key={l}
            on={() => editor.chain().focus().toggleHeading({ level: l }).run()}
            active={editor.isActive('heading', { level: l })}
          >H{l}</Btn>
        ))}
        <Btn on={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')}>P</Btn>
        <Btn on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>B</Btn>
        <Btn on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>I</Btn>
        <Btn on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>U</Btn>
        <Btn on={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>{'</>'}</Btn>
        <Btn on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>❝❞</Btn>
        <Btn on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>• List</Btn>
        <Btn on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>1. List</Btn>
        <Btn on={() => editor.chain().focus().setHorizontalRule().run()}>HR</Btn>
        <Btn on={setLink} active={editor.isActive('link')}>Link</Btn>
        <Btn on={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')}>Unlink</Btn>
        <Btn on={() => editor.chain().focus().undo().run()}>Undo</Btn>
        <Btn on={() => editor.chain().focus().redo().run()}>Redo</Btn>
        <Btn on={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>Clear</Btn>
      </div>

      <div className="tiptap-editor-surface">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
