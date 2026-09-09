/**
 * @file cache.js
 * @description Generic TTL Cache implementation.
 */
export class TTLCache {
    ttlMs;
    maxSize;
    cache;
    /**
     * Creates a new TTLCache instance.
     * @param {number} [ttlMs=60000] Time to live in milliseconds (default: 60s).
     * @param {number} [maxSize=1000] Maximum number of entries before auto-eviction.
     */
    constructor(ttlMs = 60000, maxSize = 1000) {
        this.ttlMs = ttlMs;
        this.maxSize = maxSize;
        this.cache = new Map();
    }
    /**
     * Sets a value in the cache.
     * @param {string} key The key to set.
     * @param {any} value The value to store.
     * @param {number} [customTtl] Optional custom TTL for this entry.
     */
    set(key, value, customTtl = this.ttlMs) {
        if (this.cache.size >= this.maxSize) {
            // Auto-evict oldest entry
            const firstKey = this.cache.keys().next().value;
            // @ts-ignore
            this.cache.delete(firstKey);
        }
        this.cache.set(key, {
            value,
            expires: Date.now() + customTtl
        });
    }
    /**
     * Retrieves a value from the cache.
     * @param {string} key The key to retrieve.
     * @returns {any|undefined} The cached value, or undefined if not found/expired.
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return undefined;
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return undefined; // Lazy cleanup
        }
        return item.value;
    }
    /**
     * Checks if a valid key exists in the cache.
     * @param {string} key The key to check.
     * @returns {boolean} True if the key exists and has not expired.
     */
    has(key) {
        return this.get(key) !== undefined;
    }
    /**
     * Deletes a key from the cache.
     * @param {string} key The key to delete.
     * @returns {boolean} True if an element in the Map object existed and has been removed.
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clears all entries from the cache.
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Gets the number of items in the cache (including expired items before lazy cleanup).
     * @returns {number} The size of the cache.
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Iterator for all valid entries in the cache.
     * @yields {[string, any]} The key-value pairs of valid entries.
     */
    *entries() {
        for (const [key, item] of this.cache.entries()) {
            if (Date.now() <= item.expires) {
                yield [key, item.value];
            }
            else {
                this.cache.delete(key);
            }
        }
    }
}
