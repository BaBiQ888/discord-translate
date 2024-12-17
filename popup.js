document.addEventListener('DOMContentLoaded', async () => {
  // 加载设置
  const settings = await chrome.storage.sync.get([
    'targetLanguage',
    'autoTranslateEnabled',
    'translationStyle',
    'theme'
  ]);

  // 设置初始值
  document.getElementById('autoTranslate').checked =
    settings.autoTranslateEnabled ?? true;
  document.getElementById('targetLanguage').value =
    settings.targetLanguage || 'zh';
  document.getElementById('translationStyle').value =
    settings.translationStyle || 'default';

  // 应用主题
  if (settings.theme === 'dark') {
    document.body.classList.add('dark-theme');
  }

  // 保存设置
  const saveSettings = async () => {
    const newSettings = {
      autoTranslateEnabled: document.getElementById('autoTranslate').checked,
      targetLanguage: document.getElementById('targetLanguage').value,
      translationStyle: document.getElementById('translationStyle').value
    };

    await chrome.storage.sync.set(newSettings);
    updateStatus('设置已保存');
    notifyContentScript(newSettings);
  };

  // 事件监听器
  document.getElementById('autoTranslate').addEventListener('change', saveSettings);
  document.getElementById('targetLanguage').addEventListener('change', saveSettings);
  document.getElementById('translationStyle').addEventListener('change', saveSettings);

  // 主题切换
  document.getElementById('themeToggle').addEventListener('click', async () => {
    const isDark = document.body.classList.toggle('dark-theme');
    await chrome.storage.sync.set({ theme: isDark ? 'dark' : 'light' });
    updateStatus('主题已更新');
  });
});

function updateStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.add('show');
  setTimeout(() => {
    status.classList.remove('show');
  }, 2000);
}

async function notifyContentScript(settings) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'updateSettings',
      settings
    });
  }
} 