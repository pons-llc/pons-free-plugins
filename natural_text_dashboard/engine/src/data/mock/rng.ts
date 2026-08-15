/** mulberry32: シード固定の決定論的PRNG。同じシードなら常に同じ数列を返す（P3のテスト担保用）。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRandom {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float(): number {
    return this.next();
  }
  int(min: number, max: number): number {
    return Math.floor(this.float() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    const item = arr[this.int(0, arr.length - 1)];
    if (item === undefined) throw new Error("pick from empty array");
    return item;
  }
  pickN<T>(arr: readonly T[], n: number): T[] {
    const pool = [...arr];
    const result: T[] = [];
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = this.int(0, pool.length - 1);
      const [picked] = pool.splice(idx, 1);
      if (picked !== undefined) result.push(picked);
    }
    return result;
  }
  bool(pTrue = 0.5): boolean {
    return this.float() < pTrue;
  }
  dateBetween(start: Date, end: Date): Date {
    const t = start.getTime() + this.float() * (end.getTime() - start.getTime());
    return new Date(t);
  }
}
