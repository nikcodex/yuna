import crypto from 'node:crypto';
export class BloomFilter {
    size;
    hashes;
    bitArray;
    itemsAdded;
    /**
     * High-throughput probabilistic Bloom Filter for instant O(1) checks
     * @param {number} [expectedItems=100000]
     * @param {number} [falsePositiveRate=0.01]
     */
    constructor(expectedItems = 100_000, falsePositiveRate = 0.01) {
        this.size = Math.ceil(-(expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2));
        this.hashes = Math.ceil((this.size / expectedItems) * Math.log(2));
        this.bitArray = Buffer.alloc(Math.ceil(this.size / 8), 0);
        this.itemsAdded = 0;
    }
    _getHashPositions(item) {
        const hash = crypto.createHash('md5').update(String(item)).digest();
        const h1 = hash.readUInt32LE(0);
        const h2 = hash.readUInt32LE(4);
        const positions = [];
        for (let i = 0; i < this.hashes; i++) {
            const pos = Math.abs((h1 + i * h2) % this.size);
            positions.push(pos);
        }
        return positions;
    }
    /**
     * Adds an item to the Bloom Filter
     * @param {string} item
     */
    add(item) {
        if (!item)
            return;
        const positions = this._getHashPositions(item);
        for (const pos of positions) {
            const byteIndex = Math.floor(pos / 8);
            const bitIndex = pos % 8;
            this.bitArray[byteIndex] |= (1 << bitIndex);
        }
        this.itemsAdded++;
    }
    /**
     * Checks if an item might exist in the Bloom Filter
     * @param {string} item
     * @returns {boolean}
     */
    has(item) {
        if (!item)
            return false;
        const positions = this._getHashPositions(item);
        for (const pos of positions) {
            const byteIndex = Math.floor(pos / 8);
            const bitIndex = pos % 8;
            if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
                return false; // Definitely not in set
            }
        }
        return true; // Might be in set
    }
    clear() {
        this.bitArray.fill(0);
        this.itemsAdded = 0;
    }
    getStats() {
        return {
            itemsAdded: this.itemsAdded,
            allocatedBytes: this.bitArray.length,
            hashFunctions: this.hashes,
            bitSize: this.size
        };
    }
}
export default BloomFilter;
