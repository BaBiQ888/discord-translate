// 在文件开头添加设置状态变量
let autoTranslateEnabled = true;  // 默认启用
let targetLang = 'zh';           // 默认目标语言

// 添加连接状态标志
let isConnected = false;

// 添加消息区域选择器配置
const MESSAGE_AREA_SELECTORS = {
  // 消息区域的可能选择器
  containers: [
    '[class*="messagesWrapper"]',
    '[class*="messageContent"]',
    '[class*="scroller-"]',
    // Discord 经常更新的备用选择器
    '[class*="chat-"]',
    '[class*="chatContent-"]'
  ],
  // 消息区域的可能 aria-label
  ariaLabels: {
    'en': ['Messages', 'Message area', 'Chat content'],
    'zh': ['消息', '消息区域', '聊天内容'],
    'ja': ['メッセージ', 'メッセージエリア'],
    'ko': ['메시지', '메시지 영역'],
    'es': ['Mensajes', 'Área de mensajes'],
    'fr': ['Messages', 'Zone de messages'],
    'de': ['Nachrichten', 'Nachrichtenbereich']
  }
};

// 添加消息内容选择器配置
const MESSAGE_CONTENT_SELECTORS = [
  '.messageContent-2t3eCI',
  '[class*="messageContent"]',
  '[class*="contents-"] > [class*="message"]'
];

// DOM 监视器类
class DiscordObserver {
  constructor() {
    this.observer = null;
    this.messageAreaObserver = null;
    this.currentMessageArea = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
  }

  // 初始化观察器
  init() {
    // 添加按钮观察
    this.observeHeader();

    // 监视整个文档变化，以便捕获动态加载的消息区域
    this.observer = new MutationObserver(() => this.handleDocumentMutation());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 首次尝试查找消息区域
    this.findAndObserveMessageArea();
  }

  // 处理文档变化
  handleDocumentMutation() {
    if (!this.currentMessageArea || !document.contains(this.currentMessageArea)) {
      console.log('消息区域丢失，尝试重新定位...');
      this.findAndObserveMessageArea();
    }
  }

  // 查找消息区域
  findMessageArea() {
    // 尝试通过 aria-label 查找
    for (const lang in MESSAGE_AREA_SELECTORS.ariaLabels) {
      for (const label of MESSAGE_AREA_SELECTORS.ariaLabels[lang]) {
        const element = document.querySelector(`[aria-label="${label}"]`);
        if (element) {
          console.log(`找到消息区域 (${lang}):`, label);
          return element;
        }
      }
    }

    // 尝试通过类选择器查找
    for (const selector of MESSAGE_AREA_SELECTORS.containers) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('通过选择器找到消息区域:', selector);
        return element;
      }
    }

    return null;
  }

  // 查找并观察消息区域
  async findAndObserveMessageArea() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数，停止尝试');
      return;
    }

    const messageArea = this.findMessageArea();
    if (messageArea) {
      this.reconnectAttempts = 0;
      this.observeMessageArea(messageArea);
    } else {
      console.log(`未找到消息区域，${this.reconnectDelay / 1000}秒后重试...`);
      this.reconnectAttempts++;
      setTimeout(() => this.findAndObserveMessageArea(), this.reconnectDelay);
    }
  }

  // 观察消息区域
  observeMessageArea(messageArea) {
    if (this.messageAreaObserver) {
      this.messageAreaObserver.disconnect();
    }

    this.currentMessageArea = messageArea;
    this.messageAreaObserver = new MutationObserver((mutations) => {
      this.handleMessageAreaMutation(mutations);
    });

    this.messageAreaObserver.observe(messageArea, {
      childList: true,
      subtree: true
    });

    console.log('开始观察消息区域');
  }

  // 处理消息区域变化
  handleMessageAreaMutation(mutations) {
    if (!autoTranslateEnabled) return;

    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          this.processNewMessage(node);
        }
      });
    });
  }

  // 处理新消息
  processNewMessage(node) {
    // 试所有可能的消息内容选择器
    let messageContent = null;
    for (const selector of MESSAGE_CONTENT_SELECTORS) {
      messageContent = node.matches(selector) ? node : node.querySelector(selector);
      if (messageContent) break;
    }

    if (messageContent && !messageContent.hasAttribute('data-translated')) {
      const text = messageContent.textContent.trim();
      if (text) {
        messageContent.setAttribute('data-translated', 'true');
        throttledTranslate(text, targetLang, messageContent);
      }
    }
  }

  // 清理
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.messageAreaObserver) {
      this.messageAreaObserver.disconnect();
    }
  }

  observeHeader() {
    // 监听头部区域的变化，确保按钮始终存在
    const headerObserver = new MutationObserver(() => {
      addTranslateButton();
    });

    headerObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 首次添加按钮
    addTranslateButton();
  }
}

