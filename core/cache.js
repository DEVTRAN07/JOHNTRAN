const logger = require("../utils/logger");

class LRUCache {
  constructor({ max = 500, ttl = 300000 } = {}) {
    this.max = max;
    this.ttl = ttl;
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  get(key) {
    if (!this.has(key)) {
      this.misses++;
      return undefined;
    }
    const entry = this.store.get(key);
    // đưa lên đầu (dùng gần đây nhất)
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value, ttl = this.ttl) {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
    while (this.store.size > this.max) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
  }

  remember(key, factory, ttl) {
    const cached = this.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    return Promise.resolve(factory()).then((value) => {
      if (value !== undefined && value !== null) this.set(key, value, ttl);
      return value;
    });
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  stats() {
    return { size: this.store.size, max: this.max, hits: this.hits, misses: this.misses, hitRate: this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)).toFixed(2) : "0" };
  }
}

const caches = {
  groupInfo: new LRUCache({ max: 200, ttl: 300000 }),
  userInfo: new LRUCache({ max: 500, ttl: 600000 }),
  musicSearch: new LRUCache({ max: 100, ttl: 300000 })
};

function allStats() {
  return Object.fromEntries(Object.entries(caches).map(([name, cache]) => [name, cache.stats()]));
}

module.exports = { LRUCache, caches, allStats };
