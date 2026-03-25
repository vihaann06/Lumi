'use client'

import React, { useState } from 'react'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Link, Image, Minus, Plus, ChevronDown, Printer, Undo, Redo, PaintBucket, Type, Highlighter, MoreVertical } from 'lucide-react'

type WriterProps = {
  fileName: string
  content: string
  onChangeContent: (val: string) => void
}

export default function Writer({ fileName, content, onChangeContent }: WriterProps) {
  const [zoom, setZoom] = useState(100)
  const [font, setFont] = useState('Arial')
  const [fontSize, setFontSize] = useState('11')

  const fonts = ['Arial', 'Calibri', 'Comic Sans MS', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana']
  const fontSizes = ['8', '9', '10', '11', '12', '14', '18', '24', '30', '36']

  return (
    <div className="h-full flex flex-col bg-[#f9fbfd]">
      {/* Top Bar */}
      <div className="bg-[#f9fbfd] border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white rounded border border-gray-300 flex items-center justify-center">
                <div className="w-6 h-7 bg-blue-500 rounded-sm"></div>
              </div>
              <div>
                <input
                  type="text"
                  value={fileName || 'Untitled document'}
                  className="text-[18px] text-gray-800 bg-transparent border-none outline-none hover:border hover:border-gray-300 px-1 rounded"
                  readOnly
                />
                <div className="flex items-center gap-3 text-[13px] text-gray-600">
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">File</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Edit</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">View</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Insert</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Format</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Tools</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Extensions</button>
                  <button className="hover:bg-gray-100 px-2 py-0.5 rounded">Help</button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded font-medium">
              Share
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <MoreVertical className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[#edf2fa] border-b border-gray-300 px-4 py-2">
        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Undo">
            <Undo className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Redo">
            <Redo className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Print">
            <Printer className="h-5 w-5 text-gray-700" />
          </button>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1 hover:bg-gray-200 rounded">
              <Minus className="h-4 w-4 text-gray-700" />
            </button>
            <span className="text-sm text-gray-700 w-12 text-center">{zoom}%</span>
            <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1 hover:bg-gray-200 rounded">
              <Plus className="h-4 w-4 text-gray-700" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Font Family */}
          <select 
            value={font}
            onChange={(e) => setFont(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 cursor-pointer min-w-[140px]"
          >
            {fonts.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          {/* Font Size */}
          <select 
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 cursor-pointer w-16"
          >
            {fontSizes.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Text Formatting */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Bold">
            <Bold className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Italic">
            <Italic className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Underline">
            <Underline className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded flex items-center" title="Text color">
            <Type className="h-5 w-5 text-gray-700" />
            <ChevronDown className="h-3 w-3 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded flex items-center" title="Highlight">
            <Highlighter className="h-5 w-5 text-gray-700" />
            <ChevronDown className="h-3 w-3 text-gray-700" />
          </button>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Insert */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Insert link">
            <Link className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Insert image">
            <Image className="h-5 w-5 text-gray-700" />
          </button>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Alignment */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Align left">
            <AlignLeft className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Align center">
            <AlignCenter className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Align right">
            <AlignRight className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Justify">
            <AlignJustify className="h-5 w-5 text-gray-700" />
          </button>

          <div className="w-px h-6 bg-gray-400 mx-1"></div>

          {/* Lists */}
          <button className="p-2 hover:bg-gray-200 rounded" title="Bulleted list">
            <List className="h-5 w-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded" title="Numbered list">
            <ListOrdered className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Document Area */}
      <div className="flex-1 overflow-auto bg-[#f9fbfd] py-6">
        <div className="mx-auto bg-white shadow-lg" style={{ 
          width: `${8.5 * zoom}px`,
          minHeight: `${11 * zoom}px`,
          padding: `${zoom}px`,
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top center'
        }}>
          <textarea
            value={content}
            onChange={(e) => onChangeContent(e.target.value)}
            placeholder="Start typing..."
            className="w-full min-h-[1056px] resize-none outline-none text-gray-900 leading-relaxed"
            style={{
              fontFamily: font,
              fontSize: `${fontSize}pt`,
              lineHeight: '1.5'
            }}
          />
        </div>
      </div>
    </div>
  )
}