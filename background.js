/**
 * Tube Trans - AI精翻字幕
 * 后台脚本 (Background Script)
 */

// API服务器地址
const API_SERVER = 'https://tube-trans-server-v2-565406642878.us-west1.run.app';

// 任务状态轮询间隔（毫秒）
const POLLING_INTERVAL = 15000;

// 活跃任务管理
const activeTasks = {};

// 初始化监听器
function initBackgroundListeners() {
  console.log('[Background] 初始化后台任务监听器');
  
  // 监听来自popup或content script的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] 收到消息:', message);
    
    if (message.action === 'startTaskPolling') {
      // 开始轮询任务状态
      startTaskPolling(message.taskId, message.videoId);
      sendResponse({ success: true });
    }
    else if (message.action === 'stopTaskPolling') {
      // 停止轮询任务状态
      stopTaskPolling(message.taskId);
      sendResponse({ success: true });
    }
    else if (message.action === 'getTaskStatus') {
      // 获取任务状态
      const status = activeTasks[message.taskId];
      sendResponse({ success: true, status: status });
    }
    
    return true; // 保持消息通道开放（异步响应）
  });
}

/**
 * 开始轮询任务状态
 * @param {string} taskId - 任务ID
 * @param {string} videoId - 视频ID
 */
function startTaskPolling(taskId, videoId) {
  // 防止重复启动
  if (activeTasks[taskId] && activeTasks[taskId].intervalId) {
    console.log(`[Background] 任务 ${taskId} 已在轮询中`);
    return;
  }
  
  console.log(`[Background] 开始轮询任务 ${taskId} 的状态`);
  
  // 初始化任务状态
  activeTasks[taskId] = {
    videoId: videoId,
    status: 'processing',
    progress: 0,
    startTime: new Date().toISOString(),
    lastCheck: new Date().toISOString(),
    errorCount: 0 // 初始化错误计数
  };
  
  // 立即检查一次
  checkTaskStatus(taskId);
  
  // 设置定时器
  const intervalId = setInterval(() => checkTaskStatus(taskId), POLLING_INTERVAL);
  activeTasks[taskId].intervalId = intervalId;
}

/**
 * 停止轮询任务状态
 * @param {string} taskId - 任务ID
 */
function stopTaskPolling(taskId) {
  if (!activeTasks[taskId] || !activeTasks[taskId].intervalId) {
    console.log(`[Background] 任务 ${taskId} 未在轮询`);
    return;
  }
  
  console.log(`[Background] 停止轮询任务 ${taskId} 的状态`);
  
  // 清除定时器
  clearInterval(activeTasks[taskId].intervalId);
  activeTasks[taskId].intervalId = null;
}

/**
 * 检查任务状态
 * @param {string} taskId - 任务ID
 */
