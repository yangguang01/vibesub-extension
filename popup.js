/**
 * Tube Trans - AI精翻字幕
 * 弹出窗口脚本
 */

// API服务器地址
const API_SERVER = 'https://tube-trans-server-v2-565406642878.us-west1.run.app';


document.addEventListener('DOMContentLoaded', async () => {
  // 获取DOM元素
  const videoTitleEl = document.getElementById('video-title');
  const estimatedTimeEl = document.getElementById('estimated-time');
  const channelNameEl = document.getElementById('channel-name');
  const modelSelect = document.getElementById('model');
  const customPromptInput = document.getElementById('custom-prompt');
  const specialTermsInput = document.getElementById('special-terms');
  const targetLangSelect = document.getElementById('target-lang');
  const translateBtn = document.getElementById('translate-btn');
  const progressSection = document.getElementById('translation-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressStatus = document.getElementById('progress-status');
  
  // 登录相关元素
  const loginLink = document.getElementById('login-link');
  const loginText = document.getElementById('login-text');
  const userDropdown = document.getElementById('user-dropdown');
  const logoutBtn = document.getElementById('logout-btn');
  
  // 开关按钮相关元素
  const togglePrompt = document.getElementById('toggle-prompt');
  const toggleTerms = document.getElementById('toggle-terms');
  const promptContainer = document.getElementById('prompt-container');
  const termsContainer = document.getElementById('terms-container');
  
  // 当前任务和视频信息
  let currentTaskId = null;
  let currentVideoId = null;
  
  // 用户信息
  let userInfo = null;

  // 自适应窗口高度
  function adjustPopupHeight() {
    // 计算实际内容高度，不包括内边距
    const contentEl = document.getElementById('content');
    const contentHeight = contentEl ? contentEl.scrollHeight : document.body.scrollHeight;
    
    // 确定最终高度（仅添加少量额外空间确保按钮完全可见）
    const extraSpace = 10; // 减少从20px到10px
    const finalHeight = contentHeight + extraSpace;
    
    // 设置文档高度
    document.body.style.height = finalHeight + 'px';
    document.documentElement.style.height = finalHeight + 'px';
    document.documentElement.style.minHeight = finalHeight + 'px';
    
    console.log(`调整弹出窗口高度: ${finalHeight}px (内容高度: ${contentHeight}px)`);
  }

  // 在显示内容变化时调整高度
  function updateUI() {
    // 先立即调整一次
    adjustPopupHeight();
    
    // 使用requestAnimationFrame确保在下一次重绘前调整
    requestAnimationFrame(() => {
      adjustPopupHeight();
      
      // 再延迟调整一次，以捕获任何异步变化
      setTimeout(adjustPopupHeight, 100);
    });
  }
  
  // 立即尝试获取videoId，不等待其他操作
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        if (url.hostname.includes('youtube.com') && url.pathname === '/watch') {
          currentVideoId = url.searchParams.get('v');
          // 立即加载任务状态
          if (currentVideoId) loadTaskStatus();
        }
      } catch (e) {
        console.error('解析URL失败:', e);
      }
    }
  });
  
  // 获取当前标签页的YouTube视频信息
  await getCurrentVideoInfo();

  // 设置事件监听器
  translateBtn.addEventListener('click', submitTranslationTask);
  
  // 加载任务状态
  await loadTaskStatus();
  
  // 检查登录状态
  await checkLoginStatus();
  
  // 设置登录相关事件监听
  setupLoginEvents();
  
  // 开关按钮监听
  togglePrompt.addEventListener('change', function() {
    promptContainer.style.display = this.checked ? 'block' : 'none';
    updateUI(); // 调整高度
  });
  
  toggleTerms.addEventListener('change', function() {
    termsContainer.style.display = this.checked ? 'block' : 'none';
    updateUI(); // 调整高度
  });
  
  /**
   * 获取当前标签页的YouTube视频信息
   */
  async function getCurrentVideoInfo() {
    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // 检查是否在YouTube视频页面
      if (!currentTab.url.includes('youtube.com/watch')) {
        showNoVideoMessage();
        return;
      }
      
      // 提取视频ID
      const urlParams = new URLSearchParams(new URL(currentTab.url).search);
      const videoId = urlParams.get('v');
      if (videoId) {
        currentVideoId = videoId;
      }
      
      // 从内容脚本获取视频信息
      chrome.tabs.sendMessage(
        currentTab.id, 
        { action: 'getVideoInfo' }, 
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('获取视频信息失败:', chrome.runtime.lastError);
            showNoVideoMessage();
            return;
          }
          
          if (response && response.videoInfo) {
            updateVideoInfo(response.videoInfo);
            // 确保设置了视频ID
            if (response.videoInfo.videoId) {
              currentVideoId = response.videoInfo.videoId;
            }
          } else {
            showNoVideoMessage();
          }
        }
      );
    } catch (error) {
      console.error('获取当前标签页失败:', error);
      showNoVideoMessage();
    }
  }
  
  /**
   * 更新视频信息显示
   */
  function updateVideoInfo(videoInfo) {
    console.log('收到视频信息:', videoInfo);
    
    // 更新标题
    if (videoInfo.title) {
      videoTitleEl.textContent = videoInfo.title;
    }
    
    // 更新频道名称
    if (videoInfo.channelName) {
      console.log('设置频道名称:', videoInfo.channelName);
      channelNameEl.textContent = videoInfo.channelName;
    } else {
      console.log('没有收到频道名称或为空');
      channelNameEl.textContent = '--';
    }
    
    // 计算并显示预估翻译用时
    if (videoInfo.duration) {
      estimatedTimeEl.textContent = calculateEstimatedTime(videoInfo.duration);
    }
  }
  
  /**
   * 计算预估翻译用时
   * @param {number} durationInSeconds - 视频时长（秒）
   * @returns {string} 预估翻译用时文本
   */
  function calculateEstimatedTime(durationInSeconds) {
    if (!durationInSeconds || isNaN(durationInSeconds)) {
      return '--';
    }
    
    // 预估时间：视频时长 / 10，转换为分钟
    const estimatedMinutes = Math.ceil(durationInSeconds / 60 / 10);
    
    // 不足1分钟显示为<1min
    if (estimatedMinutes < 1) {
      return '<1min';
    }
    
    return `${estimatedMinutes}min`;
  }
  
  /**
   * 显示无视频信息
   */
  function showNoVideoMessage() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = `
      <div class="no-video">
        <p><i class="fas fa-exclamation-circle"></i> 请在YouTube视频页面打开此扩展</p>
        <p>只有在观看视频时才能使用翻译功能</p>
      </div>
    `;
  }
  
  /**
   * 提交翻译任务
   */
  async function submitTranslationTask() {
    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // 确保在YouTube视频页面
      if (!currentTab.url.includes('youtube.com/watch')) {
        alert('请在YouTube视频页面使用此功能');
        return;
      }
      
      // 获取视频ID
      const urlParams = new URLSearchParams(new URL(currentTab.url).search);
      const videoId = urlParams.get('v');
      if (!videoId) {
        alert('无法获取视频ID');
        return;
      }
      
      currentVideoId = videoId;
      
      // 禁用按钮，显示加载状态
      translateBtn.disabled = true;
      translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-spinner fa-spin"></i></span>创建任务中...';
      
      // 显示进度区域
      progressSection.style.display = 'block';
      updateProgress(0, '准备中...');
      
      // 构建请求数据
      const requestData = {
        youtube_url: currentTab.url,
        custom_prompt: customPromptInput.value,
        special_terms: specialTermsInput.value,
        content_name: document.getElementById('video-title').textContent,
        language: targetLangSelect.value
      };
      
      console.log('发送请求到服务端:', requestData);
      
      // 创建翻译任务
      const response = await fetch(`${API_SERVER}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      console.log('服务端响应状态:', response.status);
      
      const data = await response.json();
      console.log('服务端响应数据:', data);
      
      if (!response.ok) {
        throw new Error(data.detail || '创建任务失败');
      }
      
      // 保存任务ID
      currentTaskId = data.task_id;
      
      // 保存当前任务状态到本地存储
      await saveTaskStatus(videoId, {
        taskId: currentTaskId,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString()
      });
      
      // 更新状态文本
      updateProgress(0, '任务已创建，正在处理...');
      
      // 通知后台脚本开始轮询任务状态
      chrome.runtime.sendMessage({
        action: 'startTaskPolling',
        taskId: currentTaskId,
        videoId: videoId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('通知后台脚本失败:', chrome.runtime.lastError);
        } else {
          console.log('后台任务轮询已启动:', response);
        }
      });
      
      // 设置监听来自后台的消息
      setupBackgroundMessageListener();
      
    } catch (error) {
      console.error('提交翻译任务失败:', error);
      alert(`提交翻译任务失败: ${error.message}`);
      
      // 恢复按钮状态
      translateBtn.disabled = false;
      translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>翻译字幕';
    }
  }
  
  /**
   * 设置监听来自后台的消息
   */
  function setupBackgroundMessageListener() {
    // 只设置一次监听器
    if (!window.hasBackgroundListener) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'taskStatusUpdate' && message.taskId === currentTaskId) {
          console.log('收到后台任务状态更新:', message);
          
          // 检查是否有错误信息
          if (message.isError && message.errorMessage) {
            // 显示错误状态
            updateProgress(message.progress || 0, message.errorMessage);
          } else {
            // 正常更新任务状态
            updateProgress(
              message.progress || 0,
              getStatusText(message.status || 'unknown')
            );
            
            // 如果任务完成或失败，更新UI
            if (message.status === 'completed') {
              // 修改按钮为"应用字幕"
              translateBtn.disabled = false;
              translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-closed-captioning"></i></span>应用字幕';
              // 修改按钮点击事件为应用字幕
              translateBtn.removeEventListener('click', submitTranslationTask);
              translateBtn.addEventListener('click', applyExistingSubtitles);
            } else if (message.status === 'failed') {
              // 显示错误消息
              updateProgress(0, message.errorMessage || '翻译失败');
              // 失败的任务显示错误状态
              translateBtn.disabled = false;
              translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>翻译字幕';
            }
          }
        }
        
        // 返回true保持通信通道开放
        return true;
      });
      
      window.hasBackgroundListener = true;
    }
  }
  
  /**
   * 加载任务状态并更新UI
   */
  async function loadTaskStatus() {
    if (!currentVideoId) {
      console.log('无法获取状态');
      return;
    }
    
    try {
      const key = `task_status_${currentVideoId}`;
      const data = await chrome.storage.local.get([key]);
      const taskStatus = data[key];
      console.log('从存储加载任务状态:', taskStatus);
      
      if (taskStatus) {
        // 有任务记录，恢复状态
        currentTaskId = taskStatus.taskId;
        progressSection.style.display = 'block';
        
        if (taskStatus.status === 'completed') {
          // 已完成的任务显示100%进度
          updateProgress(1, '翻译完成！');
          // 修改按钮为"应用字幕"
          translateBtn.disabled = false;
          translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-closed-captioning"></i></span>应用字幕';
          // 修改按钮点击事件为应用字幕
          translateBtn.removeEventListener('click', submitTranslationTask);
          translateBtn.addEventListener('click', applyExistingSubtitles);
          
        } else if (taskStatus.status === 'failed') {
          // 失败的任务显示错误状态
          updateProgress(0, taskStatus.errorMessage || '翻译失败');
          // 按钮可点击，允许重试
          translateBtn.disabled = false;
          translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>翻译字幕';
        } else {
          // 进行中的任务，询问后台当前状态
          updateProgress(taskStatus.progress || 0, getStatusText(taskStatus.status));
          // 禁用按钮
          translateBtn.disabled = true;
          translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-spinner fa-spin"></i></span>翻译中...';
          
          // 查询后台当前的任务状态
          chrome.runtime.sendMessage({
            action: 'getTaskStatus',
            taskId: currentTaskId
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('查询后台任务状态失败:', chrome.runtime.lastError);
            } else if (response && response.success && response.status) {
              console.log('从后台获取到任务状态:', response.status);
              
              // 根据最新状态更新UI
              updateProgress(
                response.status.progress || 0,
                getStatusText(response.status.status || 'unknown')
              );
            } else {
              // 恢复后台轮询
              chrome.runtime.sendMessage({
                action: 'startTaskPolling',
                taskId: currentTaskId,
                videoId: currentVideoId
              });
            }
          });
          
          // 设置监听来自后台的消息
          setupBackgroundMessageListener();
        }
      }
    } catch (error) {
      console.error('加载任务状态失败:', error);
    }
  }
  
  /**
   * 保存任务状态
   */
  async function saveTaskStatus(videoId, status) {
    if (!videoId) return;
    
    try {
      const key = `task_status_${videoId}`;
      await chrome.storage.local.set({ [key]: status });
      console.log(`已保存任务状态: ${key}`, status);
    } catch (error) {
      console.error('保存任务状态失败:', error);
    }
  }
  
  /**
   * 更新进度显示
   */
  function updateProgress(progress, statusText) {
    const percentage = Math.round(progress * 100);
    progressFill.style.width = `${percentage}%`;
    progressPercentage.textContent = `${percentage}%`;
    progressStatus.textContent = statusText;
    
    // 更新UI高度
    updateUI();
  }
  
  /**
   * 获取状态文本
   */
  function getStatusText(status) {
    switch (status) {
      case 'pending':
        return '等待处理...';
      case 'processing':
        return '正在处理...';
      case 'completed':
        return '翻译完成！';
      case 'failed':
        return '翻译失败';
      default:
        return '状态异常，请刷新页面';
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
   * 应用已存在的字幕
   */
  async function applyExistingSubtitles() {
    try {
      // 显示加载状态
      translateBtn.disabled = true;
      translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-spinner fa-spin"></i></span>应用中...';
      
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // 通知内容脚本应用字幕
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: 'applySubtitles' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('应用字幕失败:', chrome.runtime.lastError);
            alert('应用字幕失败，请刷新页面重试');
            
            // 恢复按钮状态
            translateBtn.disabled = false;
            translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-closed-captioning"></i></span>应用字幕';
            return;
          }
          
          if (response && response.success) {
            // 关闭弹出窗口
            window.close();
          } else {
            alert('应用字幕失败: ' + (response ? response.message : '未知错误'));
            
            // 恢复按钮状态
            translateBtn.disabled = false;
            translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-closed-captioning"></i></span>应用字幕';
          }
        }
      );
    } catch (error) {
      console.error('应用字幕失败:', error);
      alert(`应用字幕失败: ${error.message}`);
      
      // 恢复按钮状态
      translateBtn.disabled = false;
      translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-closed-captioning"></i></span>应用字幕';
    }
  }

  // 初始调整高度
  adjustPopupHeight();
  
  // 监听窗口大小变化
  window.addEventListener('resize', adjustPopupHeight);
  
  // 观察DOM变化来调整高度
  const observer = new MutationObserver(updateUI);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
  
  /**
   * 检查用户登录状态
   */
  async function checkLoginStatus() {
    try {
      // 从存储中获取用户信息
      const data = await chrome.storage.local.get(['user_info']);
      userInfo = data.user_info;
      
      if (userInfo) {
        // 已登录，显示用户信息
        updateLoginStatus(true);
      } else {
        // 未登录
        updateLoginStatus(false);
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      // 默认显示未登录状态
      updateLoginStatus(false);
    }
  }
  
  /**
   * 更新登录状态UI
   * @param {boolean} isLoggedIn - 是否已登录
   */
  function updateLoginStatus(isLoggedIn) {
    if (isLoggedIn && userInfo) {
      // 已登录状态
      loginText.innerHTML = `${userInfo.username} <small>(今日额度: ${userInfo.daily_quota})</small>`;
      loginLink.href = 'https://tube-trans.com/account'; // 账户管理页面URL（待更新）
    } else {
      // 未登录状态
      loginText.textContent = '未登录';
      loginLink.href = 'https://youtube.com'; // 临时使用youtube地址
    }
    // 调整UI高度
    updateUI();
  }
  
  /**
   * 设置登录相关事件监听
   */
  function setupLoginEvents() {
    // 登录链接点击
    loginLink.addEventListener('click', function(e) {
      e.preventDefault(); // 阻止默认行为
      
      if (userInfo) {
        // 已登录状态，点击显示或隐藏下拉菜单
        userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
      } else {
        // 未登录状态，打开新标签页到登录页面
        chrome.tabs.create({ url: 'https://youtube.com' }); // 临时使用youtube作为登录页
        window.close(); // 关闭弹出窗口
      }
    });
    
    // 登出按钮点击
    logoutBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      await logout();
    });
    
    // 点击其他区域关闭下拉菜单
    document.addEventListener('click', function(e) {
      if (userDropdown.style.display === 'block' && !loginLink.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.style.display = 'none';
      }
    });
  }
  
  /**
   * 用户登出
   */
  async function logout() {
    try {
      // 清除用户信息
      await chrome.storage.local.remove(['user_info']);
      userInfo = null;
      
      // 更新UI为未登录状态
      updateLoginStatus(false);
      
      // 隐藏下拉菜单
      userDropdown.style.display = 'none';
    } catch (error) {
      console.error('登出失败:', error);
    }
  }
  
  /**
   * 临时测试函数：模拟用户登录状态
   * 仅用于开发测试，实际使用时应删除
   */
  async function testSetLoginStatus() {
    // 模拟用户数据
    const testUserInfo = {
      username: '测试用户',
      daily_quota: 500,
      // 其他用户信息...
    };
    
    // 保存到存储
    await chrome.storage.local.set({ 'user_info': testUserInfo });
    
    // 更新当前变量和UI
    userInfo = testUserInfo;
    updateLoginStatus(true);
    
    console.log('已设置测试登录状态');
  }
  
  // 双击logo区域触发测试登录（仅用于开发测试）
  document.querySelector('.logo').addEventListener('dblclick', testSetLoginStatus);
});