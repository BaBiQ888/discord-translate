import { translator } from '@/js/services/translator';
import { UIManager } from '@/js/utils/dom';

describe('Translation Flow', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('should translate and update DOM', async () => {
    // 创建消息元素
    const messageElement = document.createElement('div');
    messageElement.className = 'messageContent-2t3eCI';
    messageElement.textContent = 'Hello World';
    container.appendChild(messageElement);

    // 执行翻译
    await translator.translate('Hello World', 'zh', messageElement);

    // 验证 DOM 更新
    const translationElement = messageElement.querySelector('.translation-result');
    expect(translationElement).toBeTruthy();
    expect(translationElement.textContent).toContain('你好世界');
  });

  test('should handle batch updates efficiently', async () => {
    // 创建多个消息元素
    const messages = ['Hello', 'World', 'Test'];
    const elements = messages.map(text => {
      const element = document.createElement('div');
      element.className = 'messageContent-2t3eCI';
      element.textContent = text;
      container.appendChild(element);
      return element;
    });

    // 批量翻译
    await Promise.all(
      elements.map((element, index) =>
        translator.translate(messages[index], 'zh', element)
      )
    );

    // 验证所有元素都被更新
    const translations = container.querySelectorAll('.translation-result');
    expect(translations.length).toBe(messages.length);
  });
}); 