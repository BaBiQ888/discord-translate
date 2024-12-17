export class TranslationCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // 最大缓存条目数
    this.init();
  }

  async init() {
    try {
      const result = await chrome.storage.local.get('translationCache');
      if (result.translationCache) {
        this.cache = new Map(Object.entries(result.translationCache));
      }
      this.startCleanupTimer();
    } catch (error) {
      console.error('Cache initialization failed:', error);
    }
  }

  generateKey(text, sourceLang, targetLang) {
    return `${sourceLang}:${targetLang}:${text}`;
  }

  async get(text, sourceLang, targetLang) {
    const key = this.generateKey(text, sourceLang, targetLang);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      // 更新访问时间
      cached.lastAccessed = Date.now();
      return cached.translation;
    }
    return null;
  }

  async set(text, sourceLang, targetLang, translation) {
    const key = this.generateKey(text, sourceLang, targetLang);

    // 检查缓存大小
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, {
      translation,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });

    await this.saveToStorage();
  }

  async batchGet(items) {
    return items.map(({ text, sourceLang, targetLang }) =>
      this.get(text, sourceLang, targetLang)
    );
  }

  async batchSet(items) {
    for (const { text, sourceLang, targetLang, translation } of items) {
      await this.set(text, sourceLang, targetLang, translation);
    }
  }

  evictLeastRecentlyUsed() {
    let oldest = Infinity;
    let oldestKey = null;

    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccessed < oldest) {
        oldest = value.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  async saveToStorage() {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      await chrome.storage.local.set({ translationCache: cacheObject });
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  startCleanupTimer() {
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  async cleanup() {
    const now = Date.now();
    let hasChanges = false;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 24 * 60 * 60 * 1000) {
        this.cache.delete(key);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await this.saveToStorage();
    }
  }
} 