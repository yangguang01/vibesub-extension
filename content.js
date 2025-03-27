/**
 * Tube Trans - AI精翻字幕
 * 
 * 内容脚本，负责监测YouTube视频页面并初始化字幕显示
 */

console.log('Tube Trans: 内容脚本已加载');

let subtitleEngine = null;
let currentVideoId = null;
let checkVideoInterval = null;
let translationStatus = null; // 翻译状态

/**
 * 加载SRT文件
 * @param {string} videoId - 视频ID
 * @returns {Promise<string>} SRT文件内容
 */
async function loadSrtFile(videoId) {
  console.log('加载字幕文件...');
  
  try {
    // 首先尝试从本地存储加载
    const subtitles = await getSubtitleFromStorage(videoId);
    if (subtitles) {
      console.log('从本地存储加载字幕成功');
      return subtitles;
    }
    
    // 如果本地没有，使用测试文件（临时解决方案）
    const srtUrl = chrome.runtime.getURL('test.srt');
    const response = await fetch(srtUrl);
    const srtContent = await response.text();
    console.log('从测试文件加载字幕成功');
    return srtContent;
  } catch (error) {
    console.error('加载字幕文件失败:', error);
    return null;
  }
}

/**
 * 从本地存储获取字幕内容
 * @param {string} videoId - 视频ID
 * @returns {Promise<string|null>} 字幕内容或null
 */
async function getSubtitleFromStorage(videoId) {
  if (!videoId) return null;
  
  try {
    const key = `subtitle_${videoId}`;
    const data = await chrome.storage.local.get([key]);
    return data[key] || null;
  } catch (error) {
    console.error('从存储获取字幕失败:', error);
    return null;
  }
}

/**
 * 保存字幕到本地存储
 * @param {string} videoId - 视频ID
 * @param {string} srtContent - SRT字幕内容
 * @returns {Promise<boolean>} 是否成功保存
 */
async function saveSubtitleToStorage(videoId, srtContent) {
  if (!videoId || !srtContent) return false;
  
  try {
    const key = `subtitle_${videoId}`;
    await chrome.storage.local.set({ [key]: srtContent });
    console.log(`字幕已保存到本地存储，键: ${key}`);
    return true;
  } catch (error) {
    console.error('保存字幕到存储失败:', error);
    return false;
  }
}

/**
 * 从URL中提取YouTube视频ID
 * @returns {string|null} 视频ID或null
 */
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

/**
 * 初始化字幕引擎
 */
async function initSubtitles() {
  console.log('初始化字幕...');
  
  // 获取当前视频ID
  const videoId = getVideoId();
  if (!videoId) {
    console.log('无法获取视频ID');
    return false;
  }
  
  // 查找视频元素
  const videoElement = document.querySelector('video');
  if (!videoElement) {
    console.log('未找到视频元素，稍后重试');
    return false;
  }
  
  // 加载字幕文件
  const srtContent = await loadSrtFile(videoId);
  if (!srtContent) {
    console.log('未找到字幕内容，无法初始化字幕');
    return false;
  }
  
  // 创建字幕引擎
  subtitleEngine = new SubtitleEngine(videoElement);
  
  // 解析字幕
  subtitleEngine.parseSRT(srtContent);
  
  // 开始显示字幕
  subtitleEngine.start();
  
  console.log('字幕初始化完成并开始显示');
  return true;
}

/**
 * 检查页面是否为YouTube视频页面并处理字幕
 */
function checkAndProcessVideo() {
  // 检查是否在YouTube视频页面
  if (window.location.href.indexOf('youtube.com/watch') === -1) {
    console.log('不是YouTube视频页面，不处理字幕');
    return;
  }
  
  const videoId = getVideoId();
  
  // 如果视频ID变更，重新初始化字幕
  if (videoId && videoId !== currentVideoId) {
    console.log(`检测到新视频: ${videoId}，准备初始化字幕`);
    
    // 停止现有字幕显示
    if (subtitleEngine) {
      subtitleEngine.stop();
      subtitleEngine = null;
    }
    
    currentVideoId = videoId;
    
    // 先检查是否有本地保存的字幕
    getSubtitleFromStorage(videoId).then(subtitle => {
      if (subtitle) {
        console.log('找到本地保存的字幕，初始化中...');
        setTimeout(async () => {
          const success = await initSubtitles();
          if (!success) {
            console.log('使用本地字幕初始化失败，稍后重试');
            setTimeout(initSubtitles, 3000);  // 再次尝试
          }
        }, 2000);  // 等待视频加载
      } else {
        console.log('未找到本地保存的字幕，请使用插件翻译功能');
        // 可以在页面上显示提示，提醒用户使用翻译功能
        showTranslationStatus('未找到字幕，请点击插件图标翻译', false);
      }
    }).catch(error => {
      console.error('检查本地字幕时出错:', error);
    });
  }
}

/**
 * 获取当前视频信息
 * @returns {Object} 视频信息对象
 */
