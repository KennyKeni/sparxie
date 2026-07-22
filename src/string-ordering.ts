/** Compares strings by their UTF-8 byte sequences for stable keyset ordering. */
export function compareUtf8Bytewise(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  const length = Math.min(leftBytes.length, rightBytes.length)

  for (let index = 0; index < length; index += 1) {
    const delta = leftBytes[index]! - rightBytes[index]!
    if (delta !== 0) {
      return delta
    }
  }

  return leftBytes.length - rightBytes.length
}