// 创建并初始化观察器实例
const discordObserver = new DiscordObserver();

// 修改消息监听器的实现
function setupMessageListener() {
  if (isConnected) return; // 避免重复设置

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 立即发送响应
    sendResponse({ received: true });

    if (message.type === 'updateSettings') {
      // 更新设置
      autoTranslateEnabled = message.settings.autoTranslateEnabled;
      targetLang = message.settings.targetLanguage;
      console.log('设置已更新:', message.settings);
    } else if (message.type === 'reloadSettings') {
      // 重新加载设置
      loadSettings().then(() => {
        console.log('设置已重新加载');
      });
    }
  });

  isConnected = true;
  console.log('消息监听器已设置');
}

// 修改初始化函数
async function initialize() {
  try {
    await loadSettings();
    setupMessageListener();
    discordObserver.init();
    console.log('插件初始化完成');
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// 修改清理函数
window.addEventListener('unload', () => {
  discordObserver.cleanup();
});

// 添加页面可见性变化处理
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // 页面重新可见时，检查并重新连接观察器
    if (!discordObserver.currentMessageArea ||
      !document.contains(discordObserver.currentMessageArea)) {
      console.log('页面重新可见，重新初始化观察器...');
      discordObserver.findAndObserveMessageArea();
    }
  }
});

// 清理函数
window.addEventListener('unload', () => {
  if (observer) {
    observer.disconnect();
  }
});

// 添加节流函数避免过多请求
function throttle(func, limit) {
  let inThrottle;
  let lastArgs;
  let lastThis;
  let timeoutId;

  return function throttled(...args) {
    const context = this;

    // 如果已经在缓存中存在，直接执行不需要节流
    const [text, targetLang] = args;
    const sourceLang = detectLanguage(text);
    if (translationCache.get(text, sourceLang, targetLang)) {
      return func.apply(context, args);
    }

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttled.apply(lastThis, lastArgs);
          lastArgs = lastThis = null;
        }
      }, limit);
    } else {
      lastArgs = args;
      lastThis = context;
    }
  };
}

// 简单的语言检测函数
function detectLanguage(text) {
  // 检测中文字符
  const hasChineseChars = /[\u4e00-\u9fa5]/.test(text);
  // 检测日文字符
  const hasJapaneseChars = /[\u3040-\u30ff\u31f0-\u31ff]/.test(text);
  // 检测韩文字符
  const hasKoreanChars = /[\u3130-\u318F\uAC00-\uD7AF]/.test(text);

  if (hasChineseChars) return 'zh';
  if (hasJapaneseChars) return 'ja';
  if (hasKoreanChars) return 'ko';
  return 'en';
}

// 添加翻译缓存管理类
class TranslationCache {
  constructor() {
    this.init();
  }

  async init() {
    try {
      // 从 chrome.storage.local 加载缓存
      const result = await chrome.storage.local.get('translationCache');
      this.cache = result.translationCache || {};

      // 定期清理过期缓存
      setInterval(() => this.cleanCache(), 1000 * 60 * 60); // 每小时清理一次
    } catch (error) {
      console.error('初始化翻译缓存失败:', error);
      this.cache = {};
    }
  }

  // 生成缓存键
  generateKey(text, sourceLang, targetLang) {
    return `${sourceLang}:${targetLang}:${text}`;
  }