function getVideoInfo() {
  // 获取视频标题
  const titleElement = document.querySelector('h1.ytd-watch-metadata');
  const title = titleElement ? titleElement.textContent.trim() : '未知标题';
  
  // 获取视频缩略图
  const videoId = getVideoId();
  const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '';
  
  // 获取视频时长
  const videoElement = document.querySelector('video');
  const duration = videoElement ? videoElement.duration : 0;
  
  // 检查是否有字幕
  const hasSubtitles = document.querySelector('.ytp-subtitles-button[aria-pressed="true"]') !== null;
  
  return {
    title,
    thumbnail,
    duration,
    hasSubtitles,
    videoId
  };
}

/**
 * 显示翻译状态
 * @param {string} message - 状态消息
 * @param {boolean} isLoading - 是否为加载状态
 */
function showTranslationStatus(message, isLoading = false) {
  // 移除现有状态指示器
  if (translationStatus) {
    translationStatus.remove();
  }
  
  // 创建新的状态指示器
  translationStatus = document.createElement('div');
  translationStatus.className = 'translation-status';
  if (isLoading) {
    translationStatus.classList.add('loading');
  }
  translationStatus.textContent = message;
  
  // 添加到页面
  document.body.appendChild(translationStatus);
  
  // 如果不是加载状态，5秒后自动移除
  if (!isLoading) {
    setTimeout(() => {
      if (translationStatus) {
        translationStatus.remove();
        translationStatus = null;
      }
    }, 5000);
  }
}

// 启动周期性检查
function startMonitoring() {
  console.log('开始监控YouTube视频');
  
  // 添加一个诊断工具，可以在控制台调用
  window.debugSubtitles = function() {
    console.log('------ 字幕调试信息 ------');
    console.log('当前视频ID:', currentVideoId);
    console.log('字幕引擎状态:', subtitleEngine ? '已初始化' : '未初始化');
    
    const videoElement = document.querySelector('video');
    console.log('视频元素:', videoElement);
    
    const subtitleContainer = document.querySelector('.youtube-custom-subtitle');
    console.log('字幕容器:', subtitleContainer);
    
    if (subtitleContainer) {
      console.log('字幕容器样式:', {
        'display': subtitleContainer.style.display,
        'visibility': subtitleContainer.style.visibility,
        'zIndex': subtitleContainer.style.zIndex,
        'position': subtitleContainer.style.position,
        'bottom': subtitleContainer.style.bottom
      });
      console.log('字幕容器内容:', subtitleContainer.innerHTML);
      
      // 尝试强制显示字幕
      subtitleContainer.style.display = 'block';
      subtitleContainer.style.zIndex = '9999';
      subtitleContainer.style.visibility = 'visible';
      subtitleContainer.style.backgroundColor = 'rgba(255,0,0,0.3)';
      subtitleContainer.innerHTML = '<span style="background-color: black; color: white; padding: 5px;">测试字幕 - 如果看到此内容，则字幕系统工作正常</span>';
      
      console.log('已尝试强制显示测试字幕');
    }
    
    return '字幕调试完成，请查看控制台输出';
  };
  
  // 先执行一次检查
  checkAndProcessVideo();
  
  // 设置定期检查
  if (!checkVideoInterval) {
    checkVideoInterval = setInterval(checkAndProcessVideo, 2000);  // 每2秒检查一次
  }
  
  // 监听URL变化（处理YouTube单页应用导航）
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      console.log('检测到URL变化，重新检查视频');
      checkAndProcessVideo();
    }
  });
  
  urlObserver.observe(document.querySelector('body'), {
    childList: true,
    subtree: true
  });
}

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  // 处理获取视频信息请求
  if (message.action === 'getVideoInfo') {
    const videoInfo = getVideoInfo();
    sendResponse({ videoInfo });
    return true;
  }
  
  // 处理保存字幕文件请求
  if (message.action === 'saveSubtitleFile') {
    if (!message.data || !message.data.videoId || !message.data.srtContent) {
      sendResponse({ success: false, message: '数据不完整' });
      return true;
    }
    
    const { videoId, srtContent } = message.data;
    
    // 保存字幕到本地存储
    saveSubtitleToStorage(videoId, srtContent)
      .then(success => {
        sendResponse({ success, message: success ? '字幕已保存' : '保存字幕失败' });
      })
      .catch(error => {
        console.error('保存字幕时出错:', error);
        sendResponse({ success: false, message: error.message });
      });
    
    return true; // 保持消息通道开放，以便异步响应
  }
  
  // 处理应用字幕请求
  if (message.action === 'applySubtitles') {
    // 停止现有字幕显示
    if (subtitleEngine) {
      subtitleEngine.stop();
      subtitleEngine = null;
    }
    
    // 重新初始化字幕
    initSubtitles().then(success => {
      sendResponse({ success, message: success ? '字幕已应用' : '应用字幕失败' });
    });
    
    return true; // 保持消息通道开放，以便异步响应
  }
  
  // 处理翻译字幕请求 (兼容旧版本)
  if (message.action === 'translateSubtitles') {
    // 显示翻译中状态
    showTranslationStatus('请使用新版翻译功能', false);
    
    // 响应弹出窗口
    sendResponse({ success: false, message: '请使用新版翻译功能' });
    
    return true; // 保持消息通道开放，以便异步响应
  }
  
  return false;
});

// 页面加载完成后开始监控
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
  startMonitoring();
}