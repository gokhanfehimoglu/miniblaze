import { useState, useEffect, useCallback, useMemo, useRef, useImperativeHandle, forwardRef } from "react"
import { createEditor, Transforms, Editor, type BaseEditor, type Descendant } from 'slate'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'
import { withHistory } from 'slate-history'
import type { Snippet, WebsiteCommandNode, SnippetBodyNode } from "~types"

type CustomEditor = BaseEditor & ReactEditor
type CustomText = { text: string }
type CustomElement = { type: 'paragraph'; children: CustomText[] }
type ParagraphNode = { type: 'paragraph'; children: (CustomText | WebsiteInline)[] }
type WebsiteInline = {
  type: 'website'
  id: string
  xpath?: string
  urlMatch?: string
  children: CustomText[]
}

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor
    Element: CustomElement
    Text: CustomText
    Inline: WebsiteInline
  }
}

export interface SlateEditorRef {
  insertWebsiteCommand: () => void
}

const SlateSnippetEditor = forwardRef<SlateEditorRef, {
  snippet: Snippet
  onUpdate: (snippet: Snippet) => void
  onCommandSelect: (node: WebsiteCommandNode | null) => void
  selectedCommand: WebsiteCommandNode | null
  onInsertCommand: () => void
}>(({
  snippet,
  onUpdate,
  onCommandSelect,
  selectedCommand,
  onInsertCommand
}, ref) => {
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(selectedCommand?.id || null)

  // Create a new editor instance when the snippet changes to avoid state corruption
  const editor = useMemo(() => {
    const newEditor = withHistory(withReact(createEditor()))

    // Tell Slate that 'website' elements are inline
    newEditor.isInline = (element) => element.type === 'website'

    return newEditor
  }, [snippet.id])

  const [initialValue, setInitialValue] = useState<ParagraphNode[]>(() => {
    const nodes: (CustomText | WebsiteInline)[] = []

    if (snippet && snippet.body && snippet.body.length > 0) {
      snippet.body.forEach(node => {
        if (node.type === "text") {
          if (node.content || node.content === "") {
            nodes.push({ text: node.content || "" })
          }
        } else if (node.type === "website") {
          const commandNode = node as WebsiteCommandNode
          // Add empty text before each command to allow typing before it
          nodes.push({ text: '' })
          nodes.push({
            type: 'website',
            id: commandNode.id,
            xpath: commandNode.xpath,
            urlMatch: commandNode.urlMatch,
            children: [{ text: commandNode.xpath || 'text' }]
          })
        }
      })
    }

    // Add empty text at the end if last node is a command (allows typing after it)
    if (nodes.length > 0 && 'type' in nodes[nodes.length - 1]) {
      nodes.push({ text: '' })
    }

    return [{ type: 'paragraph', children: nodes.length > 0 ? nodes : [{ text: '' }] }]
  })

  const serializeToSlate = useCallback((snippet: Snippet): ParagraphNode[] => {
    if (!snippet || !snippet.body) {
      return [{ type: 'paragraph', children: [{ text: '' }] }]
    }

    const nodes: (CustomText | WebsiteInline)[] = []

    snippet.body.forEach((node, index) => {
      if (node.type === "text") {
        if (node.content || node.content === "") {
          // Split content by newlines and create separate text nodes
          const content = node.content || ""
          const lines = content.split('\n')

          lines.forEach((line, lineIndex) => {
            nodes.push({ text: line })
            // Add newline between lines (except after the last line)
            if (lineIndex < lines.length - 1) {
              nodes.push({ text: '\n' })
            }
          })
        }
      } else if (node.type === "website") {
        const commandNode = node as WebsiteCommandNode
        // Add empty text before each command to allow typing before it
        nodes.push({ text: '' })
        nodes.push({
          type: 'website',
          id: commandNode.id,
          xpath: commandNode.xpath,
          urlMatch: commandNode.urlMatch,
          children: [{ text: commandNode.xpath || 'text' }]
        })
      }
    })

    // Add empty text at the end if last node is a command (allows typing after it)
    if (nodes.length > 0 && 'type' in nodes[nodes.length - 1]) {
      nodes.push({ text: '' })
    }

    return [{ type: 'paragraph', children: nodes.length > 0 ? nodes : [{ text: '' }] }]
  }, [])

  const deserializeFromSlate = useCallback((value: ParagraphNode[]): SnippetBodyNode[] => {
    const body: SnippetBodyNode[] = []

    if (!value || value.length === 0) {
      return [{ type: 'text', content: '' }]
    }

    value.forEach(node => {
      if (node.children) {
        let currentTextContent = ""

        node.children.forEach((child, index) => {
          if ('text' in child && 'type' in child === false) {
            // Accumulate text content, including newlines and empty strings
            currentTextContent += child.text || ""
          } else if ('type' in child && child.type === 'website') {
            // Save accumulated text before website command (even if empty)
            body.push({ type: 'text', content: currentTextContent })
            currentTextContent = ""

            const websiteNode = child as WebsiteInline
            body.push({
              type: 'website',
              id: websiteNode.id,
              xpath: websiteNode.xpath,
              urlMatch: websiteNode.urlMatch
            })
          }
        })

        // Save any remaining text content (even if empty)
        body.push({ type: 'text', content: currentTextContent })
      }
    })

    // Filter out completely empty text nodes at the end if they're just placeholders
    while (body.length > 0 && body[body.length - 1].type === 'text' && body[body.length - 1].content === '') {
      body.pop()
    }

    // Keep at least one text node if everything was filtered
    if (body.length === 0) {
      return [{ type: 'text', content: '' }]
    }

    return body
  }, [])

  // Track the previous snippet body to detect external changes
  const prevBodyRef = useRef<string | null>(null)
  const isEditingRef = useRef(false)

  // Sync local selection state with prop changes
  useEffect(() => {
    if (selectedCommand?.id !== selectedCommandId) {
      setSelectedCommandId(selectedCommand?.id || null)
    }
  }, [selectedCommand?.id])

  // Force re-initialization when snippet ID changes or body changes externally
  useEffect(() => {
    if (snippet && snippet.body && !isEditingRef.current) {
      const serialized = serializeToSlate(snippet)
      const newValue = serialized && serialized.length > 0 ? serialized : [{ type: 'paragraph', children: [{ text: '' }] }]
      const newBodyString = JSON.stringify(snippet.body)

      // Check if snippet ID changed or body content changed externally
      if (editor && editor.children) {
        const currentContent = JSON.stringify(editor.children)
        const bodyChanged = prevBodyRef.current !== newBodyString

        // Update if snippet changed OR body changed externally (but not from typing)
        if (bodyChanged && currentContent !== JSON.stringify(newValue)) {
          editor.children = newValue
          editor.selection = null
          setInitialValue(newValue)
        }

        prevBodyRef.current = newBodyString
      }
    }
  }, [snippet.id, JSON.stringify(snippet.body)])

  // Track editing state to prevent interference with user typing
  const handleFocus = () => {
    isEditingRef.current = true
  }

  const handleBlur = () => {
    isEditingRef.current = false
  }

  const handleChange = (value: ParagraphNode[]) => {
    const body = deserializeFromSlate(value)
    onUpdate({ ...snippet, body })
  }

  const handleWebsiteClick = (websiteNode: WebsiteInline) => {
    setSelectedCommandId(websiteNode.id)
    const commandNode: WebsiteCommandNode = {
      type: 'website',
      id: websiteNode.id,
      xpath: websiteNode.xpath,
      urlMatch: websiteNode.urlMatch
    }
    onCommandSelect(commandNode)
  }

  const insertWebsiteCommand = () => {
    const id = crypto.randomUUID()
    const websiteNode: WebsiteInline = {
      type: 'website',
      id,
      children: [{ text: 'text' }]
    }

    // Check if editor is empty
    const isEmpty = editor.children.length === 1 &&
      Editor.string(editor, []) === ''

    if (isEmpty) {
      // Insert text before and after the inline element to allow newlines
      Transforms.insertNodes(editor, [
        { text: '' },
        websiteNode,
        { text: '' }
      ])
    } else {
      // Insert the command at the current cursor position
      Transforms.insertNodes(editor, websiteNode)
    }

    // Select the newly inserted command
    setSelectedCommandId(id)

    // Create the command node for the parent component
    const commandNode: WebsiteCommandNode = {
      type: 'website',
      id
    }
    onCommandSelect(commandNode)
  }

  // Expose the insert function to parent via ref
  useImperativeHandle(ref, () => ({
    insertWebsiteCommand
  }))

  const deleteWebsiteCommand = (id: string) => {
    Transforms.removeNodes(editor, {
      at: [],
      match: (node): node is WebsiteInline =>
        'type' in node && node.type === 'website' && 'id' in node && node.id === id
    })
    if (selectedCommandId === id) {
      setSelectedCommandId(null)
      onCommandSelect(null) // Notify parent to switch back to command list
    }
  }

  const Leaf = ({ attributes, children }: any) => {
    return <span {...attributes}>{children}</span>
  }

  const WebsiteElement = ({
    attributes,
    children,
    element
  }: {
    attributes: any
    children: any
    element: WebsiteInline
  }) => {
    const isSelected = selectedCommandId === element.id

    return (
      <span
        {...attributes}
        contentEditable={false}
        className={`plasmo-inline-flex plasmo-items-center plasmo-gap-1 plasmo-px-2 plasmo-py-1 plasmo-rounded-md plasmo-text-sm plasmo-cursor-pointer plasmo-transition-colors ${
          isSelected
            ? 'plasmo-bg-blue-100 plasmo-border-2 plasmo-border-blue-500'
            : 'plasmo-bg-gray-100 hover:plasmo-bg-gray-200'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          handleWebsiteClick(element)
        }}
      >
        <span className="plasmo-font-mono plasmo-max-w-[150px] plasmo-overflow-hidden plasmo-text-ellipsis plasmo-whitespace-nowrap">
          {element.xpath || 'text'}
        </span>
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteWebsiteCommand(element.id)
            }}
            className="plasmo-ml-1 plasmo-text-red-500 hover:plasmo-text-red-700 plasmo-font-bold"
          >
            ×
          </button>
        )}
        <span className="group plasmo-relative plasmo-ml-1">
          <span className="plasmo-text-gray-400">ⓘ</span>
          <span className="plasmo-absolute plasmo-bottom-full plasmo-left-0 plasmo-mb-2 plasmo-hidden group-hover:plasmo-block plasmo-bg-black plasmo-text-white plasmo-text-xs plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-whitespace-nowrap plasmo-z-50">
            {element.urlMatch || 'No URL pattern set'}
          </span>
        </span>
      </span>
    )
  }

  const renderElement = useCallback((props: any) => {
    const { element, children, attributes } = props

    // Check if this is an inline element
    if (element.type === 'website') {
      return <WebsiteElement element={element} attributes={attributes} children={children} />
    }

    // Default block element
    return <p {...attributes}>{children}</p>
  }, [selectedCommandId])

  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />
  }, [])

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-h-full">
      <div className="plasmo-space-y-4 plasmo-mb-4">
        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">Name</label>
          <input
            type="text"
            value={snippet.name}
            onChange={(e) => onUpdate({ ...snippet, name: e.target.value })}
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
            placeholder="Snippet name"
          />
        </div>
        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">Shortcut</label>
          <input
            type="text"
            value={snippet.shortcut}
            onChange={(e) => onUpdate({ ...snippet, shortcut: e.target.value })}
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
            placeholder="/shortcut"
          />
        </div>
      </div>

      <div className="plasmo-flex-1 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-p-4 plasmo-overflow-y-auto">
        <div
          onClick={(e) => {
            // Check if the click target is outside of website elements
            const target = e.target as HTMLElement
            const isWebsiteElement = target.closest('.plasmo-bg-blue-100, .plasmo-bg-gray-100')

            if (!isWebsiteElement && selectedCommandId) {
              setSelectedCommandId(null)
              onCommandSelect(null) // Notify parent to switch back to command list
            }
          }}
        >
        <Slate
          key={snippet.id}
          editor={editor}
          initialValue={initialValue}
          onChange={handleChange}
        >
          <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            className="plasmo-w-full plasmo-min-h-[200px] plasmo-p-3 plasmo-border plasmo-border-gray-200 plasmo-rounded-md focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 plasmo-whitespace-pre-wrap"
            placeholder="Enter snippet body..."
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                editor.insertText('\n')
              }
            }}
          />
        </Slate>
        </div>
      </div>
    </div>
  )
})

SlateSnippetEditor.displayName = 'SlateSnippetEditor'

export default SlateSnippetEditor