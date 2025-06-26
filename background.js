/**
 * Tube Trans - AI精翻字幕
 * 后台脚本 (Background Script)
 */

// 引入调试模块
importScripts('debug.js');

// API服务器地址
const API_SERVER = 'https://api.rxaigc.com';

// 任务状态轮询间隔（毫秒）
const POLLING_INTERVAL = 15000;

// 最大轮询次数限制
const MAX_POLLING_COUNT = 240; // 240次 * 15秒 = 1小时

// 活跃任务管理
const activeTasks = {};

/**
 * 登录状态管理器
 */
class LoginManager {
  constructor() {
    this.userInfo = null;
    this.isCheckingLogin = false;
  }

  /**
   * 检查用户登录状态
   * @returns {Promise<{isLoggedIn: boolean, userInfo: object|null}>}
   */
  async checkLoginStatus() {
    if (this.isCheckingLogin) {
      // 避免重复检查
      return { isLoggedIn: !!this.userInfo, userInfo: this.userInfo };
    }

    this.isCheckingLogin = true;
    
    try {
      TubeTransDebug.log('开始检查登录状态...');
      
      // 检查.rxaigc.com域名下的session cookie
      const cookies = await chrome.cookies.getAll({
        domain: '.rxaigc.com',
        name: 'session'
      });
      
      const sessionCookie = cookies.find(cookie => cookie.name === 'session');
      
      if (sessionCookie && sessionCookie.value) {
        TubeTransDebug.log('找到session cookie，用户已登录');
        
        // 调用fetchUserInfo获取最新的用户信息和daily_quota
        const userInfo = await this.fetchUserInfo();
        
        if (userInfo) {
          this.userInfo = userInfo;
          return { isLoggedIn: true, userInfo: this.userInfo };
        } else {
          // 如果获取用户信息失败，使用默认信息
          this.userInfo = {
            username: '已登录',
            daily_quota: '--'
          };
          return { isLoggedIn: true, userInfo: this.userInfo };
        }
      } else {
        TubeTransDebug.log('未找到session cookie，用户未登录');
        this.userInfo = null;
        return { isLoggedIn: false, userInfo: null };
      }
    } catch (error) {
      TubeTransDebug.error('检查登录状态失败:', error);
      this.userInfo = null;
      return { isLoggedIn: false, userInfo: null };
    } finally {
      this.isCheckingLogin = false;
    }
  }

  /**
   * 从API获取用户详细信息
   */
  async fetchUserInfo() {
    try {
      const response = await fetch(`${API_SERVER}/api/tasks/limit/info`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const limitInfo = await response.json();
        TubeTransDebug.log('从API获取用户限制信息:', limitInfo);
        
        // 格式化用户信息
        const userInfo = {
          username: '已登录',
          daily_quota: `${limitInfo.used_today}/${limitInfo.daily_limit}`
        };
        
        // 更新内存中的用户信息
        this.userInfo = userInfo;
        
        return userInfo;
      } else {
        TubeTransDebug.log('获取用户限制信息失败，状态码:', response.status);
      }
    } catch (error) {
      TubeTransDebug.error('获取用户限制信息API调用失败:', error);
    }
    
    return null;
  }

