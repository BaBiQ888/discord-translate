document.addEventListener('DOMContentLoaded', async () => {
  // 加载设置
  const settings = await chrome.storage.sync.get([
    'targetLanguage',
    'autoTranslateEnabled'
  ]);

  // 设置初始值
  document.getElementById('autoTranslate').checked =
    settings.autoTranslateEnabled ?? true;
  document.getElementById('targetLanguage').value =
    settings.targetLanguage || 'zh';

  // 保存设置
  document.getElementById('autoTranslate').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ autoTranslateEnabled: e.target.checked });
    updateStatus('设置已保存');
    notifyContentScript();
  });

  document.getElementById('targetLanguage').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ targetLanguage: e.target.value });
    updateStatus('设置已保存');
    notifyContentScript();
  });
});

function updateStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
}

async function notifyContentScript() {
  const settings = await chrome.storage.sync.get([
    'targetLanguage',
    'autoTranslateEnabled'
  ]);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'updateSettings',
      settings: {
        targetLang: settings.targetLanguage || 'zh',
        autoTranslateEnabled: settings.autoTranslateEnabled ?? true
      }
    });
  }
} 