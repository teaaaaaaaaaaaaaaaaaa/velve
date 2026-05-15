const Item = require('../models/Item')

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'
const DEFAULT_TIMEOUT_MS = 30000
const HEALTH_TIMEOUT_MS = 2000
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 500

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(err, status) {
  if (status === 429 || status === 502 || status === 503 || status === 504) return true
  const code = err?.cause?.code || err?.code
  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_SOCKET' ||
    err?.name === 'AbortError'
  )
}

function getInternalAiHeaders(extraHeaders = {}) {
  const internalKey = process.env.AI_INTERNAL_API_KEY
  if (!internalKey && process.env.NODE_ENV === 'production') {
    throw new Error('AI_INTERNAL_API_KEY is required in production')
  }

  return {
    ...extraHeaders,
    ...(internalKey ? { 'X-Internal-AI-Key': internalKey } : {}),
  }
}

async function fetchAi(path, { method = 'POST', body, timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = {}) {
  const url = `${AI_SERVER_URL}${path}`

  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: getInternalAiHeaders(body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        const error = new Error(`AI server ${method} ${path} responded ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
        if (isRetryableError(error, response.status) && attempt < retries) {
          const delay = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 200)
          await sleep(delay)
          lastError = error
          continue
        }
        throw error
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        return await response.json()
      }
      return await response.text()
    } catch (err) {
      lastError = err
      if (!isRetryableError(err) || attempt >= retries) {
        throw err
      }
      const delay = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 200)
      await sleep(delay)
    }
  }

  throw lastError || new Error(`AI server ${method} ${path} failed after ${retries + 1} attempts`)
}

async function pingAiServer() {
  try {
    await fetchAi('/ping', { method: 'GET', timeoutMs: HEALTH_TIMEOUT_MS, retries: 0 })
    return true
  } catch (err) {
    return false
  }
}

async function generateEmbedding(imageUrl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const data = await fetchAi('/embed', { body: { image_url: imageUrl }, timeoutMs })
  if (!data || !Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('AI server returned empty embedding')
  }
  return data.embedding
}

async function addEmbeddingToIndex(itemId, embedding) {
  return fetchAi('/index-add', {
    body: { items: [{ item_id: String(itemId), embedding }] },
    timeoutMs: 10000,
  })
}

async function textSearch(query, { topK = 20, translate = true, excludeId = '' } = {}) {
  return fetchAi('/text-search', {
    body: { query, top_k: topK, translate, exclude_id: excludeId },
    timeoutMs: 30000,
  })
}

async function rebuildAiIndex() {
  const items = await Item.find({
    isDeleted: false,
    'embedding.0': { $exists: true },
  })
    .select('_id embedding')
    .lean()

  const payload = items.map((item) => ({
    item_id: String(item._id),
    embedding: item.embedding,
  }))

  return fetchAi('/index', { body: { items: payload }, timeoutMs: 60000 })
}

module.exports = {
  AI_SERVER_URL,
  getInternalAiHeaders,
  fetchAi,
  pingAiServer,
  generateEmbedding,
  addEmbeddingToIndex,
  rebuildAiIndex,
  textSearch,
}
