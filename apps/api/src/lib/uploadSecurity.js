const sharp = require('sharp')

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_PIXELS = Number(process.env.MAX_IMAGE_PIXELS || 24_000_000)
const MAX_WIDTH = Number(process.env.MAX_IMAGE_WIDTH || 8000)
const MAX_HEIGHT = Number(process.env.MAX_IMAGE_HEIGHT || 8000)

async function detectFileType(buffer) {
  const { fileTypeFromBuffer } = await import('file-type')
  return fileTypeFromBuffer(buffer)
}

async function validateAndNormalizeImage(file, { forceJpeg = true } = {}) {
  if (!file?.buffer?.length) {
    const err = new Error('Image file is required')
    err.statusCode = 400
    throw err
  }

  const detected = await detectFileType(file.buffer)
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    const err = new Error('Only valid JPEG, PNG, and WebP images are allowed')
    err.statusCode = 400
    throw err
  }

  const image = sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS }).rotate()
  const metadata = await image.metadata()
  const width = Number(metadata.width || 0)
  const height = Number(metadata.height || 0)

  if (!width || !height || width > MAX_WIDTH || height > MAX_HEIGHT || width * height > MAX_PIXELS) {
    const err = new Error('Image dimensions are too large')
    err.statusCode = 400
    throw err
  }

  if (forceJpeg || detected.mime !== 'image/png') {
    return {
      buffer: await image.jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
      contentType: 'image/jpeg',
      extension: 'jpg',
      metadata: { width, height },
    }
  }

  return {
    buffer: await image.png({ compressionLevel: 9 }).toBuffer(),
    contentType: 'image/png',
    extension: 'png',
    metadata: { width, height },
  }
}

module.exports = {
  validateAndNormalizeImage,
}
