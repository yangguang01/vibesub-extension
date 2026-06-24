(function(global) {
  const actions = {
    CHECK_LOGIN_STATUS: 'checkLoginStatus',
    LOGOUT: 'logout',
    SET_TEST_LOGIN_STATUS: 'setTestLoginStatus',
    GET_CURRENT_USER_INFO: 'getCurrentUserInfo',
    CREATE_TRANSLATION_TASK: 'createTranslationTask',
    START_TASK_POLLING: 'startTaskPolling',
    STOP_TASK_POLLING: 'stopTaskPolling',
    GET_TASK_STATUS: 'getTaskStatus',
    TASK_STATUS_UPDATE: 'taskStatusUpdate',
    FETCH_TRANSLATION_STRATEGIES: 'fetchTranslationStrategies',
    GET_SUBTITLE_FROM_STORAGE: 'getSubtitleFromStorage',
    GET_VIDEO_INFO: 'getVideoInfo',
    SAVE_SUBTITLE_FILE: 'saveSubtitleFile',
    APPLY_SUBTITLES: 'applySubtitles',
    TRANSLATE_SUBTITLES_LEGACY: 'translateSubtitles'
  };

  global.VibeSubMessages = Object.freeze({ ACTIONS: Object.freeze(actions) });
})(globalThis);
