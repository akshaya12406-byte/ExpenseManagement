const log = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  if (meta) {
    // eslint-disable-next-line no-console
    console[level](`[${timestamp}] ${message}`, meta);
  } else {
    // eslint-disable-next-line no-console
    console[level](`[${timestamp}] ${message}`);
  }
};

const logger = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      log('debug', message, meta);
    }
  },
};

export default logger;
