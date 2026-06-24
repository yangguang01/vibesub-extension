(function(global) {
  const config = global.VibeSubConfig;

  const endpoints = {
    tasks() {
      return '/api/tasks';
    },
    taskStatus(taskId) {
      return `/api/tasks/${encodeURIComponent(taskId)}/status`;
    },
    taskStrategies(taskId) {
      return `/api/tasks/${encodeURIComponent(taskId)}/strategies`;
    },
    subtitle(taskId) {
      return `/api/subtitles/${encodeURIComponent(taskId)}`;
    },
    limitInfo() {
      return '/api/tasks/limit/info';
    },
    sessionLogout() {
      return '/api/auth/sessionLogout';
    }
  };

  async function buildError(response, fallbackMessage) {
    let message = fallbackMessage;
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        message = data.detail || data.message || message;
      } else {
        const text = await response.text();
        message = text || message;
      }
    } catch (error) {
      // Keep the fallback message when the error body cannot be parsed.
    }

    const error = new Error(message);
    error.status = response.status;
    return error;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${config.API_SERVER}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      throw await buildError(response, `请求失败: ${response.status}`);
    }

    return response;
  }

  async function fetchJson(path, options) {
    const response = await request(path, options);
    return response.json();
  }

  async function fetchText(path, options) {
    const response = await request(path, options);
    return response.text();
  }

  function createTranslationTask(data) {
    return fetchJson(endpoints.tasks(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  global.VibeSubApi = Object.freeze({
    endpoints: Object.freeze(endpoints),
    request,
    fetchJson,
    fetchText,
    createTranslationTask
  });
})(globalThis);