  // 获取缓存的翻译结果
  get(text, sourceLang, targetLang) {
    const key = this.generateKey(text, sourceLang, targetLang);
    const cached = this.cache[key];

    if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60 * 24) { // 24小时有效期
      return cached.translation;
    }
    return null;
  }

  // 设置翻译缓存
  async set(text, sourceLang, targetLang, translation) {
    const key = this.generateKey(text, sourceLang, targetLang);
    this.cache[key] = {
      translation,
      timestamp: Date.now()
    };

    // 异步保存到 chrome.storage
    try {
      await chrome.storage.local.set({ translationCache: this.cache });
    } catch (error) {
      console.error('保存翻译缓存失败:', error);
    }
  }

  // 清理过期缓存
  async cleanCache() {
    const now = Date.now();
    let hasChanges = false;

    Object.keys(this.cache).forEach(key => {
      if (now - this.cache[key].timestamp > 1000 * 60 * 60 * 24) {
        delete this.cache[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      try {
        await chrome.storage.local.set({ translationCache: this.cache });
      } catch (error) {
        console.error('清理翻译缓存失败:', error);
      }
    }
  }
}

// 创建翻译缓存实例
const translationCache = new TranslationCache();

// 添加 API 速率限制器类
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;      // 最大请求数
    this.timeWindow = timeWindow;        // 时间窗口（毫秒）
    this.requests = [];                  // 请求时间戳数组
    this.waiting = [];                   // 等待队列
    this.isProcessing = false;          // 是否正在处理队列
  }

  async waitForSlot() {
    const now = Date.now();

    // 清理过期的请求记录
    this.requests = this.requests.filter(time => now - time < this.timeWindow);

    // 检查是否达到限制
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return Promise.resolve();
    }

    // 计算需要等待的时间
    const oldestRequest = this.requests[0];
    const waitTime = this.timeWindow - (now - oldestRequest);

    // 返回等待Promise
    return new Promise(resolve => {
      setTimeout(() => {
        this.requests.shift();
        this.requests.push(Date.now());
        resolve();
      }, waitTime);
    });
  }

  async addToQueue(task) {
    return new Promise((resolve, reject) => {
      this.waiting.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.waiting.length === 0) return;

    this.isProcessing = true;

    while (this.waiting.length > 0) {
      const { task, resolve, reject } = this.waiting[0];

      try {
        await this.waitForSlot();
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      this.waiting.shift();
    }

    this.isProcessing = false;
  }
}

// 创建速率限制器实例（每秒最多5个请求）
const rateLimiter = new RateLimiter(5, 1000);

// 修改翻译函数，添加速率限制
async function translateText(text, targetLang = 'zh', element) {
  try {
    const sourceLang = detectLanguage(text);

    if (sourceLang === targetLang) {
      console.log('源语言与目标语言相同，无需翻译');
      return text;
    }

    // 检查缓存
    const cachedTranslation = translationCache.get(text, sourceLang, targetLang);
    if (cachedTranslation) {
      console.log('使用缓存的翻译结果');
      updateTranslationUI(element, cachedTranslation);
      return cachedTranslation;
    }

    // 将 API 请求包装在速率限制器中
    const translation = await rateLimiter.addToQueue(async () => {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // 检查 API 限制相关的响应
        if (data.responseStatus === 429 || data.responseDetails?.includes('MYMEMORY WARNING')) {
          throw new Error('API_LIMIT_REACHED');
        }

        if (data.responseStatus === 200 && data.responseData.translatedText) {
          return data.responseData.translatedText;
        } else {
          throw new Error('翻译服务响应异常');
        }
      } catch (error) {
        if (error.message === 'API_LIMIT_REACHED') {
          // 显示友好的提示
          updateTranslationUI(element, '已达到 API 限制，正在排队等待...', true);
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 5000));
          throw error; // 抛出错误以触发重试机制
        }
        throw error;
      }
    });

    // 保存到缓存
    await translationCache.set(text, sourceLang, targetLang, translation);

    // 更新UI
    updateTranslationUI(element, translation);
    return translation;

  } catch (error) {
    console.error('翻译失败:', error);

    // 根据错误类型显示不同的提示
    const errorMessage = error.message === 'API_LIMIT_REACHED'
      ? '翻译服务暂时不可用，请稍后重试'
      : '翻译失败，请重试';

    updateTranslationUI(element, errorMessage, true);
    return text;
  }
}

// 更新 updateTranslationUI 函数，支持等待状态
function updateTranslationUI(element, translatedText, isError = false, isWaiting = false) {
  const translationContainer = element.querySelector('.translation-result') ||
    document.createElement('div');

  translationContainer.className = 'translation-result';

  // 根据状态设置不同的样式
  if (isError) {
    translationContainer.style.color = '#f04747';  // 错误状态为红色
  } else if (isWaiting) {
    translationContainer.style.color = '#faa61a';  // 等待状态为橙色
  } else {
    translationContainer.style.color = '#a3a6aa';  // 正常状态为灰色
  }

  translationContainer.style.fontSize = '0.9em';
  translationContainer.style.marginTop = '4px';
  translationContainer.textContent = isWaiting
    ? '正在等待翻译...'
    : (isError ? translatedText : `翻译: ${translatedText}`);

  if (!element.querySelector('.translation-result')) {
    element.appendChild(translationContainer);
  }
}

