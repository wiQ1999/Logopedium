export const STORAGE_KEY = 'logopedium.params';

export const SETTINGS_VERSION = 3;

function storage() {
  try {
    const store = globalThis.localStorage;
    return store && typeof store.getItem === 'function' ? store : null;
  } catch (error) {
    return null;
  }
}

export function readSettings() {
  const store = storage();
  if (!store) {
    return null;
  }
  let payload;
  try {
    payload = store.getItem(STORAGE_KEY);
  } catch (error) {
    return null;
  }
  if (!payload) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || parsed.version !== SETTINGS_VERSION) {
    return null;
  }
  return parsed;
}

export function writeSettings(value) {
  const store = storage();
  if (!store) {
    return false;
  }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...value, version: SETTINGS_VERSION }));
    return true;
  } catch (error) {
    return false;
  }
}

export function clearSettings() {
  const store = storage();
  if (!store) {
    return false;
  }
  try {
    store.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    return false;
  }
}
