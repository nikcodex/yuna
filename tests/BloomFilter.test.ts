import { describe, it, expect } from 'vitest';
import { BloomFilter } from '../src/utils/BloomFilter';

describe('BloomFilter', () => {
  it('reports nothing for an empty filter', () => {
    const bf = new BloomFilter(1_000);
    expect(bf.has('nope')).toBe(false);
    expect(bf.itemsAdded).toBe(0);
  });

  it('returns true for items that have been added', () => {
    const bf = new BloomFilter(1_000);
    bf.add('alpha');
    bf.add('beta');
    expect(bf.has('alpha')).toBe(true);
    expect(bf.has('beta')).toBe(true);
    expect(bf.itemsAdded).toBe(2);
  });

  it('never reports a false negative', () => {
    const bf = new BloomFilter(10_000);
    const items: string[] = [];
    for (let i = 0; i < 200; i++) {
      const id = `item-${i}`;
      items.push(id);
      bf.add(id);
    }
    for (const id of items) {
      expect(bf.has(id)).toBe(true);
    }
  });

  it('ignores empty/null items (does not add, does not match)', () => {
    const bf = new BloomFilter(1_000);
    bf.add('');
    bf.add(null);
    bf.add(undefined);
    expect(bf.itemsAdded).toBe(0);
    expect(bf.has('')).toBe(false);
    expect(bf.has(null as any)).toBe(false);
  });

  it('clear() resets the filter', () => {
    const bf = new BloomFilter(1_000);
    bf.add('alpha');
    expect(bf.has('alpha')).toBe(true);
    bf.clear();
    expect(bf.has('alpha')).toBe(false);
    expect(bf.itemsAdded).toBe(0);
  });

  it('getStats reflects size and item count', () => {
    const bf = new BloomFilter(5_000, 0.01);
    const stats = bf.getStats();
    expect(stats.bitSize).toBeGreaterThan(0);
    expect(stats.hashFunctions).toBeGreaterThan(0);
    expect(stats.allocatedBytes).toBeGreaterThan(0);
    expect(stats.itemsAdded).toBe(0);

    bf.add('x');
    expect(bf.getStats().itemsAdded).toBe(1);
  });

  it('keeps false positive rate below configured bound at the target size', () => {
    // With 10k items and 1% target rate, the empirical FP rate should be
    // well under 5% on a random sample of 2k distinct keys.
    const n = 10_000;
    const bf = new BloomFilter(n, 0.01);
    for (let i = 0; i < n; i++) bf.add(`member-${i}`);

    let falsePositives = 0;
    const probe = 2_000;
    for (let i = 0; i < probe; i++) {
      if (bf.has(`outsider-${i}`)) falsePositives++;
    }
    expect(falsePositives / probe).toBeLessThan(0.05);
  });
});