// 使用节流包装翻译函数
const throttledTranslate = throttle(translateText, 1000);

// 在 MutationObserver 回调中使用改进后的翻译函数
const observer = new MutationObserver((mutations) => {
  if (!autoTranslateEnabled) return;  // 如果禁用了自动翻译，直接返回

  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const messageContent = node.querySelector('.messageContent-2t3eCI');
        if (messageContent && !messageContent.hasAttribute('data-translated')) {
          const text = messageContent.textContent.trim();
          messageContent.setAttribute('data-translated', 'true');
          throttledTranslate(text, targetLang, messageContent);
        }
      }
    });
  });
});

// 添加错误处理
function handleRuntimeError() {
  if (chrome.runtime.lastError) {
    console.log('Runtime error:', chrome.runtime.lastError.message);

    // 尝试重新连接
    setTimeout(() => {
      setupMessageListener();
      loadSettings(); // 重新加载设置
    }, 1000);
  }
}

// 在初始化时加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['targetLanguage', 'autoTranslateEnabled']);
    if (result.targetLanguage) {
      targetLang = result.targetLanguage;
    }
    if (typeof result.autoTranslateEnabled !== 'undefined') {
      autoTranslateEnabled = result.autoTranslateEnabled;
    }
    console.log('已加载设置:', { targetLang, autoTranslateEnabled });
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 在 DOMContentLoaded 事件处理程序中调用 loadSettings
document.addEventListener('DOMContentLoaded', () => {
  loadSettings().then(() => {
    startObserving();
  });
});

// 添加批量翻译功能
class BatchTranslator {
  constructor() {
    this.isTranslating = false;
    this.messageQueue = [];
    this.batchSize = 5; // 每批处理的消息数量
    this.processDelay = 1000; // 批次间延迟（毫秒）
  }

  // 收集当前频道所有消息
  collectMessages() {
    const messages = Array.from(document.querySelectorAll('.messageContent-2t3eCI'))
      .filter(element => !element.hasAttribute('data-translated'));
    return messages;
  }

  // 开始批量翻译
  async startBatchTranslation() {
    if (this.isTranslating) {
      console.log('批量翻译正在进行中...');
      return;
    }

    this.isTranslating = true;
    this.messageQueue = this.collectMessages();
    console.log(`找到 ${this.messageQueue.length} 条未翻译的消息`);

    try {
      await this.processBatch();
    } catch (error) {
      console.error('批量翻译出错:', error);
    } finally {
      this.isTranslating = false;
    }
  }

  // 处理消息批次
  async processBatch() {
    while (this.messageQueue.length > 0) {
      const batch = this.messageQueue.splice(0, this.batchSize);

      // 显示进度
      const remainingCount = this.messageQueue.length;
      console.log(`正在处理批次，剩余 ${remainingCount} 条消息`);

      // 并行处理当前批次的消息
      const promises = batch.map(async (element) => {
        try {
          const text = element.textContent.trim();
          if (text) {
            element.setAttribute('data-translated', 'true');
            await translateText(text, targetLang, element);
          }
        } catch (error) {
          console.error('翻译消息失败:', error);
        }
      });

      // 等待当前批次完成
      await Promise.all(promises);

      // 如果还有更多消息，等待一段时间再处理下一批
      if (this.messageQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.processDelay));
      }
    }
  }
}

// 创建批量翻译实例
const batchTranslator = new BatchTranslator();

// 添加批量翻译按钮
function addTranslateButton() {
  const header = document.querySelector('[class*="header-"]');
  if (!header || header.querySelector('.translate-all-btn')) return;

  const button = document.createElement('button');
  button.className = 'translate-all-btn';
  button.textContent = '翻译所有消息';
  button.style.cssText = `
        background-color: #7289da;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-left: 10px;
        transition: background-color 0.2s;
    `;

  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#5b6eae';
  });

  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#7289da';
  });

  button.addEventListener('click', async () => {
    if (!autoTranslateEnabled) {
      alert('请先在插件设置中启用翻译功能');
      return;
    }

    button.disabled = true;
    button.textContent = '翻译中...';

    try {
      await batchTranslator.startBatchTranslation();
      button.textContent = '翻译完成';
      setTimeout(() => {
        button.textContent = '翻译所有消息';
        button.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('批量翻译失败:', error);
      button.textContent = '翻译失败';
      setTimeout(() => {
        button.textContent = '翻译所有消息';
        button.disabled = false;
      }, 2000);
    }
  });

  header.appendChild(button);
} 