const cacheStore = new Map();

const buildCacheKey = (url, options) => {
  const { method = 'GET', body } = options || {};
  if (body && typeof body === 'object') {
    return `${method}:${url}:${JSON.stringify(body)}`;
  }
  if (typeof body === 'string') {
    return `${method}:${url}:${body}`;
  }
  return `${method}:${url}`;
};

const isCacheValid = (entry) => {
  if (!entry) return false;
  if (!entry.ttl) return true;
  return Date.now() - entry.timestamp < entry.ttl;
};

export const fetchJson = async (
  url,
  options = {},
  { useCache = true, ttl = Number(process.env.REACT_APP_API_CACHE_TTL) || 60000, cacheKey } = {},
) => {
  const key = cacheKey || buildCacheKey(url, options);

  if (useCache) {
    const cached = cacheStore.get(key);
    if (isCacheValid(cached)) {
      return cached.payload;
    }
  }

  const controller = new AbortController();
  const mergedOptions = {
    credentials: 'include',
    ...options,
    signal: options.signal || controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, mergedOptions);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const error = new Error(errorPayload.message || 'Request failed');
    error.status = response.status;
    error.payload = errorPayload;
    throw error;
  }

  const payload = await response.json();

  if (useCache) {
    cacheStore.set(key, {
      timestamp: Date.now(),
      ttl,
      payload,
    });
  }

  return payload;
};

export const clearCache = (predicate) => {
  if (!predicate) {
    cacheStore.clear();
    return;
  }
  Array.from(cacheStore.keys()).forEach((key) => {
    if (predicate(key)) {
      cacheStore.delete(key);
    }
  });
};

export default {
  fetchJson,
  clearCache,
};
