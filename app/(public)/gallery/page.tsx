'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DIVISIONS } from '@/lib/products'
import type { Division } from '@/types'

interface GalleryItem {
  id: string
  title: string
  division: Division
  client: string
  specs: string
  description: string
  color: string
}

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: '1',
    title: 'Artisan Coffee Roasters Gloss Labels',
    division: 'labels-stickers',
    client: 'Summit Brew Co.',
    specs: '100×50mm · Gloss Vinyl · Waterproof',
    description: 'Vibrant full-bleed packaging labels with metallic gold accent simulation.',
    color: 'from-amber-400 to-orange-500',
  },
  {
    id: '2',
    title: 'Alpine Enduro 2026 Race Bibs',
    division: 'race-event-numbers',
    client: 'High Country Events',
    specs: '200×150mm · Tyvek · Variable QR & Names',
    description: 'Weatherproof numbers merged with runner category and dynamic timing barcodes.',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: '3',
    title: 'Trail Head Wayfinding Markers',
    division: 'mtb-boards',
    client: 'Peak District Trail Alliance',
    specs: '450×300mm · 4mm Corflute · UV Print',
    description: 'High-contrast trail indicators built to survive harsh outdoor weather and UV.',
    color: 'from-emerald-500 to-teal-700',
  },
  {
    id: '4',
    title: 'Official Document Inspection Stamp',
    division: 'stamps',
    client: 'Atlas Engineering Ltd',
    specs: '58×22mm · Self-Inking · Blue Ink',
    description: 'High-precision micro-text border with custom authorization signatures.',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: '5',
    title: 'National Cycling Championship Trophy',
    division: 'trophies',
    client: 'Velosport Federation',
    specs: '150×200mm · 10mm Clear Acrylic · Beveled',
    description: 'Deep optical laser engraving with frosted finish on solid timber base.',
    color: 'from-purple-500 to-pink-600',
  },
  {
    id: '6',
    title: 'Architectural Geometric Wall Panels',
    division: 'laser-cut-work',
    client: 'Form & Void Studio',
    specs: 'A3 (297×420mm) · 3mm Birch Ply',
    description: 'Intricate vector lattice design cut with 0.1mm kerf precision.',
    color: 'from-stone-600 to-neutral-800',
  },
  {
    id: '7',
    title: 'Craft Beer Matte Can Labels',
    division: 'labels-stickers',
    client: 'Hop Craft Brewery',
    specs: '150×100mm · Matte Vinyl · UV Resistant',
    description: 'Velvety non-reflective finish with scuff-resistant protective laminate.',
    color: 'from-amber-500 to-yellow-600',
  },
  {
    id: '8',
    title: 'Gran Fondo Downhill MTB Number Plates',
    division: 'mtb-boards',
    client: 'Gravity League',
    specs: '300×200mm · Pre-slotted Zip-tie Mounts',
    description: 'Flexible impact-resistant polymer plates ready for handlebars.',
    color: 'from-lime-500 to-emerald-600',
  },
]

export default function GalleryPage() {
  const [selectedDivision, setSelectedDivision] = useState<string>('all')

  const filteredItems =
    selectedDivision === 'all'
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter((item) => item.division === selectedDivision)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 mb-3">
          Live Work Gallery
        </h1>
        <p className="text-neutral-600 text-sm sm:text-base">
          Browse examples of real print, engraving, and laser-cut jobs produced across our six divisions.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
        <button
          onClick={() => setSelectedDivision('all')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
            selectedDivision === 'all'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          All Divisions ({GALLERY_ITEMS.length})
        </button>
        {DIVISIONS.map((division) => {
          const count = GALLERY_ITEMS.filter((i) => i.division === division.slug).length
          return (
            <button
              key={division.slug}
              onClick={() => setSelectedDivision(division.slug)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                selectedDivision === division.slug
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              {division.name} {count > 0 && `(${count})`}
            </button>
          )
        })}
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const divisionObj = DIVISIONS.find((d) => d.slug === item.division)
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Visual Preview Banner */}
              <div
                className={`h-48 bg-gradient-to-br ${item.color} p-6 flex flex-col justify-between text-white`}
              >
                <div className="flex items-center justify-between">
                  <span className="bg-black/30 backdrop-blur-sm text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded">
                    {divisionObj?.name}
                  </span>
                  <span className="text-xs text-white/80 font-mono">300 DPI</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/75 font-semibold">Client</p>
                  <p className="font-medium text-sm">{item.client}</p>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base mb-1">{item.title}</h3>
                  <p className="text-xs font-mono text-amber-600 mb-3">{item.specs}</p>
                  <p className="text-sm text-neutral-600 leading-relaxed mb-4">{item.description}</p>
                </div>

                <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                  <Link
                    href={`/products/${item.division}`}
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    Configure this product &rarr;
                  </Link>
                  <span className="text-[11px] text-neutral-400">Order Ready</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
