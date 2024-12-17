// Mock chrome API
global.chrome = {
  runtime: {
    lastError: null,
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
};

// Mock fetch
global.fetch = jest.fn();

// 添加 DOM 环境辅助函数
global.createTestElement = () => {
  const element = document.createElement('div');
  element.className = 'messageContent-2t3eCI';
  return element;
}; 