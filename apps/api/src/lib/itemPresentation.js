function getPrimaryImage(item = {}) {
  return item.imageClean || item.images?.[0] || ''
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
