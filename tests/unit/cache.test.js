import { TranslationCache } from '@/js/services/storage';

describe('TranslationCache', () => {
  let cache;

  beforeEach(() => {
    // Mock chrome.storage.local
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    };

    cache = new TranslationCache();
  });

  test('should store and retrieve translations', async () => {
    const text = 'Hello';
    const translation = '你好';

    // 存储翻译
    await cache.set(text, 'en', 'zh', translation);

    // 获取翻译
    const result = await cache.get(text, 'en', 'zh');
    expect(result).toBe(translation);
  });

  test('should handle cache size limits', async () => {
    // 填充缓存到最大大小
    for (let i = 0; i < 1001; i++) {
      await cache.set(`text${i}`, 'en', 'zh', `translation${i}`);
    }

    // 验证缓存大小不超过限制
    expect(cache.cache.size).toBeLessThanOrEqual(1000);
  });

  test('should clean up expired entries', async () => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    // Mock Date.now
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    // 添加过期条目
    await cache.set('expired', 'en', 'zh', 'old');

    // 改变时间
    Date.now.mockImplementation(() => now + dayInMs + 1000);

    // 清理缓存
    await cache.cleanup();

    // 验证过期条目已被删除
    const result = await cache.get('expired', 'en', 'zh');
    expect(result).toBeNull();
  });
}); 