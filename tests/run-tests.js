const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { console };
context.globalThis = context;

for (const file of ['shared/storage.js', 'shared/status.js', 'shared/srt.js']) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInNewContext(code, context, { filename: file });
}

const { VibeSubStorage, VibeSubStatus, VibeSubSrt } = context;

assert.strictEqual(VibeSubStorage.keys.taskStatus('abc123'), 'task_status_abc123');
assert.strictEqual(VibeSubStorage.keys.subtitle('abc123'), 'subtitle_abc123');
assert.strictEqual(VibeSubStorage.keys.translationStrategies('abc123'), 'translation_strategies_abc123');
assert.strictEqual(VibeSubStorage.keys.hasTranslationStrategies('abc123'), 'has_translation_strategies_abc123');

assert.strictEqual(VibeSubStatus.getStatusText('pending'), '等待处理...');
assert.strictEqual(VibeSubStatus.getStatusText('processing'), '思考翻译策略...');
assert.strictEqual(VibeSubStatus.getStatusText('asr_ready'), '字幕识别完成，准备翻译...');
assert.strictEqual(VibeSubStatus.getStatusText('translating'), '正在翻译...');
assert.strictEqual(VibeSubStatus.getStatusText('completed'), '翻译完成！');
assert.strictEqual(VibeSubStatus.getStatusText('unknown'), '状态异常，请刷新页面');
assert.strictEqual(VibeSubStatus.normalizeProgress('0.2'), 0.2);
assert.strictEqual(VibeSubStatus.normalizeProgress(2), 1);
assert.strictEqual(VibeSubStatus.normalizeProgress('bad', 0.4), 0.4);
assert.strictEqual(VibeSubStatus.nextProgress(0.4, 0.2), 0.4);
assert.strictEqual(VibeSubStatus.nextProgress(0.4, 0.7), 0.7);
assert.strictEqual(VibeSubStatus.nextProgress(0.4, 'bad'), 0.4);

assert.strictEqual(VibeSubSrt.timeToSeconds('00:00:00,000'), 0);
assert.strictEqual(VibeSubSrt.timeToSeconds('01:02:03,450'), 3723.45);

const subtitles = VibeSubSrt.parseSRT(`1
00:00:00,000 --> 00:00:01,500
<b>第一行</b>
第二行

2
00:00:02,000 --> 00:00:03,000
正常字幕`);

assert.strictEqual(subtitles.length, 2);
assert.strictEqual(subtitles[0].start, 0);
assert.strictEqual(subtitles[0].end, 1.5);
assert.strictEqual(subtitles[0].text, '<b>第一行</b>\n第二行');
assert.deepStrictEqual(Array.from(VibeSubSrt.toDisplayLines('<img src=x onerror=alert(1)>\n第二行')), [
  '<img src=x onerror=alert(1)>',
  '第二行'
]);

const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
assert.match(styles, /\.youtube-custom-subtitle\s*\{[\s\S]*pointer-events:\s*none;/);
assert.match(styles, /\.youtube-custom-subtitle span\s*\{[\s\S]*pointer-events:\s*auto;/);

const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
assert.match(background, /startTaskPolling\(taskId,\s*taskData\.videoId,\s*\{[\s\S]*status:\s*initialStatus,[\s\S]*progress:\s*data\.progress[\s\S]*\}\);/);
assert.match(background, /const initialTaskState = typeof initialState === 'string'[\s\S]*progress:\s*VibeSubStatus\.normalizeProgress\(initialTaskState\.progress,\s*0\)/);
assert.match(background, /await updateTranslationStrategies\(videoId,\s*strategiesData\);/);

const popup = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
assert.match(popup, /action:\s*ACTIONS\.START_TASK_POLLING,[\s\S]*initialTaskState:\s*taskStatus/);

const content = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
assert.match(content, /if \(subtitleEngine\) \{[\s\S]*subtitleEngine\.stop\(\);[\s\S]*subtitleEngine = null;[\s\S]*\}[\s\S]*subtitleEngine = new SubtitleEngine\(videoElement\);/);

const subtitleEngine = fs.readFileSync(path.join(root, 'subtitle-engine.js'), 'utf8');
assert.match(subtitleEngine, /this\.updateSubtitlePosition\(\);[\s\S]*TubeTransDebug\.log\('SubtitleEngine: 加载位置设置'/);
assert.match(subtitleEngine, /this\.subtitleContainer\.remove\(\);[\s\S]*this\.subtitleContainer = null;/);

console.log('All tests passed');
