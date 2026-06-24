(function(global) {
  function timeToSeconds(timeString) {
    const match = String(timeString || '').trim().match(/^(\d+):([0-5]\d):([0-5]\d)(?:[,.](\d{1,3}))?$/);
    if (!match) {
      return NaN;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const milliseconds = Number((match[4] || '0').padEnd(3, '0'));

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  function toDisplayLines(text) {
    return String(text || '').split(/\n/);
  }

  function parseSRT(srtContent) {
    const normalized = String(srtContent || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    return normalized
      .split(/\n{2,}/)
      .map((block) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const timeIndex = lines.findIndex((line) => line.includes('-->'));
        if (timeIndex === -1) {
          return null;
        }

        const [startRaw, endRaw] = lines[timeIndex].split('-->').map((part) => part.trim());
        const start = timeToSeconds(startRaw);
        const end = timeToSeconds(endRaw);
        const textLines = lines.slice(timeIndex + 1);

        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || textLines.length === 0) {
          return null;
        }

        return {
          start,
          end,
          text: textLines.join('\n')
        };
      })
      .filter(Boolean);
  }

  function appendSubtitleText(parent, text) {
    parent.textContent = '';
    toDisplayLines(text).forEach((line, index) => {
      if (index > 0) {
        parent.appendChild(document.createElement('br'));
      }
      parent.appendChild(document.createTextNode(line));
    });
  }

  global.VibeSubSrt = Object.freeze({
    parseSRT,
    timeToSeconds,
    toDisplayLines,
    appendSubtitleText
  });
})(globalThis);
