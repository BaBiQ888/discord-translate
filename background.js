// 基础的背景脚本
chrome.runtime.onInstalled.addListener(() => {
  console.log('Discord 翻译插件已安装');

  // 初始化默认设置
  chrome.storage.sync.set({
    targetLanguage: 'zh',
    autoTranslateEnabled: true
  }).then(() => {
    console.log('默认设置已初始化');
  }).catch(error => {
    console.error('设置初始化失败:', error);
  });
});

// 添加连接错误处理
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.log('Port disconnected:', chrome.runtime.lastError.message);
    }
  });
});

// 修改消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 立即发送响应
  sendResponse({ received: true });

  console.log('收到消息:', message);
  if (message.type === 'translation_error') {
    console.error('翻译错误:', message.error);
  }
});

// 添加标签页更新监听
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('discord.com')) {
    // 延迟发送消息，确保内容脚本已加载
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        type: 'reloadSettings'
      }).catch(error => {
        // 忽略连接错误，这是正常的
        if (!error.message.includes('Receiving end does not exist')) {
          console.error('重新加载设置失败:', error);
        }
      });
    }, 1000); // 等待1秒确保内容脚本加载
  }
});

// 添加错误处理函数
function handleError(error) {
  if (error.message.includes('Receiving end does not exist')) {
    console.log('内容脚本尚未准备好，这是正常的');
    return;
  }
  console.error('发生错误:', error);
} 