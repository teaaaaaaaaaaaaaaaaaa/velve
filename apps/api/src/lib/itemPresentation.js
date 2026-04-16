function getPrimaryImage(item = {}) {
  if (item.imageClean) return item.imageClean
  if (item.isDigitized) return ''
  return item.images?.[0] || ''
}

function withPrimaryImage(item = {}) {
  return {
    ...item,
    primaryImage: getPrimaryImage(item),
  }
}

module.exports = {
  getPrimaryImage,
  withPrimaryImage,
}
