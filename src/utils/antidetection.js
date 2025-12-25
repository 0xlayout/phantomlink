  import randomUserAgent from 'random-useragent';
  import UAParser from 'ua-parser-js';

  const REAL_UA = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0'
  ];

  export function getRandomHeaders() {
    const ua = randomUserAgent.getRandom() || REAL_UA[Math.floor(Math.random() * REAL_UA.length)];
    const parser = new UAParser(ua);
    const result = parser.getResult();

    return {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'TE': 'trailers'
    };
  }

  export function getCanvasFingerprint() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'; 
  }

  export const PROXIES = []; 

  export function getRandomProxy() {
    return PROXIES.length > 0 ? PROXIES[Math.floor(Math.random() * PROXIES.length)] : null;
  }