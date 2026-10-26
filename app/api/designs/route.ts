import { randomUUID } from 'node:crypto'
import { type NextRequest } from 'next/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore, updateDemoStore } from '@/lib/demo-store'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import type { Design } from '@/types'
import { renderSinglePagePdfDataUrl } from '@/lib/print-engine/renderPdf'

type ArtworkUploadType = NonNullable<Design['upload_type']>
const UPLOAD_TYPES: readonly ArtworkUploadType[] = ['pdf', 'png', 'svg', 'ai']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: NextRequest) {
  if (isDemoAuthEnabled()) {
    const session = await getAppSession()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'customer') return Response.json({ error: 'Forbidden' }, { status: 403 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!isRecord(body)) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const orderId = typeof body.order_id === 'string' ? body.order_id : ''
    const canvasJson = typeof body.canvas_json === 'string' ? body.canvas_json : undefined
    const uploadUrl = typeof body.upload_url === 'string' ? body.upload_url : undefined
    let thumbnailUrl = typeof body.thumbnail_url === 'string' ? body.thumbnail_url : undefined
    if (
      typeof body.upload_type === 'string' &&
      !UPLOAD_TYPES.includes(body.upload_type as ArtworkUploadType)
    ) {
      return Response.json({ error: 'Unsupported upload_type' }, { status: 400 })
    }
    const uploadType =
      typeof body.upload_type === 'string'
        ? (body.upload_type as ArtworkUploadType)
        : 'png'

    if (!orderId) return Response.json({ error: 'order_id is required' }, { status: 400 })
    if (!canvasJson && !uploadUrl) {
      return Response.json({ error: 'Artwork data is required' }, { status: 400 })
    }
    if ((canvasJson?.length ?? 0) > 2_000_000 || (uploadUrl?.length ?? 0) > 11_200_000 || (thumbnailUrl?.length ?? 0) > 7_000_000) {
      return Response.json({ error: 'Artwork exceeds the local demo size limit' }, { status: 413 })
    }
    if (uploadUrl && !uploadUrl.startsWith('data:')) {
      return Response.json({ error: 'Local demo uploads must include file data' }, { status: 400 })
    }

    try {
      const store = readDemoStore()
      const order = store.orders.find((item) => item.id === orderId)
      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
      if (order.customer_id !== session.userId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (uploadType === 'pdf' && uploadUrl) {
        const config = order.config_snapshot
        const size = config.size as { width_mm?: number; height_mm?: number } | undefined
        try {
          thumbnailUrl = await renderSinglePagePdfDataUrl(
            uploadUrl,
            600,
            Math.max(
              1,
              Math.round(((size?.height_mm ?? 150) / (size?.width_mm ?? 200)) * 600)
            )
          )
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : 'Could not convert PDF artwork' },
            { status: 422 }
          )
        }
      }

      const now = new Date().toISOString()
      const designIndex = store.designs.findIndex((item) => item.order_id === orderId)
      const design: Design = {
        id: designIndex >= 0 ? store.designs[designIndex].id : randomUUID(),
        order_id: orderId,
        customer_id: session.userId,
        canvas_json: canvasJson,
        upload_url: uploadUrl,
        upload_type: uploadType,
        thumbnail_url: thumbnailUrl,
        is_saved: body.is_saved !== false,
        created_at: designIndex >= 0 ? store.designs[designIndex].created_at : now,
        updated_at: now,
      }
      const proofUrl =
        thumbnailUrl ??
        uploadUrl ??
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="280"%3E%3Crect width="100%25" height="100%25" fill="%23fafafa"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" font-family="sans-serif" font-size="20"%3EArtwork proof%3C/text%3E%3C/svg%3E'

      const proof = updateDemoStore((nextStore) => {
        if (designIndex >= 0) nextStore.designs[designIndex] = design
        else nextStore.designs.unshift(design)
        const version =
          Math.max(
            0,
            ...nextStore.proofs
              .filter((item) => item.order_id === orderId)
              .map((item) => item.version)
          ) + 1
        const newProof = {
          id: randomUUID(),
          order_id: orderId,
          version,
          file_url: proofUrl,
          thumbnail_url: thumbnailUrl,
          status: 'pending' as const,
          created_at: now,
        }
        nextStore.proofs.unshift(newProof)
        const storedOrder = nextStore.orders.find((item) => item.id === orderId)
        if (storedOrder) {
          storedOrder.status = 'proof_sent'
          storedOrder.updated_at = now
        }
        return newProof
      })

      return Response.json({ success: true, design, proof }, { status: 201 })
    } catch (error) {
      console.error('[designs POST] failed to save local demo design:', error)
      return Response.json({ error: 'Failed to save local demo design' }, { status: 500 })
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!isRecord(body)) return Response.json({ error: 'Invalid request body' }, { status: 400 })

  const orderId = typeof body.order_id === 'string' ? body.order_id : ''
  const canvasJson = typeof body.canvas_json === 'string' ? body.canvas_json : null
  const uploadUrl = typeof body.upload_url === 'string' ? body.upload_url : null
  if (
    typeof body.upload_type === 'string' &&
    !UPLOAD_TYPES.includes(body.upload_type as ArtworkUploadType)
  ) {
    return Response.json({ error: 'Unsupported upload_type' }, { status: 400 })
  }
  const uploadType =
    typeof body.upload_type === 'string'
      ? (body.upload_type as ArtworkUploadType)
      : 'png'
  let thumbnailUrl = typeof body.thumbnail_url === 'string' ? body.thumbnail_url : null
  const isSaved = typeof body.is_saved === 'boolean' ? body.is_saved : true

  if (!orderId) return Response.json({ error: 'order_id is required' }, { status: 400 })
  if (!canvasJson && !uploadUrl) {
    return Response.json({ error: 'Artwork data is required' }, { status: 400 })
  }
  if (
    (canvasJson?.length ?? 0) > 2_000_000 ||
    (uploadUrl?.length ?? 0) > 11_200_000 ||
    (thumbnailUrl?.length ?? 0) > 7_000_000
  ) {
    return Response.json({ error: 'Artwork exceeds the 8 MB upload limit' }, { status: 413 })
  }

  const adminClient = createSupabaseAdminClient()
  try {
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('customer_id, config_snapshot')
      .eq('id', orderId)
      .maybeSingle()
    if (orderError) {
      console.error('[designs POST] order lookup failed:', orderError)
      return Response.json({ error: 'Could not load the order' }, { status: 500 })
    }
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
    if (order.customer_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

    if (uploadType === 'pdf' && uploadUrl) {
      const config = order.config_snapshot as {
        size?: { width_mm?: number; height_mm?: number }
      }
      try {
        thumbnailUrl = await renderSinglePagePdfDataUrl(
          uploadUrl,
          600,
          Math.max(
            1,
            Math.round(
              ((config.size?.height_mm ?? 150) / (config.size?.width_mm ?? 200)) * 600
            )
          )
        )
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Could not convert PDF artwork' },
          { status: 422 }
        )
      }
    }

    const { data: design, error } = await adminClient
      .from('designs')
      .upsert({
        order_id: orderId,
        customer_id: user.id,
        canvas_json: canvasJson,
        upload_url: uploadUrl,
        upload_type: uploadType,
        thumbnail_url: thumbnailUrl,
        is_saved: isSaved,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !design) {
      console.error('[designs POST] db upsert failed:', error)
      return Response.json({ error: 'Failed to save design' }, { status: 500 })
    }

    const { data: existing } = await adminClient
      .from('proofs')
      .select('version')
      .eq('order_id', orderId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: proof, error: proofError } = await adminClient
      .from('proofs')
      .insert({
        order_id: orderId,
        version: (existing?.version ?? 0) + 1,
        file_url: thumbnailUrl ?? uploadUrl ?? '',
        thumbnail_url: thumbnailUrl,
        status: 'pending',
      })
      .select()
      .single()

    if (proofError || !proof) {
      console.error('[designs POST] proof creation failed:', proofError)
      return Response.json({ error: 'Design saved, but proof creation failed' }, { status: 500 })
    }

    const { error: statusUpdateError } = await adminClient
      .from('orders')
      .update({ status: 'proof_sent' })
      .eq('id', orderId)
    if (statusUpdateError) {
      console.error('[designs POST] order status update failed:', statusUpdateError)
      return Response.json({ error: 'Proof created, but order status update failed' }, { status: 500 })
    }

    return Response.json({ success: true, design, proof }, { status: 201 })
  } catch (err: unknown) {
    console.error('[designs POST] unexpected error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  if (isDemoAuthEnabled()) {
    const session = await getAppSession()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const orderId = request.nextUrl.searchParams.get('order_id')
    try {
      const store = readDemoStore()
      if (orderId) {
        const order = store.orders.find((item) => item.id === orderId)
        if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
        if (session.role !== 'admin' && order.customer_id !== session.userId) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      const designs = store.designs.filter(
        (design) =>
          (session.role === 'admin' || design.customer_id === session.userId) &&
          (!orderId || design.order_id === orderId)
      )
      return Response.json({ designs })
    } catch (error) {
      console.error('[designs GET] failed to read local demo designs:', error)
      return Response.json({ error: 'Failed to fetch local demo designs' }, { status: 500 })
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = request.nextUrl.searchParams.get('order_id')
  let query = supabase.from('designs').select('*').eq('customer_id', user.id)
  if (orderId) query = query.eq('order_id', orderId)
  const { data: designs, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ designs })
}
