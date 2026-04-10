type ItemLike = {
  primaryImage?: string | null
  imageClean?: string | null
  images?: string[] | null
  isDigitized?: boolean | null
}

export function getPrimaryItemImage(item?: ItemLike | null) {
  if (!item) return null
  return item.primaryImage || item.imageClean || item.images?.[0] || null
}

export function hasDigitizedImage(item?: ItemLike | null) {
  return Boolean(item?.isDigitized && item?.imageClean)
}
