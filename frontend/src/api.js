// API base URL — uses relative path in production (served from same origin),
// falls back to localhost:8000 during Vite dev server
const isDev = window.location.port === '5173';
const BASE = isDev ? 'http://127.0.0.1:8000' : '';

export const API_RESEARCH = `${BASE}/research`;
export const API_HISTORY  = `${BASE}/history`;
export const API_PAPER    = `${BASE}/paper`;
export const API_AUTH     = `${BASE}/auth`;
export const API_STREAM   = `${BASE}/stream`;
export const API_VECTOR   = `${BASE}/vector-store`;
