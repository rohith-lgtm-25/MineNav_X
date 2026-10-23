import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl, resolveWsUrl } from './api.js';

test('resolveApiBaseUrl defaults to localhost when hostname is localhost or 127.0.0.1', () => {
  assert.equal(resolveApiBaseUrl(undefined, 'localhost'), 'http://localhost:8000');
  assert.equal(resolveApiBaseUrl(undefined, '127.0.0.1'), 'http://localhost:8000');
});

test('resolveApiBaseUrl defaults to production Render backend for public hostnames', () => {
  assert.equal(resolveApiBaseUrl(undefined, 'mine-nav-x.vercel.app'), 'https://minenav-x.onrender.com');
  assert.equal(resolveApiBaseUrl(undefined, 'example.com'), 'https://minenav-x.onrender.com');
});

test('resolveApiBaseUrl honors explicit environment variable override and strips trailing slashes', () => {
  assert.equal(resolveApiBaseUrl('https://custom-api.org///', 'localhost'), 'https://custom-api.org');
  assert.equal(resolveApiBaseUrl('http://192.168.1.50:8000/', 'mine-nav-x.vercel.app'), 'http://192.168.1.50:8000');
});

test('resolveWsUrl derives secure wss:// protocol when API uses https://', () => {
  assert.equal(resolveWsUrl('https://minenav-x.onrender.com'), 'wss://minenav-x.onrender.com/ws');
  assert.equal(resolveWsUrl('https://api.my-mine.net/'), 'wss://api.my-mine.net/ws');
});

test('resolveWsUrl derives ws:// protocol when API uses http://', () => {
  assert.equal(resolveWsUrl('http://localhost:8000'), 'ws://localhost:8000/ws');
  assert.equal(resolveWsUrl('http://127.0.0.1:8000/'), 'ws://127.0.0.1:8000/ws');
});

test('resolveWsUrl respects explicit VITE_WS_URL override', () => {
  assert.equal(resolveWsUrl('https://minenav-x.onrender.com', 'wss://custom-ws.company.com/stream'), 'wss://custom-ws.company.com/stream');
});
