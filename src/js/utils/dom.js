export const DISCORD_SELECTORS = {
  MESSAGE_CONTENT: '.messageContent-2t3eCI',
  MESSAGES_CONTAINER: '[class*="messagesWrapper"]',
  HEADER: '[class*="header-"]'
};

export class UIManager {
  constructor() {
    this.pendingUpdates = new Map();
    this.updateScheduled = false;
  }

  static createTranslationElement(text, isError = false) {
    const element = document.createElement('div');
    element.className = 'translation-result';
    element.style.cssText = `
      color: ${isError ? '#f04747' : '#a3a6aa'};
      font-size: 0.9em;
      margin-top: 4px;
    `;
    element.textContent = isError ? text : `翻译: ${text}`;
    return element;
  }

  batchUpdateTranslations(updates) {
    const fragment = document.createDocumentFragment();

    updates.forEach(({ element, text, isError }) => {
      const translationElement = this.createTranslationElement(text, isError);
      const container = document.createElement('div');
      container.appendChild(translationElement);
      fragment.appendChild(container);
    });

    // 一次性更新 DOM
    requestAnimationFrame(() => {
      updates.forEach(({ element }, index) => {
        const existingTranslation = element.querySelector('.translation-result');
        if (existingTranslation) {
          existingTranslation.replaceWith(fragment.children[index].firstChild);
        } else {
          element.appendChild(fragment.children[index].firstChild);
        }
      });
    });
  }

  scheduleUpdate(element, text, isError = false) {
    this.pendingUpdates.set(element, { text, isError });

    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => this.flushUpdates());
    }
  }

  flushUpdates() {
    const updates = Array.from(this.pendingUpdates.entries()).map(
      ([element, { text, isError }]) => ({ element, text, isError })
    );

    this.batchUpdateTranslations(updates);
    this.pendingUpdates.clear();
    this.updateScheduled = false;
  }

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