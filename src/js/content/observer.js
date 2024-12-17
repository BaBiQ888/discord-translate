export class DiscordObserver {
  constructor() {
    this.messageObserver = null;
    this.selectors = {
      container: [
        '[class*="messagesWrapper"]',
        '[class*="chatContent-"]',
        '.chat-3bRxxu'
      ],
      message: [
        '[class*="message-"]',
        '.message-2qnXI6',
        '.messageListItem-1-jPEz'
      ],
      content: [
        '[class*="messageContent-"]',
        '.markup-2BOw-j',
        '[class*="markup-"]'
      ]
    };
    this.translator = null;
    console.log('DiscordObserver 已初始化');
  }

  async init() {
    console.log('开始初始化 DiscordObserver');
    await this.waitForMessages();
    this.startObserving();
    setTimeout(() => this.translateExistingMessages(), 2000);
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
      const found = document.querySelectorAll(selector);
      if (found.length > 0) {
        console.log(`使用选择器 ${selector} 找到 ${found.length} 条消息`);
        messages = found;
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

  translateExistingMessages() {
    const messages = this.findMessages();
    console.log(`找到 ${messages.length} 条现有消息`);
    messages.forEach(message => {
      if (!this.isTranslated(message)) {
        this.handleMessageContent(message);
      }
    });
  }

  async handleMessageContent(contentNode) {
    if (!contentNode || this.isTranslated(contentNode)) {
      return;
    }

    const text = contentNode.textContent.trim();
    if (!text) {
      return;
    }

    console.log('处理消息:', text);
    await this.translateMessage(contentNode, text);
  }

  isTranslated(node) {
    return node.hasAttribute('data-translated');
  }

  async translateMessage(node, text) {
    try {
      if (!this.translator) {
        throw new Error('翻译器未初始化');
      }

      const translatedText = await this.translator.translate(text);
      if (translatedText && translatedText !== text) {
        const translationContainer = document.createElement('div');
        translationContainer.className = 'translation-result';
        translationContainer.style.cssText = `
          color: #72767d;
          font-size: 0.9em;
          margin-top: 4px;
        `;

        node.setAttribute('data-original-text', text);
        node.setAttribute('data-translated', 'true');

        translationContainer.textContent = `译文：${translatedText}`;
        node.parentNode.insertBefore(translationContainer, node.nextSibling);

        console.log('翻译成功:', { original: text, translated: translatedText });
      }
    } catch (error) {
      console.error('翻译失败:', error);
    }
  }

  setTranslator(translatorInstance) {
    this.translator = translatorInstance;
    console.log('翻译器已设置');
  }
} 