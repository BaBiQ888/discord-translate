import { translator } from '@/js/services/translator';
import { translationAPI } from '@/js/services/api';
import { TranslationCache } from '@/js/services/storage';

// Mock API 和缓存
jest.mock('@/js/services/api');
jest.mock('@/js/services/storage');

describe('Translator', () => {
  let mockElement;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();

    // 创建模拟 DOM 元素
    mockElement = document.createElement('div');
    mockElement.className = 'message-content';
  });

  test('should translate text successfully', async () => {
    // 设置 API mock
    translationAPI.translate.mockResolvedValue('Hello World');

    // 执行翻译
    const result = await translator.translate('你好世界', 'en', mockElement);

    // 验证结果
    expect(result).toBe('Hello World');
    expect(translationAPI.translate).toHaveBeenCalledWith(
      '你好世界',
      'zh',
      'en'
    );
  });

  test('should handle API errors gracefully', async () => {
    // 模拟 API 错误
    translationAPI.translate.mockRejectedValue(new Error('API Error'));

    // 执行翻译并验证错误处理
    await expect(
      translator.translate('Test', 'zh', mockElement)
    ).rejects.toThrow('API Error');
  });

  test('should batch process multiple translations', async () => {
    const texts = ['Hello', 'World'];
    const mockResults = ['你好', '世界'];

    // 设置批量翻译的 mock
    translationAPI.batchTranslate.mockResolvedValue(mockResults);

    // 执行批量翻译
    await Promise.all(
      texts.map(text => translator.addToBatch(text, 'zh', mockElement))
    );

    // 等待批处理完成
    await new Promise(resolve => setTimeout(resolve, 600));

    // 验证批处理结果
    expect(translationAPI.batchTranslate).toHaveBeenCalledTimes(1);
    expect(translationAPI.batchTranslate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Hello' }),
        expect.objectContaining({ text: 'World' })
      ])
    );
  });
}); 