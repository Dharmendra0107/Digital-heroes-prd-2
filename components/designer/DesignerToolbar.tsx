'use client'

import { type FC } from 'react'

interface DesignerToolbarProps {
  onAddText: () => void
  onUploadImage: () => void
  onDeleteSelected: () => void
  onClearAll: () => void
  onSave: () => void
  onFontSizeChange: (size: number) => void
  onColorChange: (color: string) => void
  onToggleBold: () => void
  onToggleItalic: () => void
  onFontFamilyChange: (fontFamily: string) => void
  onTrackingChange: (tracking: number) => void
  onFitText: () => void
  onMinFontSizeChange: (size: number) => void
  onMaxFontSizeChange: (size: number) => void
  fontSize: number
  fontFamily: string
  tracking: number
  minFontSize: number
  maxFontSize: number
  color: string
  isBold: boolean
  isItalic: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

const FONT_SIZES = [12, 14, 16, 18, 24, 36, 48]
const COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Amber', value: '#F59E0B' },
]

const DesignerToolbar: FC<DesignerToolbarProps> = ({
  onAddText,
  onUploadImage,
  onDeleteSelected,
  onClearAll,
  onSave,
  onFontSizeChange,
  onColorChange,
  onToggleBold,
  onToggleItalic,
  onFontFamilyChange,
  onTrackingChange,
  onFitText,
  onMinFontSizeChange,
  onMaxFontSizeChange,
  fontSize,
  fontFamily,
  tracking,
  minFontSize,
  maxFontSize,
  color,
  isBold,
  isItalic,
  fileInputRef,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white border-b border-neutral-200">
      {/* Add Text */}
      <button
        type="button"
        onClick={onAddText}
        className="px-3 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
      >
        + Text
      </button>

      {/* Upload Image */}
      <button
        type="button"
        onClick={onUploadImage}
        className="px-3 py-1.5 text-sm font-medium bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
      >
        Upload Logo
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={() => {}}
      />

      <div className="w-px h-6 bg-neutral-200 mx-1" />

      {/* Font Size */}
      <select
        value={fontSize}
        onChange={(e) => onFontSizeChange(Number(e.target.value))}
        className="px-2 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}pt
          </option>
        ))}
      </select>

      <select
        value={fontFamily}
        onChange={(e) => onFontFamilyChange(e.target.value)}
        aria-label="Font family"
        className="px-2 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white"
      >
        {['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'].map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1 text-xs text-neutral-600">
        Tracking
        <input
          type="number"
          min={0}
          max={500}
          step={10}
          value={tracking}
          onChange={(e) => onTrackingChange(Number(e.target.value))}
          className="w-16 px-2 py-1.5 border border-neutral-300 rounded-lg"
          aria-label="Text tracking"
        />
      </label>

      <label className="flex items-center gap-1 text-xs text-neutral-600">
        Min
        <input
          type="number"
          min={6}
          max={maxFontSize}
          value={minFontSize}
          onChange={(e) => onMinFontSizeChange(Number(e.target.value))}
          className="w-14 px-2 py-1.5 border border-neutral-300 rounded-lg"
          aria-label="Minimum fitted font size"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-neutral-600">
        Max
        <input
          type="number"
          min={minFontSize}
          max={200}
          value={maxFontSize}
          onChange={(e) => onMaxFontSizeChange(Number(e.target.value))}
          className="w-14 px-2 py-1.5 border border-neutral-300 rounded-lg"
          aria-label="Maximum fitted font size"
        />
      </label>
      <button
        type="button"
        onClick={onFitText}
        className="px-3 py-1.5 text-xs font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50"
      >
        Fit text
      </button>

      {/* Bold */}
      <button
        type="button"
        onClick={onToggleBold}
        className={`px-3 py-1.5 text-sm font-bold rounded-lg border transition-colors ${
          isBold
            ? 'bg-neutral-800 text-white border-neutral-800'
            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
        }`}
      >
        B
      </button>

      {/* Italic */}
      <button
        type="button"
        onClick={onToggleItalic}
        className={`px-3 py-1.5 text-sm italic rounded-lg border transition-colors ${
          isItalic
            ? 'bg-neutral-800 text-white border-neutral-800'
            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
        }`}
      >
        I
      </button>

      <div className="w-px h-6 bg-neutral-200 mx-1" />

      {/* Color Picker */}
      <div className="flex items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onColorChange(c.value)}
            title={c.label}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c.value ? 'border-amber-500 scale-110' : 'border-neutral-300'
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-neutral-200 mx-1" />

      {/* Delete Selected */}
      <button
        type="button"
        onClick={onDeleteSelected}
        className="px-3 py-1.5 text-sm font-medium bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
      >
        Delete
      </button>

      {/* Clear All */}
      <button
        type="button"
        onClick={onClearAll}
        className="px-3 py-1.5 text-sm font-medium bg-white border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
      >
        Clear
      </button>

      <div className="flex-1" />

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        className="px-5 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
      >
        Save Design
      </button>
    </div>
  )
}

export default DesignerToolbar
