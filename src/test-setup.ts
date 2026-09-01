/**
 * The store reads and writes localStorage as soon as it is imported, so tests
 * need one before any module loads. An in-memory stub keeps the suite in the
 * plain node environment rather than pulling in a whole DOM.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
