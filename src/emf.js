/**
 * EMF (Enhanced Metafile) bitmap extraction.
 *
 * PPTX files frequently embed EMF images as OLE object previews (equations,
 * pasted objects). Browsers cannot display EMF, so those images come out
 * broken. Many EMFs carry their raster content as an uncompressed DIB inside
 * an EMR_STRETCHDIBITS record — that bitmap is extracted here and re-encoded
 * as PNG, without implementing full EMF record interpretation.
 *
 * EMF record format: each record is { type: u32, size: u32, ...data },
 * walked sequentially until the EOF record (type 14).
 *
 * Ported from yinyao855/pptxtojson-pro `src/utils/emfParser.ts` (MIT),
 * restricted to the dependency-free DIB path (the PDF path there needs
 * pdfjs-dist, which is far too heavy for this bundle).
 */

const EMR_EOF = 14
const EMR_STRETCHDIBITS = 81

// EMF header signature at offset 40: " EMF"
const EMF_SIGNATURE = 0x464d4520

// DIB compression: uncompressed RGB
const BI_RGB = 0

/**
 * Parse an EMF file and extract the first embedded uncompressed DIB as an
 * RGBA bitmap ({ width, height, data }). Returns null when the file is not
 * EMF or carries no supported bitmap.
 */
export function extractEmfBitmap(data) {
  if (!data || data.length < 44) return null

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (view.getUint32(40, true) !== EMF_SIGNATURE) return null

  let offset = 0
  while (offset + 8 <= data.length) {
    const recordType = view.getUint32(offset, true)
    const recordSize = view.getUint32(offset + 4, true)

    if (recordSize < 8 || offset + recordSize > data.length) break
    if (recordType === EMR_EOF) break

    if (recordType === EMR_STRETCHDIBITS && recordSize > 80) {
      const bitmap = parseStretchDibits(data, view, offset)
      if (bitmap) return bitmap
    }

    offset += recordSize
  }

  return null
}

/**
 * Parse a STRETCHDIBITS record and extract the bitmap as an RGBA buffer.
 *
 * Record layout (offsets from record start):
 *   0: type(4), 4: size(4), 8: rclBounds(16), 24: xDest(4), 28: yDest(4),
 *  32: xSrc(4), 36: ySrc(4), 40: cxSrc(4), 44: cySrc(4),
 *  48: offBmiSrc(4), 52: cbBmiSrc(4), 56: offBitsSrc(4), 60: cbBitsSrc(4),
 *  64: iUsageSrc(4), 68: dwRop(4), 72: cxDest(4), 76: cyDest(4)
 */
function parseStretchDibits(data, view, offset) {
  if (offset + 80 > data.length) return null

  const offBmiSrc = view.getUint32(offset + 48, true)
  const cbBmiSrc = view.getUint32(offset + 52, true)
  const offBitsSrc = view.getUint32(offset + 56, true)
  const cbBitsSrc = view.getUint32(offset + 60, true)

  if (cbBmiSrc === 0 || cbBitsSrc === 0) return null

  const bmiStart = offset + offBmiSrc
  if (bmiStart + 40 > data.length) return null

  // BITMAPINFOHEADER
  const biWidth = view.getInt32(bmiStart + 4, true)
  const biHeight = view.getInt32(bmiStart + 8, true)
  const biBitCount = view.getUint16(bmiStart + 14, true)
  const biCompression = view.getUint32(bmiStart + 16, true)

  if (biCompression !== BI_RGB) return null
  if (biBitCount !== 24 && biBitCount !== 32) return null

  const width = Math.abs(biWidth)
  const height = Math.abs(biHeight)
  if (width === 0 || height === 0 || width > 8192 || height > 8192) return null

  const bitsStart = offset + offBitsSrc
  if (bitsStart + cbBitsSrc > data.length) return null

  const bitsData = data.subarray(bitsStart, bitsStart + cbBitsSrc)

  // Negative height means top-down row order; positive means bottom-up
  const topDown = biHeight < 0

  const pixels = new Uint8ClampedArray(width * height * 4)
  const bytesPerPixel = biBitCount / 8
  // DIB rows are padded to 4-byte boundaries
  const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4

  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y
    const srcOffset = srcRow * rowStride
    const dstOffset = y * width * 4

    for (let x = 0; x < width; x++) {
      const srcIdx = srcOffset + x * bytesPerPixel
      if (srcIdx + bytesPerPixel > bitsData.length) break

      // DIB stores BGR(A)
      pixels[dstOffset + x * 4 + 0] = bitsData[srcIdx + 2]
      pixels[dstOffset + x * 4 + 1] = bitsData[srcIdx + 1]
      pixels[dstOffset + x * 4 + 2] = bitsData[srcIdx + 0]
      pixels[dstOffset + x * 4 + 3] = biBitCount === 32 ? bitsData[srcIdx + 3] : 255
    }
  }

  return { width, height, data: pixels }
}

/**
 * Convert EMF bytes to a PNG data URL via canvas. Browser-only; returns ''
 * in non-DOM environments or when the EMF has no extractable bitmap.
 */
export function emfToPngDataUrl(data) {
  if (typeof document === 'undefined') return ''

  const bitmap = extractEmfBitmap(data)
  if (!bitmap) return ''

  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.putImageData(new ImageData(bitmap.data, bitmap.width, bitmap.height), 0, 0)
  return canvas.toDataURL('image/png')
}
