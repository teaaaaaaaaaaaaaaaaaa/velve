export type VtoGarmentCategory = 'tops' | 'bottoms' | 'one-pieces';

export function resolveVtoGarmentCategory(category?: string | null): VtoGarmentCategory {
  const normalized = String(category ?? '')
    .trim()
    .toLowerCase();

  if (
    normalized.includes('dress') ||
    normalized.includes('halj') ||
    normalized.includes('jumpsuit') ||
    normalized.includes('jump suit') ||
    normalized.includes('one-piece') ||
    normalized.includes('one piece') ||
    normalized.includes('romper')
  ) {
    return 'one-pieces';
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
    return 'bottoms';
  }

  return 'tops';
}
