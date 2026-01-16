'use client'

import { pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export async function generateThumbnail(file: File) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)

    const targetWidth = 360
    const targetHeight = 240 // 3:2 aspect
    const viewport = page.getViewport({ scale: 1 })
    const scale = targetWidth / viewport.width
    const scaledViewport = page.getViewport({ scale })

    // Render to an offscreen canvas at the scaled viewport size
    const renderCanvas = document.createElement('canvas')
    const renderContext = renderCanvas.getContext('2d')
    if (!renderContext) return null
    renderCanvas.width = scaledViewport.width
    renderCanvas.height = scaledViewport.height

    await page.render({ canvasContext: renderContext, viewport: scaledViewport }).promise

    // Draw into a final canvas with 3:2 aspect, center-cropping if needed
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = targetWidth
    finalCanvas.height = targetHeight
    const finalCtx = finalCanvas.getContext('2d')
    if (!finalCtx) return null

    const scaleCover = Math.max(targetWidth / renderCanvas.width, targetHeight / renderCanvas.height)
    const drawWidth = renderCanvas.width * scaleCover
    const drawHeight = renderCanvas.height * scaleCover
    const dx = (targetWidth - drawWidth) / 2
    const dy = 0 // top-align crop instead of centering

    finalCtx.drawImage(
      renderCanvas,
      0,
      0,
      renderCanvas.width,
      renderCanvas.height,
      dx,
      dy,
      drawWidth,
      drawHeight
    )

    return await new Promise<Blob | null>((resolve) => {
      finalCanvas.toBlob((blob) => resolve(blob), 'image/png', 0.8)
    })
  } catch (err) {
    console.warn('Thumbnail generation failed', err)
    return null
  }
}


