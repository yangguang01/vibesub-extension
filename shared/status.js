(function(global) {
  const terminalStatuses = new Set(['completed', 'failed']);
  const activeStatuses = new Set(['pending', 'processing', 'strategies_ready', 'asr_ready', 'translating']);

  function normalizeProgress(progress, fallback = 0) {
    const value = Number(progress);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(0, Math.min(1, value));
  }

  function nextProgress(currentProgress, incomingProgress) {
    const current = normalizeProgress(currentProgress, 0);
    const incoming = normalizeProgress(incomingProgress, current);
    return Math.max(current, incoming);
  }

  function getStatusText(status) {
    switch (status) {
      case 'pending':
        return '等待处理...';
      case 'processing':
        return '思考翻译策略...';
      case 'strategies_ready':
        return '正在翻译...';
      case 'asr_ready':
        return '字幕识别完成，准备翻译...';
      case 'translating':
        return '正在翻译...';
      case 'completed':
        return '翻译完成！';
      case 'failed':
        return '翻译失败';
      default:
        return '状态异常，请刷新页面';
    }
  }

  function isTerminalStatus(status) {
    return terminalStatuses.has(status);
  }

  function isActiveStatus(status) {
    return activeStatuses.has(status);
  }

  global.VibeSubStatus = Object.freeze({
    normalizeProgress,
    nextProgress,
    getStatusText,
    isTerminalStatus,
    isActiveStatus
  });
})(globalThis);
