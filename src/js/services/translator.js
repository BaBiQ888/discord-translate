export class translator {
  static async translate(text, targetLang = 'zh') {
    try {
      // 添加调试日志
      console.log('开始翻译:', { text, targetLang });

      // 使用 Google 翻译 API
      const url = new URL('https://translate.googleapis.com/translate_a/single');
      url.searchParams.append('client', 'gtx');
      url.searchParams.append('sl', 'auto');  // 自动检测源语言
      url.searchParams.append('dt', 't');
      url.searchParams.append('tl', targetLang);
      url.searchParams.append('q', text);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`翻译请求失败: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data[0]
        .map(item => item[0])
        .join('');

      console.log('翻译成功:', { original: text, translated: translatedText });
      return translatedText;
    } catch (error) {
      console.error('翻译失败:', error);
      return null;
    }
  }
} 