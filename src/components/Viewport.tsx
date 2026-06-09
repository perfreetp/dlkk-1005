import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Empty, Popover, Progress, Button } from 'antd'
import { PlusOutlined, PictureOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Annotation, AnnotationTool, Series, ViewportState } from '@/types'
import { useAppStore } from '@/stores/appStore'

interface ViewportProps {
  viewport: ViewportState
  isActive: boolean
  onClick: () => void
  onAssignSeries: (seriesId: string) => void
  studySeries: Series[]
  currentTool: AnnotationTool
  annotations: Annotation[]
  onAddAnnotation: (ann: Partial<Annotation> & { tool: AnnotationTool; points: { x: number; y: number }[] }) => void
  onDeleteAnnotation: (id: string) => void
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void
}

interface DrawState {
  drawing: boolean
  points: { x: number; y: number }[]
  tempPoints?: { x: number; y: number }
}

const Viewport: React.FC<ViewportProps> = ({
  viewport,
  isActive,
  onClick,
  onAssignSeries,
  studySeries,
  currentTool,
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
  onUpdateAnnotation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 600, h: 500 })
  const [isDragOver, setIsDragOver] = useState(false)
  const [drawState, setDrawState] = useState<DrawState>({ drawing: false, points: [] })
  const [hoverAnnotation, setHoverAnnotation] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [pixelValue, setPixelValue] = useState<number>(0)
  const [showSeriesPicker, setShowSeriesPicker] = useState(false)
  const magnifierPos = useRef({ x: 0.5, y: 0.5 })

  const series = studySeries.find((s) => s.id === viewport.seriesId)
  const { updateViewport } = useAppStore()

  const imageSize = useMemo(() => {
    const maxImgW = series?.columns || 512
    const maxImgH = series?.rows || 512
    const scale = viewport.zoom
    const rot = (viewport.rotation * Math.PI) / 180
    const cos = Math.abs(Math.cos(rot))
    const sin = Math.abs(Math.sin(rot))
    const w = (maxImgW * cos + maxImgH * sin) * scale
    const h = (maxImgW * sin + maxImgH * cos) * scale
    return { w, h, baseW: maxImgW, baseH: maxImgH }
  }, [series, viewport.zoom, viewport.rotation])

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ w: width, h: height })
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size.w
    canvas.height = size.h

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, size.w, size.h)

    if (!series) return

    const cx = size.w / 2 + viewport.panX
    const cy = size.h / 2 + viewport.panY

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((viewport.rotation * Math.PI) / 180)
    ctx.scale(viewport.flippedH ? -1 : 1, viewport.flippedV ? -1 : 1)

    // Draw simulated image based on series index and image position
    const seriesIdx = studySeries.findIndex((s) => s.id === series.id)
    drawMedicalImage(ctx, imageSize.w, imageSize.h, seriesIdx, viewport.imageIndex, viewport.windowWidth, viewport.windowCenter, viewport.inverted)

    ctx.restore()

    // Draw annotations in image space (not affected by transform)
    drawAnnotations(ctx)
  }, [size, series, viewport, annotations, drawState, mousePos, currentTool, hoverAnnotation, imageSize, studySeries])

  const drawMedicalImage = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sIdx: number,
    imgIdx: number,
    ww: number,
    wc: number,
    inverted: boolean
  ) => {
    const halfW = w / 2
    const halfH = h / 2

    // Create gradient background (air/soft tissue gradient)
    const bgGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 1.2)
    const base = sIdx % 3
    if (base === 0) {
      // Chest-like
      bgGrad.addColorStop(0, '#1a2530')
      bgGrad.addColorStop(0.6, '#0e1820')
      bgGrad.addColorStop(1, '#050810')
    } else if (base === 1) {
      // Brain-like
      bgGrad.addColorStop(0, '#252520')
      bgGrad.addColorStop(0.7, '#141410')
      bgGrad.addColorStop(1, '#080806')
    } else {
      // Abdomen-like
      bgGrad.addColorStop(0, '#1e1a15')
      bgGrad.addColorStop(0.65, '#120f0c')
      bgGrad.addColorStop(1, '#060504')
    }
    ctx.fillStyle = bgGrad
    ctx.fillRect(-halfW, -halfH, w, h)

    // Draw organ/body structures
    const seed = sIdx * 100 + imgIdx
    ctx.globalAlpha = 0.85

    // Body outline
    ctx.beginPath()
    if (base === 0) {
      // Ribcage ellipse
      ctx.ellipse(0, 0, halfW * 0.78, halfH * 0.9, 0, 0, Math.PI * 2)
    } else if (base === 1) {
      // Skull
      ctx.ellipse(0, 0, halfW * 0.85, halfH * 0.88, 0, 0, Math.PI * 2)
    } else {
      // Abdomen
      ctx.ellipse(0, 0, halfW * 0.72, halfH * 0.85, 0, 0, Math.PI * 2)
    }
    const bodyGrad = ctx.createRadialGradient(0, -halfH * 0.1, 10, 0, 0, halfW * 0.8)
    if (base === 0) {
      bodyGrad.addColorStop(0, '#2a3a4a')
      bodyGrad.addColorStop(0.5, '#1a2a35')
      bodyGrad.addColorStop(1, '#0f1a22')
    } else if (base === 1) {
      bodyGrad.addColorStop(0, '#3a3528')
      bodyGrad.addColorStop(0.5, '#28251e')
      bodyGrad.addColorStop(1, '#181612')
    } else {
      bodyGrad.addColorStop(0, '#302520')
      bodyGrad.addColorStop(0.5, '#231b17')
      bodyGrad.addColorStop(1, '#14100d')
    }
    ctx.fillStyle = bodyGrad
    ctx.fill()

    // Specific structures
    if (base === 0) {
      // Lungs - dark areas
      ctx.globalAlpha = 0.9
      ctx.fillStyle = '#060a0e'
      ctx.beginPath()
      ctx.ellipse(-halfW * 0.32, -halfH * 0.05, halfW * 0.24, halfH * 0.38, -0.08, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(halfW * 0.32, -halfH * 0.05, halfW * 0.24, halfH * 0.38, 0.08, 0, Math.PI * 2)
      ctx.fill()

      // Lung vessels (bright lines)
      ctx.strokeStyle = 'rgba(140,180,210,0.25)'
      ctx.lineWidth = 0.8
      for (let i = 0; i < 15; i++) {
        const a = (Math.PI * 2 * (seed + i)) / 31
        const len = 20 + ((seed + i * 7) % 60)
        const sx = (i % 2 === 0 ? -1 : 1) * halfW * (0.2 + ((seed + i) % 8) / 40)
        const sy = -halfH * 0.05 + ((seed + i * 3) % 100) - 50
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len)
        ctx.stroke()
      }

      // Mediastinum / heart
      ctx.globalAlpha = 0.8
      const heartGrad = ctx.createRadialGradient(0, halfH * 0.1, 5, 0, halfH * 0.1, halfW * 0.2)
      heartGrad.addColorStop(0, '#6a5540')
      heartGrad.addColorStop(0.6, '#453528')
      heartGrad.addColorStop(1, '#2a1e15')
      ctx.fillStyle = heartGrad
      ctx.beginPath()
      ctx.ellipse(0, halfH * 0.12, halfW * 0.18, halfH * 0.28, 0.1, 0, Math.PI * 2)
      ctx.fill()

      // Spine
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#c8b090'
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath()
        ctx.ellipse(0, i * halfH * 0.12, halfW * 0.035, halfH * 0.04, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (base === 1) {
      // Brain hemispheres
      ctx.globalAlpha = 0.7
      const brainGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, halfW * 0.7)
      brainGrad.addColorStop(0, '#4a4535')
      brainGrad.addColorStop(0.7, '#302a20')
      brainGrad.addColorStop(1, '#1a1710')
      ctx.fillStyle = brainGrad
      ctx.beginPath()
      ctx.ellipse(0, 0, halfW * 0.65, halfH * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()

      // Ventricles
      ctx.globalAlpha = 0.4
      ctx.fillStyle = '#1a1508'
      ctx.beginPath()
      ctx.ellipse(0, 0, halfW * 0.12, halfH * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()

      // Skull bone
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = '#b0a080'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.ellipse(0, 0, halfW * 0.82, halfH * 0.85, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      // Abdominal organs
      ctx.globalAlpha = 0.7
      // Liver
      const liverGrad = ctx.createRadialGradient(-halfW * 0.25, -halfH * 0.1, 5, -halfW * 0.25, -halfH * 0.1, halfW * 0.35)
      liverGrad.addColorStop(0, '#5a4030')
      liverGrad.addColorStop(0.7, '#3a2a1e')
      liverGrad.addColorStop(1, '#251812')
      ctx.fillStyle = liverGrad
      ctx.beginPath()
      ctx.ellipse(-halfW * 0.25, -halfH * 0.1, halfW * 0.32, halfH * 0.28, -0.15, 0, Math.PI * 2)
      ctx.fill()

      // Spleen
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#4a2030'
      ctx.beginPath()
      ctx.ellipse(halfW * 0.35, -halfH * 0.12, halfW * 0.14, halfH * 0.3, 0.2, 0, Math.PI * 2)
      ctx.fill()

      // Spine
      ctx.globalAlpha = 0.55
      ctx.fillStyle = '#b89a70'
      for (let i = -2; i <= 3; i++) {
        ctx.beginPath()
        ctx.ellipse(0, i * halfH * 0.12 + halfH * 0.05, halfW * 0.04, halfH * 0.045, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Bowel pattern
      ctx.globalAlpha = 0.25
      ctx.strokeStyle = '#3a2a20'
      ctx.lineWidth = 2
      for (let i = 0; i < 12; i++) {
        const rx = -halfW * 0.4 + ((seed + i * 13) % 500) / 500 * halfW * 0.8
        const ry = halfH * 0.0 + ((seed * 3 + i * 19) % 400) / 400 * halfH * 0.6
        ctx.beginPath()
        ctx.ellipse(rx, ry, 8 + (i % 5) * 2, 10 + (i % 4) * 3, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Apply window width/level via overlay
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 1
    const wlNormalized = Math.min(1, Math.max(0, (wc + 1024) / 2048))
    const wwNormalized = Math.min(2, Math.max(0.1, ww / 2000))
    const wlColor = `rgba(${Math.floor(255 * wlNormalized * 0.5 + 64)}, ${Math.floor(255 * wlNormalized * 0.5 + 64)}, ${Math.floor(255 * wlNormalized * 0.5 + 64)}, ${wwNormalized * 0.15})`
    ctx.fillStyle = wlColor
    ctx.fillRect(-halfW, -halfH, w, h)

    if (inverted) {
      ctx.globalCompositeOperation = 'difference'
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = 1
      ctx.fillRect(-halfW, -halfH, w, h)
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  const getImageCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0, inImage: false, imgX: 0, imgY: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const cx = size.w / 2 + viewport.panX
    const cy = size.h / 2 + viewport.panY
    let lx = x - cx
    let ly = y - cy
    const rot = -(viewport.rotation * Math.PI) / 180
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const rx = lx * cos - ly * sin
    const ry = lx * sin + ly * cos
    const scale = 1 / viewport.zoom
    let imgX = rx * scale * (viewport.flippedH ? -1 : 1)
    let imgY = ry * scale * (viewport.flippedV ? -1 : 1)
    const inImage =
      Math.abs(imgX) <= (series?.columns || 512) / 2 &&
      Math.abs(imgY) <= (series?.rows || 512) / 2
    return { x, y, inImage, imgX, imgY }
  }

  const drawAnnotations = (ctx: CanvasRenderingContext2D) => {
    const activeColor = '#ffeb3b'

    // Draw all existing annotations
    annotations.forEach((ann) => {
      ctx.save()
      ctx.strokeStyle = ann.id === hoverAnnotation ? '#ffffff' : ann.color
      ctx.fillStyle = ann.color
      ctx.lineWidth = ann.thickness
      ctx.font = `${ann.fontSize || 14}px "Consolas", sans-serif`

      const toCanvas = (p: { x: number; y: number }) => {
        const cx = size.w / 2 + viewport.panX
        const cy = size.h / 2 + viewport.panY
        const s = viewport.zoom
        const rot = (viewport.rotation * Math.PI) / 180
        const tx = p.x * s * (viewport.flippedH ? -1 : 1)
        const ty = p.y * s * (viewport.flippedV ? -1 : 1)
        const rx = tx * Math.cos(rot) - ty * Math.sin(rot)
        const ry = tx * Math.sin(rot) + ty * Math.cos(rot)
        return { x: cx + rx, y: cy + ry }
      }

      switch (ann.tool) {
        case 'length': {
          if (ann.points.length >= 2) {
            const p1 = toCanvas(ann.points[0])
            const p2 = toCanvas(ann.points[1])
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
            // end caps
            const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x)
            const perp = ang + Math.PI / 2
            ;[p1, p2].forEach((p) => {
              ctx.beginPath()
              ctx.moveTo(p.x + Math.cos(perp) * 6, p.y + Math.sin(perp) * 6)
              ctx.lineTo(p.x - Math.cos(perp) * 6, p.y - Math.sin(perp) * 6)
              ctx.stroke()
            })
            const dx = (ann.points[1].x - ann.points[0].x) * 0.5
            const dy = (ann.points[1].y - ann.points[0].y) * 0.5
            const dist = Math.sqrt(dx * dx + dy * dy)
            const pxMm = 0.35
            const mid = toCanvas({ x: ann.points[0].x + dx, y: ann.points[0].y + dy })
            ctx.fillStyle = '#000000'
            const label = `${(dist * pxMm).toFixed(2)} mm`
            const tw = ctx.measureText(label).width
            ctx.fillRect(mid.x - tw / 2 - 4, mid.y - 10, tw + 8, 18)
            ctx.fillStyle = activeColor
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(label, mid.x, mid.y)
          }
          break
        }
        case 'angle': {
          if (ann.points.length >= 3) {
            const p1 = toCanvas(ann.points[0])
            const v = toCanvas(ann.points[1])
            const p2 = toCanvas(ann.points[2])
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(v.x, v.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
            // angle arc
            const a1 = Math.atan2(p1.y - v.y, p1.x - v.x)
            const a2 = Math.atan2(p2.y - v.y, p2.x - v.x)
            let angle = Math.abs(a2 - a1) * (180 / Math.PI)
            if (angle > 180) angle = 360 - angle
            ctx.beginPath()
            ctx.arc(v.x, v.y, 30, a1, a2, Math.abs(a2 - a1) > Math.PI)
            ctx.stroke()
            const midAng = (a1 + a2) / 2
            const lx = v.x + Math.cos(midAng) * 45
            const ly = v.y + Math.sin(midAng) * 45
            const label = `${angle.toFixed(1)}°`
            const tw = ctx.measureText(label).width
            ctx.fillStyle = '#000000'
            ctx.fillRect(lx - tw / 2 - 4, ly - 10, tw + 8, 18)
            ctx.fillStyle = activeColor
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(label, lx, ly)
          }
          break
        }
        case 'area':
        case 'freehand': {
          if (ann.points.length >= 3) {
            ctx.beginPath()
            const first = toCanvas(ann.points[0])
            ctx.moveTo(first.x, first.y)
            for (let i = 1; i < ann.points.length; i++) {
              const p = toCanvas(ann.points[i])
              ctx.lineTo(p.x, p.y)
            }
            ctx.closePath()
            ctx.globalAlpha = 0.15
            ctx.fillStyle = activeColor
            ctx.fill()
            ctx.globalAlpha = 1
            ctx.stroke()
            // calculate area
            let area = 0
            const pxMm = 0.35
            for (let i = 0; i < ann.points.length; i++) {
              const p1 = ann.points[i]
              const p2 = ann.points[(i + 1) % ann.points.length]
              area += (p1.x * p2.y - p2.x * p1.y) / 2
            }
            area = Math.abs(area) * pxMm * pxMm
            const cx = ann.points.reduce((s, p) => s + p.x, 0) / ann.points.length
            const cy = ann.points.reduce((s, p) => s + p.y, 0) / ann.points.length
            const center = toCanvas({ x: cx, y: cy })
            const label = `${area.toFixed(2)} mm²`
            const tw = ctx.measureText(label).width
            ctx.fillStyle = '#000000'
            ctx.fillRect(center.x - tw / 2 - 4, center.y - 10, tw + 8, 18)
            ctx.fillStyle = activeColor
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(label, center.x, center.y)
          }
          break
        }
        case 'rectangle': {
          if (ann.points.length >= 2) {
            const p1 = toCanvas(ann.points[0])
            const p2 = toCanvas(ann.points[1])
            const x = Math.min(p1.x, p2.x)
            const y = Math.min(p1.y, p2.y)
            const w = Math.abs(p2.x - p1.x)
            const h = Math.abs(p2.y - p1.y)
            ctx.strokeRect(x, y, w, h)
          }
          break
        }
        case 'ellipse': {
          if (ann.points.length >= 2) {
            const p1 = toCanvas(ann.points[0])
            const p2 = toCanvas(ann.points[1])
            const cx = (p1.x + p2.x) / 2
            const cy = (p1.y + p2.y) / 2
            const rx = Math.abs(p2.x - p1.x) / 2
            const ry = Math.abs(p2.y - p1.y) / 2
            ctx.beginPath()
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
            ctx.stroke()
          }
          break
        }
        case 'arrow': {
          if (ann.points.length >= 2) {
            const p1 = toCanvas(ann.points[0])
            const p2 = toCanvas(ann.points[1])
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
            const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x)
            const headLen = 14
            ctx.beginPath()
            ctx.moveTo(p2.x, p2.y)
            ctx.lineTo(
              p2.x - headLen * Math.cos(ang - Math.PI / 6),
              p2.y - headLen * Math.sin(ang - Math.PI / 6)
            )
            ctx.lineTo(
              p2.x - headLen * Math.cos(ang + Math.PI / 6),
              p2.y - headLen * Math.sin(ang + Math.PI / 6)
            )
            ctx.closePath()
            ctx.fillStyle = activeColor
            ctx.fill()
          }
          break
        }
        case 'text': {
          if (ann.points.length >= 1 && ann.text) {
            const p = toCanvas(ann.points[0])
            const fs = ann.fontSize || 16
            ctx.font = `bold ${fs}px "PingFang SC", sans-serif`
            const tw = ctx.measureText(ann.text).width
            ctx.fillStyle = 'rgba(0,0,0,0.7)'
            ctx.fillRect(p.x - 2, p.y - fs + 2, tw + 8, fs + 8)
            ctx.fillStyle = activeColor
            ctx.textBaseline = 'top'
            ctx.fillText(ann.text, p.x + 2, p.y + 2)
          }
          break
        }
      }

      // Delete button on hover
      if (ann.id === hoverAnnotation && ann.points.length > 0) {
        const center = toCanvas(ann.points[Math.floor(ann.points.length / 2)])
        ctx.save()
        ctx.strokeStyle = '#ff4d4f'
        ctx.fillStyle = '#ff4d4f'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(center.x + 30, center.y - 30, 10, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fill()
        ctx.stroke()
        ctx.strokeStyle = '#ff4d4f'
        ctx.beginPath()
        ctx.moveTo(center.x + 25, center.y - 35)
        ctx.lineTo(center.x + 35, center.y - 25)
        ctx.moveTo(center.x + 35, center.y - 35)
        ctx.lineTo(center.x + 25, center.y - 25)
        ctx.stroke()
        ctx.restore()
      }

      ctx.restore()
    })

    // Draw drawing in progress
    if (drawState.drawing && drawState.points.length > 0 && drawState.tempPoints) {
      ctx.save()
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      const all = [...drawState.points, drawState.tempPoints]

      const toCanvas = (p: { x: number; y: number }) => {
        const cx = size.w / 2 + viewport.panX
        const cy = size.h / 2 + viewport.panY
        const s = viewport.zoom
        const rot = (viewport.rotation * Math.PI) / 180
        const tx = p.x * s * (viewport.flippedH ? -1 : 1)
        const ty = p.y * s * (viewport.flippedV ? -1 : 1)
        const rx = tx * Math.cos(rot) - ty * Math.sin(rot)
        const ry = tx * Math.sin(rot) + ty * Math.cos(rot)
        return { x: cx + rx, y: cy + ry }
      }

      if (currentTool === 'length' || currentTool === 'arrow') {
        if (all.length >= 2) {
          const p1 = toCanvas(all[0])
          const p2 = toCanvas(all[all.length - 1])
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.stroke()
        }
      } else if (currentTool === 'angle') {
        if (all.length >= 2) {
          ctx.beginPath()
          for (let i = 0; i < all.length - 1; i++) {
            const p1 = toCanvas(all[i])
            const p2 = toCanvas(all[i + 1])
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
          }
          ctx.stroke()
        }
      } else if (currentTool === 'area' || currentTool === 'freehand') {
        if (all.length >= 2) {
          ctx.beginPath()
          const first = toCanvas(all[0])
          ctx.moveTo(first.x, first.y)
          for (let i = 1; i < all.length; i++) {
            const p = toCanvas(all[i])
            ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()
        }
      } else if (currentTool === 'rectangle') {
        if (all.length >= 2) {
          const p1 = toCanvas(all[0])
          const p2 = toCanvas(all[all.length - 1])
          ctx.strokeRect(
            Math.min(p1.x, p2.x),
            Math.min(p1.y, p2.y),
            Math.abs(p2.x - p1.x),
            Math.abs(p2.y - p1.y)
          )
        }
      } else if (currentTool === 'ellipse') {
        if (all.length >= 2) {
          const p1 = toCanvas(all[0])
          const p2 = toCanvas(all[all.length - 1])
          const cx = (p1.x + p2.x) / 2
          const cy = (p1.y + p2.y) / 2
          const rx = Math.abs(p2.x - p1.x) / 2
          const ry = Math.abs(p2.y - p1.y) / 2
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // Crosshair for current tool
    if (currentTool !== 'none' && isActive && mousePos) {
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 235, 59, 0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(mousePos.x, 0)
      ctx.lineTo(mousePos.x, size.h)
      ctx.moveTo(0, mousePos.y)
      ctx.lineTo(size.w, mousePos.y)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Convert client pixel coords to image-space pixel coords (in image "native" pixels, 0=left/top)
  const clientToImagePx = (clientX: number, clientY: number) => {
    const coords = getImageCoords(clientX, clientY)
    const baseW = series?.columns || 512
    const baseH = series?.rows || 512
    return { ...coords, nativeX: coords.imgX + baseW / 2, nativeY: coords.imgY + baseH / 2 }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    onClick()
    if (e.button === 0 && currentTool !== 'none') {
      const coords = clientToImagePx(e.clientX, e.clientY)
      const point = { x: coords.imgX, y: coords.imgY }

      // Check if clicking on delete button of annotation
      if (hoverAnnotation) {
        onDeleteAnnotation(hoverAnnotation)
        setHoverAnnotation(null)
        return
      }

      if (currentTool === 'text') {
        onAddAnnotation({
          tool: 'text',
          points: [point],
          color: '#ffeb3b',
          thickness: 2,
        })
        return
      }

      setDrawState({
        drawing: true,
        points: currentTool === 'angle' && drawState.points.length === 1 ? [...drawState.points, point] : [point],
        tempPoints: point,
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = clientToImagePx(e.clientX, e.clientY)
    setMousePos({ x: coords.x, y: coords.y })
    if (coords.inImage) {
      setPixelValue(Math.floor(400 + coords.imgX * 1.5 + coords.imgY * 1.2))
    }

    // Update magnifier position
    if (viewport.magEnabled) {
      magnifierPos.current = {
        x: Math.max(0.15, Math.min(0.85, coords.x / size.w)),
        y: Math.max(0.15, Math.min(0.85, coords.y / size.h)),
      }
    }

    // Check hover for annotations (simple point-in-box test around center)
    let found: string | null = null
    for (const ann of annotations) {
      if (ann.points.length === 0) continue
      const cx = ann.points.reduce((s, p) => s + p.x, 0) / ann.points.length
      const cy = ann.points.reduce((s, p) => s + p.y, 0) / ann.points.length
      const centerCanvas = (() => {
        const cX = size.w / 2 + viewport.panX
      const cY = size.h / 2 + viewport.panY
        const s = viewport.zoom
        const rot = (viewport.rotation * Math.PI) / 180
        const tx = cx * s * (viewport.flippedH ? -1 : 1)
        const ty = cy * s * (viewport.flippedV ? -1 : 1)
        const rx = tx * Math.cos(rot) - ty * Math.sin(rot)
        const ry = tx * Math.sin(rot) + ty * Math.cos(rot)
        return { x: cX + rx, y: cY + ry }
      })()
      const dx = centerCanvas.x + 30 - coords.x
      const dy = centerCanvas.y - 30 - coords.y
      if (dx * dx + dy * dy < 100) {
        found = ann.id
        break
      }
    }
    setHoverAnnotation(found)

    // Window/Level with right button drag
    if (e.buttons === 2) {
      const deltaX = e.movementX
      const deltaY = e.movementY
      updateViewport(viewport.id, {
        windowWidth: Math.max(1, viewport.windowWidth + deltaX * 4),
        windowCenter: viewport.windowCenter - deltaY * 4,
      })
    }

    // Pan with middle button
    if (e.buttons === 4) {
      updateViewport(viewport.id, {
        panX: viewport.panX + e.movementX,
        panY: viewport.panY + e.movementY,
      })
    }

    // Update drawing
    if (drawState.drawing) {
      const pt = { x: coords.imgX, y: coords.imgY }
      setDrawState((prev) => ({ ...prev, tempPoints: pt }))
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawState.drawing) return
    const coords = clientToImagePx(e.clientX, e.clientY)
    const point = { x: coords.imgX, y: coords.imgY }

    const allPoints =
      currentTool === 'angle' && drawState.points.length === 2
        ? drawState.points
        : [...drawState.points, point]

    if (currentTool === 'angle' && drawState.points.length < 2) {
      // wait for 3rd point
      setDrawState((prev) => ({
        drawing: false,
        points: [...prev.points, point],
      }))
      return
    }

    if (allPoints.length >= 2 || currentTool === 'text') {
      onAddAnnotation({
        tool: currentTool,
        points: allPoints,
        color: '#ffeb3b',
        thickness: 2,
      })
    }

    setDrawState({ drawing: false, points: [] })
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey) {
      updateViewport(viewport.id, {
        zoom: Math.max(0.1, Math.min(10, viewport.zoom * (e.deltaY < 0 ? 1.1 : 0.9))),
      })
    } else {
      const dir = e.deltaY > 0 ? 1 : -1
      const totalImages = 200
      updateViewport(viewport.id, {
        imageIndex: Math.max(0, Math.min(totalImages - 1, viewport.imageIndex + dir)),
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const sid = e.dataTransfer.getData('seriesId')
    if (sid) onAssignSeries(sid)
  }

  return (
    <div
      ref={containerRef}
      className={`viewport ${isActive ? 'active' : ''}`}
      style={{ background: '#000', position: 'relative' }}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setDrawState({ drawing: false, points: [] })
      }}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {!series && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#606060',
            pointerEvents: 'none',
          }}
        >
          <Popover
            trigger={['click']}
            open={showSeriesPicker}
            onOpenChange={setShowSeriesPicker}
            placement="bottom"
            content={
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {studySeries.length === 0 ? (
                  <Empty description="无可用序列" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  studySeries.map((s, idx) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        onAssignSeries(s.id)
                        setShowSeriesPicker(false)
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: 4,
                        minWidth: 200,
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style = 'padding:8px 12px;cursor:pointer;border-radius:4px;minWidth:200px;border:1px solid #1890ff;background:rgba(24,144,255,0.1)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style = 'padding:8px 12px;cursor:pointer;border-radius:4px;min-width:200px;border:1px solid transparent')
                      }
                    >
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        #{idx + 1} {s.seriesDescription}
                      </div>
                      <div style={{ fontSize: 11, color: '#707070' }}>
                        {s.modality} · {s.imageCount}幅 · {s.rows}×{s.columns}
                      </div>
                    </div>
                  ))
                )}
              </div>
            }
            title="选择序列"
          >
            <div
              style={{ pointerEvents: 'auto', cursor: 'pointer', textAlign: 'center' }}
              onClick={(e) => {
                e.stopPropagation()
                setShowSeriesPicker(true)
              }}
            >
              <PlusOutlined style={{ fontSize: 48, marginBottom: 12 }} />
              <div>点击或拖拽序列到此处</div>
            </div>
          </Popover>
        </div>
      )}

      {isDragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(24,144,255,0.15)',
            border: '2px dashed #1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1890ff',
            pointerEvents: 'none',
            zIndex: 30,
            fontSize: 14,
          }}
        >
          松开来分配序列
        </div>
      )}

      {/* Viewport info overlays */}
      {series && (
        <>
          <div className="viewport-info">
            <div>
              {series.seriesNumber} {series.seriesDescription}
            </div>
            <div>{series.modality} {series.rows}×{series.columns}</div>
            {series.thickness && <div>层厚: {series.thickness}mm</div>}
          </div>
          <div className="viewport-info-right">
            <div>
              W: {Math.round(viewport.windowWidth)} / L: {Math.round(viewport.windowCenter)}
            </div>
            <div>Zoom: {viewport.zoom.toFixed(2)}x</div>
            {mousePos && <div>X: {mousePos.x.toFixed(0)} Y: {mousePos.y.toFixed(0)}</div>}
            <div style={{ color: '#ffb74d' }}>PV: {pixelValue}</div>
          </div>
          <div className="viewport-info-bottom">
            图像: {viewport.imageIndex + 1} / 200
            {viewport.rotation !== 0 && ` · 旋转 ${viewport.rotation}°`}
            {viewport.inverted && ' · 反色'}
            {viewport.magEnabled && ' · 放大镜'}
          </div>
        </>
      )}

      {/* Magnifier */}
      {viewport.magEnabled && series && (
        <div
          className="viewport-magnifier"
          style={{
            left: `${magnifierPos.current.x * 100}%`,
            top: `${magnifierPos.current.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <canvas
            width={180}
            height={180}
            ref={(el) => {
              if (!el) return
              const ctx = el.getContext('2d')
              if (!ctx) return
              ctx.save()
              ctx.fillStyle = '#000'
              ctx.fillRect(0, 0, 180, 180)
              ctx.translate(90, 90)
              ctx.scale(viewport.magZoom * viewport.zoom, viewport.magZoom * viewport.zoom)
              ctx.rotate((viewport.rotation * Math.PI) / 180)
              ctx.scale(viewport.flippedH ? -1 : 1, viewport.flippedV ? -1 : 1)
              const sIdx = studySeries.findIndex((s) => s.id === series.id)
              drawMedicalImage(ctx, imageSize.w, imageSize.h, sIdx, viewport.imageIndex, viewport.windowWidth, viewport.windowCenter, viewport.inverted)
              ctx.restore()
              ctx.strokeStyle = '#ffeb3b'
              ctx.beginPath()
              ctx.moveTo(90, 85)
              ctx.lineTo(90, 95)
              ctx.moveTo(85, 90)
              ctx.lineTo(95, 90)
              ctx.stroke()
            }}
          />
        </div>
      )}

      {/* Tool indicator */}
      {isActive && currentTool !== 'none' && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '2px 10px',
            background: 'rgba(255,235,59,0.15)',
            border: '1px solid rgba(255,235,59,0.3)',
            borderRadius: 10,
            color: '#ffeb3b',
            fontSize: 11,
            fontWeight: 600,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {currentTool.toUpperCase()} 模式
        </div>
      )}
    </div>
  )
}

export default Viewport
