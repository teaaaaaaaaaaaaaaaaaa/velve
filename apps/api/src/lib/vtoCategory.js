const VALID_VTO_GARMENT_CATEGORIES = ['tops', 'bottoms', 'one-pieces']

function resolveGarmentCategory(category = '') {
  const normalized = String(category || '').trim().toLowerCase()

  if (
    normalized.includes('dress') ||
    normalized.includes('halj') ||
    normalized.includes('jumpsuit') ||
    normalized.includes('jump suit') ||
    normalized.includes('one-piece') ||
    normalized.includes('one piece') ||
    normalized.includes('romper')
  ) {
    return 'one-pieces'
  }

  if (
    normalized.includes('pantal') ||
    normalized.includes('bottom') ||
    normalized.includes('suk') ||
    normalized.includes('skirt') ||
    normalized.includes('short') ||
    normalized.includes('jean') ||
    normalized.includes('denim')
  ) {
    return 'bottoms'
  }

  if (
    normalized.includes('top') ||
    normalized.includes('shirt') ||
    normalized.includes('tee') ||
    normalized.includes('blouse') ||
    normalized.includes('sweater') ||
    normalized.includes('hoodie') ||
    normalized.includes('knit') ||
    normalized.includes('jacket') ||
    normalized.includes('coat') ||
    normalized.includes('blazer') ||
    normalized.includes('outerwear')
  ) {
    return 'tops'
  }

  return null
}

function resolveGarmentCategoryWithFallback(category = '', logger = console) {
  const resolved = resolveGarmentCategory(category)
  if (resolved) {
    return resolved
  }

  logger.warn('[VTO][Category] Unknown category, defaulting to tops', {
    sourceCategory: category || '',
  })
  return 'tops'
}

module.exports = {
  VALID_VTO_GARMENT_CATEGORIES,
  resolveGarmentCategory,
  resolveGarmentCategoryWithFallback,
}
