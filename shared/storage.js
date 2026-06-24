(function(global) {
  const keys = {
    taskStatus(videoId) {
      return `task_status_${videoId}`;
    },
    subtitle(videoId) {
      return `subtitle_${videoId}`;
    },
    translationStrategies(videoId) {
      return `translation_strategies_${videoId}`;
    },
    hasTranslationStrategies(videoId) {
      return `has_translation_strategies_${videoId}`;
    }
  };

  global.VibeSubStorage = Object.freeze({
    keys: Object.freeze(keys),
    USER_INFO_KEY: 'user_info',
    SUBTITLE_POSITION_KEY: 'subtitlePosition',
    SUBTITLE_HINT_SHOWN_KEY: 'subtitleHintShown'
  });
})(globalThis);
