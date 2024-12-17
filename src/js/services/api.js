import { RateLimiter } from '../utils/rate-limiter.js';

const API_CONFIG = {
  BASE_URL: 'https://api.mymemory.translated.net/get',
  MAX_REQUESTS: 5,
  TIME_WINDOW: 1000
};

class TranslationAPI {
  constructor() {
    this.rateLimiter = new RateLimiter(API_CONFIG.MAX_REQUESTS, API_CONFIG.TIME_WINDOW);
  }

  async translate(text, sourceLang, targetLang) {
    return this.rateLimiter.addToQueue(async () => {
      const url = `${API_CONFIG.BASE_URL}?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.handleResponse(data);
    });
  }

  handleResponse(data) {
    if (data.responseStatus === 429) {
      throw new Error('API_LIMIT_REACHED');
    }
    if (data.responseStatus === 200 && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    throw new Error('TRANSLATION_FAILED');
  }
}

export const translationAPI = new TranslationAPI(); 