  /**
   * 用户登出
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async logout() {
    try {
      TubeTransDebug.log('开始用户登出...');
      
      // 清除本地存储的用户信息
      await chrome.storage.local.remove(['user_info']);
      this.userInfo = null;
      
      // 可以在这里调用登出API（如果需要）
      // await this.callLogoutAPI();
      
      TubeTransDebug.log('用户登出成功');
      return { success: true };
    } catch (error) {
      TubeTransDebug.error('登出失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 调用登出API（可选）
   */
  async callLogoutAPI() {
    try {
      await fetch(`${API_SERVER}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      TubeTransDebug.error('调用登出API失败:', error);
    }
  }

  /**
   * 获取当前用户信息
   * @returns {object|null}
   */
  getCurrentUserInfo() {
    return this.userInfo;
  }

  /**
   * 设置测试登录状态（仅用于开发）
   * @param {object} testUserInfo - 测试用户信息
   */
  async setTestLoginStatus(testUserInfo = null) {
    const defaultTestUser = {
      username: '测试用户',
      daily_quota: 500,
      user_id: 'test_user_123'
    };
    
    this.userInfo = testUserInfo || defaultTestUser;
    
    // 保存到存储
    await chrome.storage.local.set({ 'user_info': this.userInfo });
    
    TubeTransDebug.log('已设置测试登录状态:', this.userInfo);
    return { isLoggedIn: true, userInfo: this.userInfo };
  }
}

// 创建全局登录管理器实例
const loginManager = new LoginManager();

/**
 * 任务管理器
 */
class TaskManager {
  constructor() {
    this.activeTasks = {};
  }

  /**
   * 创建翻译任务
   * @param {object} taskData - 任务数据
   * @returns {Promise<{success: boolean, taskId?: string, message?: string}>}
   */
  async createTranslationTask(taskData) {
    try {
      TubeTransDebug.log('[TaskManager] 创建翻译任务:', taskData);
      
      // 验证必要参数
      if (!taskData.youtube_url || !taskData.videoId) {
        throw new Error('缺少必要的任务参数');
      }

      // 构建请求数据
      const requestData = {
        youtube_url: taskData.youtube_url,
        content_name: taskData.content_name || '',
        channel_name: taskData.channel_name || '',
        // 可扩展其他参数
        custom_prompt: taskData.custom_prompt || '',
        special_terms: taskData.special_terms || '',
        language: taskData.language || 'zh-CN'
      };

      TubeTransDebug.log('[TaskManager] 发送API请求:', requestData);

      // 发送API请求
      const response = await fetch(`${API_SERVER}/api/tasks`, {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(requestData)
      });

      TubeTransDebug.log('[TaskManager] API响应状态:', response.status);

      // 处理401未授权错误
      if (response.status === 401) {
        // 清除本地用户信息，通知前端重新登录
        await chrome.storage.local.remove(['user_info']);
        return {
          success: false,
          message: '登录状态已过期，请重新登录',
          needRelogin: true
        };
      }

      // 解析响应数据
      const data = await response.json();
      TubeTransDebug.log('[TaskManager] API响应数据:', data);

      if (!response.ok) {
        throw new Error(data.detail || data.message || '创建任务失败');
      }

      // 获取任务ID
      const taskId = data.task_id;
      if (!taskId) {
        throw new Error('服务器未返回任务ID');
      }

      // 保存任务状态到本地存储
      await this.saveTaskStatus(taskData.videoId, {
        taskId: taskId,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString()
      });

      // 开始轮询任务状态
      startTaskPolling(taskId, taskData.videoId);

      TubeTransDebug.log('[TaskManager] 任务创建成功:', taskId);
      return {
        success: true,
        taskId: taskId,
        message: '任务创建成功'
      };

    } catch (error) {
      TubeTransDebug.error('[TaskManager] 创建任务失败:', error);
      return {
        success: false,
        message: error.message || '创建任务失败'
      };
    }
  }

  /**
   * 保存任务状态到本地存储
   * @param {string} videoId - 视频ID
   * @param {object} status - 任务状态
   */
  async saveTaskStatus(videoId, status) {
    if (!videoId) return;
    
    try {
      const key = `task_status_${videoId}`;
      await chrome.storage.local.set({ [key]: status });
      TubeTransDebug.log(`[TaskManager] 已保存任务状态: ${key}`, status);
    } catch (error) {
      TubeTransDebug.error('[TaskManager] 保存任务状态失败:', error);
    }
  }

  /**
   * 获取字幕内容
   * @param {string} videoId - 视频ID
   * @returns {Promise<string|null>} 字幕内容或null
   */
  async getSubtitleFromStorage(videoId) {
    if (!videoId) return null;
    
    try {
      const key = `subtitle_${videoId}`;
      const data = await chrome.storage.local.get([key]);
      return data[key] || null;
    } catch (error) {
      TubeTransDebug.error('[TaskManager] 从存储获取字幕失败:', error);
      return null;
    }
  }
}

// 创建全局任务管理器实例
const taskManager = new TaskManager();

// 初始化监听器
function initBackgroundListeners() {
  TubeTransDebug.log('[Background] 初始化后台任务监听器');
  
  // 监听来自popup或content script的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    TubeTransDebug.log('[Background] 收到消息:', message);
    
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
    
    switch (message.action) {
      case 'checkLoginStatus':
        loginManager.checkLoginStatus()
          .then(result => {
            TubeTransDebug.log('返回登录状态:', result);
            sendResponse(result);
          })
          .catch(error => {
            TubeTransDebug.error('检查登录状态失败:', error);
            sendResponse({ isLoggedIn: false, userInfo: null, error: error.message });
          });
        return true; // 保持消息通道开放
        
      case 'logout':
        loginManager.logout()
          .then(result => {
            TubeTransDebug.log('登出结果:', result);
            sendResponse(result);
          })
          .catch(error => {
            TubeTransDebug.error('登出失败:', error);
            sendResponse({ success: false, message: error.message });
          });
        return true;
        
      case 'setTestLoginStatus':
        loginManager.setTestLoginStatus(message.testUserInfo)
          .then(result => {
            TubeTransDebug.log('设置测试登录状态结果:', result);
            sendResponse(result);
          })
          .catch(error => {
            TubeTransDebug.error('设置测试登录状态失败:', error);
            sendResponse({ isLoggedIn: false, userInfo: null, error: error.message });
          });
        return true;
        
      case 'getCurrentUserInfo':
        const userInfo = loginManager.getCurrentUserInfo();
        sendResponse({ userInfo });
        break;

      case 'createTranslationTask':
        taskManager.createTranslationTask(message.taskData)
          .then(result => {
            TubeTransDebug.log('创建翻译任务结果:', result);
            sendResponse(result);
          })
          .catch(error => {
            TubeTransDebug.error('创建翻译任务失败:', error);
            sendResponse({ success: false, message: error.message });
          });
        return true;

        case 'fetchTranslationStrategies': 
          const { taskId, videoId } = message;
          TubeTransDebug.log(`[Background] 收到 popup 的重拉策略请求：${taskId}`);
          
          // 调用已有的函数去拉取策略并存到 storage
          fetchTranslationStrategies(taskId, videoId)
            .then(async () => {
              // 拉取完毕后立即从 storage 读一遍，回传给 popup
              const key = `translation_strategies_${videoId}`;
              const data = await chrome.storage.local.get(key);
              sendResponse({ success: true, strategies: data[key] });
            })
            .catch(err => {
              TubeTransDebug.error(`[Background] fetchTranslationStrategies 错误：`, err);
              sendResponse({ success: false });
            });
    
          // 告诉 Chrome：我们稍后会异步调用 sendResponse
          return true;

      case 'getSubtitleFromStorage':
        taskManager.getSubtitleFromStorage(message.videoId)
          .then(subtitle => {
            TubeTransDebug.log('获取字幕结果:', subtitle ? '字幕已找到' : '未找到字幕');
            sendResponse({ success: true, subtitle: subtitle });
          })
          .catch(error => {
            TubeTransDebug.error('获取字幕失败:', error);
            sendResponse({ success: false, message: error.message });
          });
        return true;
      
      default:
        TubeTransDebug.log('未知消息类型:', message.action);
        sendResponse({ success: false, message: '未知消息类型' });
    }
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
    TubeTransDebug.log(`[Background] 任务 ${taskId} 已在轮询中`);
    return;
  }
  
  TubeTransDebug.log(`[Background] 开始轮询任务 ${taskId} 的状态`);
  
  // 初始化任务状态
  activeTasks[taskId] = {
    videoId: videoId,
    status: 'processing',
    progress: 0,
    startTime: new Date().toISOString(),
    lastCheck: new Date().toISOString(),
    errorCount: 0, // 初始化错误计数
    pollCount: 0 // 初始化轮询计数
  };
  
  // 等待10秒后检查
  setTimeout(() => checkTaskStatus(taskId), 20000);
  
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
    TubeTransDebug.log(`[Background] 任务 ${taskId} 未在轮询`);
    return;
  }
  
  TubeTransDebug.log(`[Background] 停止轮询任务 ${taskId} 的状态`);
  
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
    TubeTransDebug.log(`[Background] 找不到任务 ${taskId} 的状态`);
    return;
  }
  
  // 增加轮询计数
  activeTasks[taskId].pollCount = (activeTasks[taskId].pollCount || 0) + 1;
  
  // 检查是否超过最大轮询次数
  if (activeTasks[taskId].pollCount > MAX_POLLING_COUNT) {
    TubeTransDebug.error(`[Background] 任务 ${taskId} 轮询次数超过限制 (${MAX_POLLING_COUNT})，停止轮询`);
    stopTaskPolling(taskId);
    
    // 更新任务状态为失败
    activeTasks[taskId].status = 'failed';
    activeTasks[taskId].errorMessage = '任务处理超时，请重试';
    
    // 保存失败状态
    await saveTaskStatus(activeTasks[taskId].videoId, {
      taskId: taskId,
      status: 'failed',
      errorMessage: activeTasks[taskId].errorMessage,
      updatedAt: new Date().toISOString()
    });
    
    // 通知前端任务超时
    chrome.runtime.sendMessage({
      action: 'taskStatusUpdate',
      taskId: taskId,
      status: 'failed',
      errorMessage: activeTasks[taskId].errorMessage
    });
    
    return;
  }
  
  // 更新最后检查时间
  activeTasks[taskId].lastCheck = new Date().toISOString();
  
  try {
    TubeTransDebug.log(`[Background] 正在检查任务 ${taskId} 的状态`);
    const response = await fetch(`${API_SERVER}/api/tasks/${taskId}/status`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      TubeTransDebug.error(`[Background] 检查任务 ${taskId} 状态失败: ${response.status}`);
      
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
        TubeTransDebug.error(`[Background] 任务 ${taskId} 连续错误超过限制，停止轮询`);
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
    TubeTransDebug.log(`[Background] 任务 ${taskId} 状态:`, data);
    
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
      TubeTransDebug.log(`[Background] 任务 ${taskId} 已完成`);
      
      // 下载字幕文件
      await downloadSubtitleFile(taskId, activeTasks[taskId].videoId);
      
      // 停止轮询
      stopTaskPolling(taskId);
    } 
    else if (data.status === 'strategies_ready') {
      TubeTransDebug.log(`[Background] 任务 ${taskId} 翻译策略已就绪`);
      // 只在第一次状态为strategies_ready时获取策略
      if (!activeTasks[taskId].strategiesFetched) {
        await fetchTranslationStrategies(taskId, activeTasks[taskId].videoId);
        // 标记已获取策略
        activeTasks[taskId].strategiesFetched = true;
        
        TubeTransDebug.log(`[Background] 任务 ${taskId} 已获取翻译策略，不会重复获取`);
      } else {
        TubeTransDebug.log(`[Background] 任务 ${taskId} 已经获取过翻译策略，跳过重复获取`);
      }
      
      // 不停止轮询，继续等待翻译完成
    }
    else if (data.status === 'failed') {
      TubeTransDebug.error(`[Background] 任务 ${taskId} 失败:`, data.error || '未知错误');
      
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
    TubeTransDebug.error(`[Background] 检查任务 ${taskId} 状态出错:`, error);
    
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
      TubeTransDebug.error(`[Background] 任务 ${taskId} 连续错误超过限制，停止轮询`);
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
    TubeTransDebug.log(`[Background] 已保存任务状态: ${key}`, status);
  } catch (error) {
    TubeTransDebug.error('[Background] 保存任务状态失败:', error);
  }
}

/**
 * 下载字幕文件
 * @param {string} taskId - 任务ID
 * @param {string} videoId - 视频ID
 */
async function downloadSubtitleFile(taskId, videoId) {
  try {
    TubeTransDebug.log(`[Background] 下载任务 ${taskId} 的字幕文件`);
    
    const response = await fetch(`${API_SERVER}/api/subtitles/${taskId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`下载字幕失败: ${response.status}`);
    }
    
    const srtContent = await response.text();
    
    // 保存字幕到本地存储
    const key = `subtitle_${videoId}`;
    await chrome.storage.local.set({ [key]: srtContent });
    TubeTransDebug.log(`[Background] 已保存字幕到本地存储: ${key}`);
    
    return true;
  } catch (error) {
    TubeTransDebug.error('[Background] 下载字幕文件失败:', error);
    return false;
  }
}

/**
   * 更新翻译策略数据
   * @param {string} videoId - 视频ID
   * @param {Object} strategies - 翻译策略数据
   */
async function updateTranslationStrategies(videoId, strategies_data) {
  if (!videoId) return;
  TubeTransDebug.log('开始在任务状态中写入翻译策略', strategies_data);

  try {
    await chrome.storage.local.set({
      [`translation_strategies_${videoId}`]: strategies_data,
      [`has_translation_strategies_${videoId}`]: true
    });
    TubeTransDebug.log(`翻译策略已写入: ${videoId}`, strategies_data);
  } catch (error) {
    TubeTransDebug.error('更新翻译策略失败:', error);
  }
}

/**
 * 获取翻译策略
 * @param {string} taskId - 任务ID
 * @param {string} videoId - 视频ID
 */
async function fetchTranslationStrategies(taskId, videoId) {
  try {
    TubeTransDebug.log(`[Background] 获取任务 ${taskId} 的翻译策略`);
    
    const response = await fetch(`${API_SERVER}/api/tasks/${taskId}/strategies`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`获取翻译策略失败: ${response.status}`);
    }
    
    const strategiesData = await response.json();
    TubeTransDebug.log(`[Background] 获取到翻译策略:`, strategiesData);

    // 保存翻译策略到存储
    updateTranslationStrategies(videoId, strategiesData);
    TubeTransDebug.log('保存翻译策略到存储', strategiesData);
    
    // 通知前端更新翻译策略
    chrome.runtime.sendMessage({
      action: 'taskStatusUpdate',
      taskId: taskId,
      status: 'strategies_ready',
      translationStrategies: strategiesData,
      progress: '0.2',
    });
    
    return true;
  } catch (error) {
    TubeTransDebug.error('[Background] 获取翻译策略失败:', error);
    return false;
  }
}

// 初始化后台服务
initBackgroundListeners();

TubeTransDebug.log('[Background] 后台脚本已加载');