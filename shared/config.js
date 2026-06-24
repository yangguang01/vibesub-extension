(function(global) {
  const config = {
    API_SERVER: 'https://api.rxaigc.com',
    AUTH_URL: 'https://auth.rxaigc.com',
    SESSION_COOKIE_DOMAIN: '.rxaigc.com',
    POLLING_INTERVAL_MS: 15000,
    MAX_POLLING_COUNT: 240
  };

  global.VibeSubConfig = Object.freeze(config);
})(globalThis);
