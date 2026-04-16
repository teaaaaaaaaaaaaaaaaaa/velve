type ItemLike = {
  primaryImage?: string | null
  imageClean?: string | null
  images?: string[] | null
  isDigitized?: boolean | null
}

export function getPrimaryItemImage(item?: ItemLike | null) {
  if (!item) return null
  // Once a piece is digitized, always prefer the clean cut asset and never
  // fall back to the old original image in UI surfaces like profile/saved/feed.
  if (item.imageClean) return item.imageClean
  if (item.isDigitized) return null
  return item.primaryImage || item.images?.[0] || null
}

export function hasDigitizedImage(item?: ItemLike | null) {
  return Boolean(item?.isDigitized && item?.imageClean)
}
