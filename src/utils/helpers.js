  import { join, dirname } from 'path';
  import { readFileSync, writeFileSync } from 'fs';
  import { fileURLToPath } from 'url';
  import pico from 'picocolors';
  import ora from 'ora';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const ROOT = join(__dirname, '..', '..');

  export function loadConfig() {
    const configPath = join(ROOT, 'config', 'config.json');
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);

      if (!config.server?.port || typeof config.server.port !== 'number') {
        throw new Error('Invalid server.port in config');
      }
      if (!config.tunnels?.enabled?.length) {
        config.tunnels.enabled = ['localtunnel', 'cloudflared'];
      }

      return config;
    } catch (err) {
      console.error(pico.red('Config Error:') + ` ${err.message}`);
      process.exit(1);
    }
  }

  export function saveConfig(newConfig) {
    const configPath = join(ROOT, 'config', 'config.json');
    try {
      writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error(pico.red('Save Config Failed:') + ` ${err}`);
      return false;
    }
  }

  export function createSpinner(text = 'Processing') {
    return ora({
      text: pico.cyan(text),
      spinner: 'dots',
      color: 'green'
    });
  }

  export function generateRandomString(length = 16, chars = 'abcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    const charsLength = chars.length;
    const crypto = globalThis.crypto || require('crypto'); 
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % charsLength];
    }
    return result;
  }

  export function parseUserAgent(ua) {
    if (!ua) return { device: 'Unknown', os: 'Unknown', browser: 'Unknown' };

    const device = /Mobile|Tablet|iPad|iPhone|Android|KFAPWI/.test(ua) ? 'Mobile' : 'Desktop';
    const osMatch = ua.match(/\(([^)]+)\)/);
    const os = osMatch ? osMatch[1].split(';')[0].trim() : 'Unknown';
    const browser = ua.match(/Chrome|Firefox|Safari|Edge|Opera|Trident/)?.[0] || 'Unknown';

    return { device, os, browser };
  }

  export function isValidIP(ip) {
    return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
  }

  export function sanitizeData(data) {
    return JSON.parse(JSON.stringify(data, (k, v) => {
      if (k === 'password' || k === 'token') return '***REDACTED***';
      return v;
    }));
  }

  export function errorHandler() {
    return (err, req, res, next) => {
      console.error(pico.red('Server Error:') + ` ${err.stack}`);
      res.status(500).send({
        error: 'Internal Server Error',
        code: 500,
        timestamp: new Date().toISOString()
      });
    };
  }

  const rateLimitStore = new Map();
  export function rateLimiter(windowMs = 60000, max = 100) {
    return (req, res, next) => {
      const ip = req.ip;
      const now = Date.now();
      const data = rateLimitStore.get(ip) || { count: 0, lastReset: now };

      if (now - data.lastReset > windowMs) {
        data.count = 1;
        data.lastReset = now;
      } else {
        data.count++;
        if (data.count > max) {
          return res.status(429).json({ error: 'Too many requests' });
        }
      }

      rateLimitStore.set(ip, data);
      next();
    };
  }

  export default {
    loadConfig,
    saveConfig,
    createSpinner,
    generateRandomString,
    parseUserAgent,
    isValidIP,
    sanitizeData,
    errorHandler,
    rateLimiter
  };
