/**
 * Resolves the backend REST API base URL and WebSocket streaming URL.
 *
 * Rules:
 * 1. If explicit environment variables (VITE_API_URL / VITE_WS_URL) are set, use them.
 * 2. If running in browser on localhost or 127.0.0.1:
 *    API_BASE_URL: 'http://localhost:8000'
 *    WS_URL: 'ws://localhost:8000/ws'
 * 3. In production (e.g. mine-nav-x.vercel.app or any non-localhost host):
 *    API_BASE_URL: 'https://minenav-x.onrender.com'
 *    WS_URL: 'wss://minenav-x.onrender.com/ws'
 * 4. Ensures wss:// is always used when API_BASE_URL starts with https://.
 */

export const resolveApiBaseUrl = (envApiUrl, hostname) => {
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim().length > 0) {
    return envApiUrl.trim().replace(/\/+$/, '');
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  return 'https://minenav-x.onrender.com';
};

export const resolveWsUrl = (apiBaseUrl, envWsUrl) => {
  if (envWsUrl && typeof envWsUrl === 'string' && envWsUrl.trim().length > 0) {
    return envWsUrl.trim();
  }
  const cleanBase = (apiBaseUrl || '').trim().replace(/\/+$/, '');
  const isHttps = cleanBase.startsWith('https://');
  const host = cleanBase.replace(/^https?:\/\//, '');
  return `${isHttps ? 'wss://' : 'ws://'}${host}/ws`;
};

const currentHostname = typeof window !== 'undefined' ? window.location?.hostname : '';
const envApi = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_URL : undefined;
const envWs = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_WS_URL : undefined;

export const API_BASE_URL = resolveApiBaseUrl(envApi, currentHostname);
export const WS_URL = resolveWsUrl(API_BASE_URL, envWs);
