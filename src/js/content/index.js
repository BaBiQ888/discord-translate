// 在文件开始定义所有需要的类和功能

// 翻译器类
class Translator {
  static async translate(text, targetLang = 'zh') {
    try {
      console.log('开始翻译:', { text, targetLang });
      const url = new URL('https://translate.googleapis.com/translate_a/single');
      url.searchParams.append('client', 'gtx');
      url.searchParams.append('sl', 'auto');
      url.searchParams.append('dt', 't');
      url.searchParams.append('tl', targetLang);
      url.searchParams.append('q', text);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`翻译请求失败: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data[0].map(item => item[0]).join('');
      console.log('翻译成功:', { original: text, translated: translatedText });
      return translatedText;
    } catch (error) {
      console.error('翻译失败:', error);
      return null;
    }
  }
}

// Discord 观察器类
class DiscordObserver {
  constructor() {
    this.messageObserver = null;
    this.selectors = {
      container: [
        '[data-list-id="chat-messages"]',
        '.scrollerInner-2PPAp2',
        '[class*="messagesWrapper-"]'
      ],
      message: [
        '[class*="message-"]',
        '[class*="messageListItem-"]'
      ],
      content: [
        '[class*="markup_"]',
        '[class*="messageContent_"]',
        '.markup-2BOw-j'
      ]
    };
    this.translator = Translator;
    console.log('DiscordObserver 已初始化');
  }

  async init() {
    console.log('开始初始化 DiscordObserver');
    await this.waitForDiscord();
    await this.waitForMessages();
    this.startObserving();
    await this.retryTranslateExistingMessages();
  }

  async waitForDiscord() {
    console.log('等待 Discord 加载...');
    return new Promise(resolve => {
      const check = () => {
        if (document.querySelector('[data-list-id="chat-messages"]') ||
          document.querySelector('.scrollerInner-2PPAp2')) {
          console.log('Discord 已加载');
          resolve();
        } else {
          console.log('等待 Discord 加载中...');
          setTimeout(check, 1000);
        }
      };
      check();
    });
  }

  async waitForMessages() {
    return new Promise((resolve) => {
      const check = () => {
        let container = null;
        for (const selector of this.selectors.container) {
          container = document.querySelector(selector);
          if (container) {
            console.log('找到消息容器，使用选择器:', selector);
            break;
          }
        }

        if (container) {
          resolve(container);
        } else {
          console.log('等待消息容器...');
          setTimeout(check, 1000);
        }
      };
      check();
    });
  }

  findMessages() {
    let messages = [];
    for (const selector of this.selectors.content) {
      const found = Array.from(document.querySelectorAll(selector));
      if (found.length > 0) {
        console.log(`使用选择器 ${selector} 找到 ${found.length} 条消息`);
        messages = found.filter(msg => {
          const isSystemMessage = msg.closest('[class*="systemMessage-"]');
          const isTranslated = this.isTranslated(msg);
          const hasContent = this.getFullText(msg).length > 0;
          return !isSystemMessage && !isTranslated && hasContent;
        });
        console.log(`过滤后剩余 ${messages.length} 条待翻译消息`);
        break;
      }
    }
    return messages;
  }

  startObserving() {
    this.messageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          this.checkNodesForMessages(mutation.addedNodes);
        }
      }
    });

    this.messageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    console.log('消息观察器已启动');
  }

  checkNodesForMessages(nodes) {
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        for (const selector of this.selectors.content) {
          if (node.matches?.(selector)) {
            this.handleMessageContent(node);
          }
          const messages = node.querySelectorAll(selector);
          messages.forEach(message => this.handleMessageContent(message));
        }
      }
    });
  }

  async translateExistingMessages() {
    const messages = this.findMessages();
    console.log(`准备翻译 ${messages.length} 条现有消息`);

    const translations = messages.map(async (message) => {
      try {
        const text = message.textContent.trim();
        if (text) {
          console.log('翻译消息:', text);
          await this.translateMessage(message, text);
        }
      } catch (error) {
        console.error('翻译消息失败:', error);
      }
    });

    await Promise.all(translations);
    console.log('所有现有消息翻译完成');
  }

  async handleMessageContent(contentNode) {
    if (!contentNode || this.isTranslated(contentNode)) {
      return;
    }

    const text = this.getFullText(contentNode);
    if (!text) {
      return;
    }

    if (contentNode.closest('[class*="systemMessage-"]')) {
      return;
    }

    console.log('处理消息:', text);
    await this.translateMessage(contentNode, text);
  }

  getFullText(node) {
    if (node.hasAttribute('data-original-text')) {
      return node.getAttribute('data-original-text');
    }

    return Array.from(node.childNodes)
      .map(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          return child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          return child.textContent;
        }
        return '';
      })
      .join('')
      .trim();
  }

  isTranslated(node) {
    return node.hasAttribute('data-translated');
  }

  async translateMessage(node, text) {
    try {
      const translatedText = await this.translator.translate(text);
      if (translatedText && translatedText !== text) {
        const translationContainer = document.createElement('div');
        translationContainer.className = 'discord-translator-result';

        // 添加样式类而不是内联样式
        const style = document.createElement('style');
        style.textContent = `
          .discord-translator-result {
            color: var(--text-normal);
            font-size: 0.9em;
            margin-top: 8px;
            padding: 8px 12px;
            background: var(--background-secondary);
            border-radius: 4px;
            border-left: 3px solid var(--brand-experiment);
            font-family: var(--font-primary);
            transition: all 0.2s ease;
          }
          
          .discord-translator-result:hover {
            background: var(--background-secondary-alt);
          }
          
          .discord-translator-toggle {
            font-size: 12px;
            padding: 4px 8px;
            margin-left: 8px;
            border-radius: 3px;
            background: var(--brand-experiment);
            color: var(--text-normal);
            border: none;
            cursor: pointer;
            opacity: 0.8;
            transition: opacity 0.2s ease;
          }
          
          .discord-translator-toggle:hover {
            opacity: 1;
          }
        `;
        document.head.appendChild(style);

        node.setAttribute('data-original-text', text);
        node.setAttribute('data-translated', 'true');

        translationContainer.textContent = translatedText;

        // 添加切换按钮
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'discord-translator-toggle';
        toggleBtn.textContent = '切换原文';
        toggleBtn.onclick = () => {
          const isShowingTranslation = translationContainer.getAttribute('data-showing') !== 'original';
          translationContainer.textContent = isShowingTranslation ? text : translatedText;
          toggleBtn.textContent = isShowingTranslation ? '显示译文' : '切换原文';
          translationContainer.setAttribute('data-showing', isShowingTranslation ? 'original' : 'translation');
        };

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.appendChild(translationContainer);
        container.appendChild(toggleBtn);

        const parent = node.parentNode;
        if (parent) {
          const existingTranslation = parent.querySelector('.discord-translator-result');
          if (existingTranslation) {
            existingTranslation.parentElement.replaceWith(container);
          } else {
            parent.insertBefore(container, node.nextSibling);
          }
        }

        console.log('翻译成功:', { original: text, translated: translatedText });
      }
    } catch (error) {
      console.error('翻译失败:', error);
    }
  }

  async debugSelectors() {
    console.log('开始选择器调试');

    for (const [type, selectorList] of Object.entries(this.selectors)) {
      console.log(`\n测试 ${type} 选择器:`);
      for (const selector of selectorList) {
        const elements = document.querySelectorAll(selector);
        console.log(`${selector}: 找到 ${elements.length} 个元素`);
        if (elements.length > 0) {
          const sample = elements[0];
          console.log('示例元素:', {
            className: sample.className,
            id: sample.id,
            text: sample.textContent?.slice(0, 50)
          });
        }
      }
    }
  }

  async retryTranslateExistingMessages(maxAttempts = 5) {
    console.log('开始处理历史消息');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const messages = this.findMessages();
      if (messages.length > 0) {
        console.log(`第 ${attempt} 次尝试，找到 ${messages.length} 条消息`);
        await this.translateExistingMessages();
        break;
      } else {
        console.log(`第 ${attempt} 次尝试未找到消息，等待后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

// UI 管理器类
class UIManager {
  static async addTranslateButton(onClick) {
    const toolbar = await this.waitForElement('.toolbar-1t6TWx');
    if (!toolbar) return;

    const button = document.createElement('button');
    button.className = 'translate-all-button';
    button.textContent = '翻译所有消息';
    button.style.cssText = `
      margin-left: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #5865f2;
      color: white;
      border: none;
      cursor: pointer;
    `;

    button.onclick = onClick;
    toolbar.appendChild(button);
  }

  static async waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }
}

// 主要内容脚本类
class ContentScript {
  constructor() {
    this.observer = new DiscordObserver();
    this.settings = {
      autoTranslateEnabled: true,
      targetLang: 'zh'
    };
    console.log('ContentScript 已创建');
  }

  async init() {
    console.log('ContentScript 初始化开始');
    try {
      // 给 Discord 更多时间加载
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('延迟等待结束');

      await this.loadSettings();
      await this.observer.init();
      await UIManager.addTranslateButton(() => this.observer.retryTranslateExistingMessages());
      this.setupMessageListener();

      console.log('ContentScript 初始化完成');
    } catch (error) {
      console.error('ContentScript 初始化失败:', error);
    }
  }

  async translateAllMessages() {
    console.log('开始翻译所有消息');
    const messages = document.querySelectorAll('[class*="messageContent-"]');
    console.log('找到消息数量:', messages.length);

    for (const message of messages) {
      if (!message.hasAttribute('data-translated')) {
        const text = message.textContent;
        console.log('准备翻译消息:', text);
        try {
          await this.observer.translateMessage(message, text);
          console.log('消息翻译完成');
        } catch (error) {
          console.error('消息翻译失败:', error);
        }
      }
    }
  }

  setupMessageListener() {
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('收到消息:', message);
        if (message.type === 'updateSettings') {
          this.settings = message.settings;
          sendResponse({ received: true });
        }
        return true; // 保持消息通道开启
      });
      console.log('消息监听器设置成功');
    } catch (error) {
      console.error('设置消息监听器失败:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'targetLanguage',
        'autoTranslateEnabled'
      ]);
      this.settings = {
        targetLang: result.targetLanguage || 'zh',
        autoTranslateEnabled: result.autoTranslateEnabled ?? true
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
}

// 修改初始化部分
(function () {
  // 首先创建全局对象和方法
  window.discordTranslator = {
    contentScript: null,
    observer: null,
    translateMessages: async function () {
      console.log('尝试翻译消息');
      if (this.observer) {
        await this.observer.retryTranslateExistingMessages();
      } else {
        console.error('观察器未初始化');
      }
    },
    debugSelectors: function () {
      if (this.observer) {
        this.observer.debugSelectors();
      } else {
        console.error('观察器未初始化');
      }
    }
  };

  // 初始化函数
  async function initialize() {
    try {
      console.log('开始初始化 Discord 翻译助手');

      // 等待页面加载
      if (document.readyState !== 'complete') {
        await new Promise(resolve => window.addEventListener('load', resolve));
      }

      // 创建并初始化内容脚本
      const contentScript = new ContentScript();
      await contentScript.init();

      // 更新全局对象
      window.discordTranslator.contentScript = contentScript;
      window.discordTranslator.observer = contentScript.observer;

      // 创建快捷方法
      window.translateMessages = window.discordTranslator.translateMessages.bind(window.discordTranslator);
      window.debugSelectors = window.discordTranslator.debugSelectors.bind(window.discordTranslator);

      console.log('Discord 翻译助手初始化完成');
      console.log('可用命令：');
      console.log('- window.translateMessages()');
      console.log('- window.debugSelectors()');

      // 自动翻译现有消息
      await window.translateMessages();
    } catch (error) {
      console.error('初始化失败:', error);
    }
  }

  // 启动初始化
  console.log('开始加载 Discord 翻译助手');
  initialize().catch(error => {
    console.error('初始化过程失败:', error);
  });
})();