async function checkTaskStatus(taskId) {
  if (!taskId || !activeTasks[taskId]) {
    console.log(`[Background] 找不到任务 ${taskId} 的状态`);
    return;
  }
  
  // 更新最后检查时间
  activeTasks[taskId].lastCheck = new Date().toISOString();
  
  try {
    console.log(`[Background] 正在检查任务 ${taskId} 的状态`);
    const response = await fetch(`${API_SERVER}/api/tasks/${taskId}`);
    
    if (!response.ok) {
      console.error(`[Background] 检查任务 ${taskId} 状态失败: ${response.status}`);
      
      // 连续错误计数
      activeTasks[taskId].errorCount = (activeTasks[taskId].errorCount || 0) + 1;
      
      // 直接通知前端
      chrome.runtime.sendMessage({
        action: 'taskStatusUpdate',
        taskId: taskId,
        status: activeTasks[taskId].status,
        progress: activeTasks[taskId].progress,
        errorMessage: `连接服务器出错 (${response.status})`,
        isError: true
      });
      
      // 如果连续错误超过5次，停止轮询
      if (activeTasks[taskId].errorCount > 5) {
        console.error(`[Background] 任务 ${taskId} 连续错误超过限制，停止轮询`);
        stopTaskPolling(taskId);
        
        // 更新任务状态为失败
        activeTasks[taskId].status = 'failed';
        activeTasks[taskId].errorMessage = `连接服务器出错 (${response.status})`;
        
        // 保存失败状态
        await saveTaskStatus(activeTasks[taskId].videoId, {
          taskId: taskId,
          status: 'failed',
          errorMessage: activeTasks[taskId].errorMessage,
          updatedAt: new Date().toISOString()
        });
      }
      
      return;
    }
    
    // 重置错误计数
    activeTasks[taskId].errorCount = 0;
    
    const data = await response.json();
    console.log(`[Background] 任务 ${taskId} 状态:`, data);
    
    // 更新任务状态
    activeTasks[taskId].status = data.status || 'unknown';
    activeTasks[taskId].progress = data.progress !== undefined ? data.progress : 0;
    
    // 保存最新状态到本地存储
    await saveTaskStatus(activeTasks[taskId].videoId, {
      taskId: taskId,
      status: activeTasks[taskId].status,
      progress: activeTasks[taskId].progress,
      updatedAt: new Date().toISOString()
    });
    
    // 通知前端状态更新
    chrome.runtime.sendMessage({
      action: 'taskStatusUpdate',
      taskId: taskId,
      status: activeTasks[taskId].status,
      progress: activeTasks[taskId].progress
    });
    
    // 如果任务完成或失败，执行相应操作
    if (data.status === 'completed') {
      console.log(`[Background] 任务 ${taskId} 已完成`);
      
      // 下载字幕文件
      await downloadSubtitleFile(taskId, activeTasks[taskId].videoId);
      
      // 停止轮询
      stopTaskPolling(taskId);
    } 
    else if (data.status === 'failed') {
      console.error(`[Background] 任务 ${taskId} 失败:`, data.error || '未知错误');
      
      // 更新任务状态包含错误信息
      activeTasks[taskId].errorMessage = data.error || '翻译过程中出现错误';
      
      // 保存带有错误信息的状态
      await saveTaskStatus(activeTasks[taskId].videoId, {
        taskId: taskId,
        status: 'failed',
        errorMessage: activeTasks[taskId].errorMessage,
        updatedAt: new Date().toISOString()
      });
      
      // 通知前端任务失败
      chrome.runtime.sendMessage({
        action: 'taskStatusUpdate',
        taskId: taskId,
        status: 'failed',
        errorMessage: activeTasks[taskId].errorMessage
      });
      
      // 停止轮询
      stopTaskPolling(taskId);
    }
    
  } catch (error) {
    console.error(`[Background] 检查任务 ${taskId} 状态出错:`, error);
    
    // 连续错误计数
    activeTasks[taskId].errorCount = (activeTasks[taskId].errorCount || 0) + 1;
    
    // 直接通知前端
    chrome.runtime.sendMessage({
      action: 'taskStatusUpdate',
      taskId: taskId,
      status: activeTasks[taskId].status,
      progress: activeTasks[taskId].progress,
      errorMessage: '网络连接异常',
      isError: true
    });
    
    // 如果连续错误超过5次，停止轮询
    if (activeTasks[taskId].errorCount > 5) {
      console.error(`[Background] 任务 ${taskId} 连续错误超过限制，停止轮询`);
      stopTaskPolling(taskId);
      
      // 更新任务状态为失败
      activeTasks[taskId].status = 'failed';
      activeTasks[taskId].errorMessage = '网络连接异常';
      
      // 保存失败状态
      await saveTaskStatus(activeTasks[taskId].videoId, {
        taskId: taskId,
        status: 'failed',
        errorMessage: activeTasks[taskId].errorMessage,
        updatedAt: new Date().toISOString()
      });
    }
  }
}

/**
 * 保存任务状态到本地存储
 * @param {string} videoId - 视频ID
 * @param {object} status - 任务状态
 */
async function saveTaskStatus(videoId, status) {
  if (!videoId) return;
  
  try {
    const key = `task_status_${videoId}`;
    await chrome.storage.local.set({ [key]: status });
    console.log(`[Background] 已保存任务状态: ${key}`, status);
  } catch (error) {
    console.error('[Background] 保存任务状态失败:', error);
  }
}

/**
 * 下载字幕文件
 * @param {string} taskId - 任务ID
 * @param {string} videoId - 视频ID
 */
async function downloadSubtitleFile(taskId, videoId) {
  try {
    console.log(`[Background] 下载任务 ${taskId} 的字幕文件`);
    
    const response = await fetch(`${API_SERVER}/api/subtitles/${taskId}`);
    
    if (!response.ok) {
      throw new Error(`下载字幕失败: ${response.status}`);
    }
    
    const srtContent = await response.text();
    
    // 保存字幕到本地存储
    const key = `subtitle_${videoId}`;
    await chrome.storage.local.set({ [key]: srtContent });
    console.log(`[Background] 已保存字幕到本地存储: ${key}`);
    
    return true;
  } catch (error) {
    console.error('[Background] 下载字幕文件失败:', error);
    return false;
  }
}

// 初始化后台服务
initBackgroundListeners();

console.log('[Background] 后台脚本已加载');