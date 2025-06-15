/**
 * Tube Trans - AI精翻字幕
 * 弹出窗口脚本
 */

// API服务器地址
const API_SERVER = 'https://api.rxaigc.com';

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
  
  // 翻译策略相关元素
  const strategiesSection = document.getElementById('translation-strategies');
  const strategiesStatus = document.getElementById('strategies-status');
  const strategiesList = document.getElementById('strategies-list');
  
  // 测试按钮
  const testStrategiesBtn = document.getElementById('test-strategies-btn');
  
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
  // translateBtn.addEventListener('click', submitTranslationTask);
  
  // 设置翻译按钮的点击事件
  translateBtn.addEventListener('click', function(event) {
    // 按住Ctrl或Command键点击时运行测试功能
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      testTranslationStrategies();
    } else {
      // 正常点击时执行原来的任务提交
      submitTranslationTask();
    }
  });
  
  // 加载任务状态
  await loadTaskStatus();
  
  // 检查登录状态
  await checkLoginStatus();
  
  // 设置登录相关事件监听
  setupLoginEvents();
  
  // 设置测试按钮点击事件
  if (testStrategiesBtn) {
    testStrategiesBtn.addEventListener('click', testTranslationStrategies);
  }
  
  // 开关按钮监听
  // togglePrompt.addEventListener('change', function() {
  //   promptContainer.style.display = this.checked ? 'block' : 'none';
  //   updateUI(); // 调整高度
  // });
  
  // toggleTerms.addEventListener('change', function() {
  //   termsContainer.style.display = this.checked ? 'block' : 'none';
  //   updateUI(); // 调整高度
  // });
  
  /**
   * 获取当前标签页的YouTube视频信息（通过Content Script）
   */
  async function getCurrentVideoInfo() {
    try {
      console.log('[Popup] 开始获取视频信息...');
      
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // 检查是否在YouTube视频页面
      if (!currentTab.url.includes('youtube.com/watch')) {
        console.log('[Popup] 不是YouTube视频页面');
        showNoVideoMessage();
        return;
      }
      
      // 从URL提取视频ID作为备用
      try {
        const urlParams = new URLSearchParams(new URL(currentTab.url).search);
        const videoId = urlParams.get('v');
        if (videoId) {
          currentVideoId = videoId;
          console.log('[Popup] 从URL获取视频ID:', videoId);
        }
      } catch (e) {
        console.error('[Popup] 解析URL失败:', e);
      }
      
      // 通过Content Script获取完整视频信息
      console.log('[Popup] 向Content Script请求视频信息...');
      
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(
          currentTab.id, 
          { action: 'getVideoInfo' }, 
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[Popup] Content Script通信失败:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response);
            }
          }
        );
      });
      
      console.log('[Popup] 收到Content Script响应:', response);
      
      if (response && response.success && response.videoInfo) {
        // 成功获取视频信息
        updateVideoInfo(response.videoInfo);
        
        // 确保设置了视频ID
        if (response.videoInfo.videoId) {
          currentVideoId = response.videoInfo.videoId;
        }
        
        console.log('[Popup] 视频信息更新完成');
      } else {
        // 获取失败，显示错误信息
        console.error('[Popup] 获取视频信息失败:', response ? response.error : '未知错误');
        showNoVideoMessage();
      }
      
    } catch (error) {
      console.error('[Popup] 获取视频信息异常:', error);
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
    // if (videoInfo.duration) {
    //   estimatedTimeEl.textContent = calculateEstimatedTime(videoInfo.duration);
    // }
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
   * 提交翻译任务（通过Background Script）
   */
  async function submitTranslationTask() {
    try {
      // 先检查登录状态
      await checkLoginStatus();
      if (!userInfo) {
        // 用户未登录，提示登录
        const shouldLogin = confirm('需要先登录才能使用翻译功能。是否前往登录页面？');
        if (shouldLogin) {
          chrome.tabs.create({ url: 'https://auth.rxaigc.com' });
          window.close();
        }
        return;
      }

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
      
      // 更新UI状态
      translateBtn.disabled = true;
      translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-spinner fa-spin"></i></span>创建任务中...';
      
      // 显示进度区域
      progressSection.style.display = 'block';
      updateProgress(0, '准备中...');
      
      // 构建任务数据
      const taskData = {
        videoId: videoId,
        youtube_url: currentTab.url,
        content_name: document.getElementById('video-title').textContent || '',
        channel_name: document.getElementById('channel-name').textContent || '',
        // 可扩展其他参数
        // custom_prompt: customPromptInput.value,
        // special_terms: specialTermsInput.value,
        // language: targetLangSelect.value
      };
      
      console.log('向Background发送创建任务请求:', taskData);
      
      // 通过Background Script创建任务
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'createTranslationTask',
          taskData: taskData
        }, resolve);
      });
      
      console.log('收到Background响应:', response);
      
      if (response && response.success) {
        // 任务创建成功
        currentTaskId = response.taskId;
        
        // 更新状态文本
        updateProgress(0, '任务已创建，正在处理...');
        
        // 设置监听来自后台的消息
        setupBackgroundMessageListener();
        
        console.log('翻译任务创建成功，任务ID:', currentTaskId);
        
      } else {
        // 任务创建失败
        const errorMessage = response ? response.message : '创建任务失败';
        
        // 处理需要重新登录的情况
        if (response && response.needRelogin) {
          // 清除本地用户信息，更新UI
          userInfo = null;
          updateLoginStatus(false);
          
          // 提示用户登录
          const shouldLogin = confirm('登录状态已过期，需要重新登录。是否前往登录页面？');
          if (shouldLogin) {
            chrome.tabs.create({ url: 'https://auth.rxaigc.com' });
            window.close();
          }
        } else {
          // 其他错误，显示错误信息
          alert(`创建翻译任务失败: ${errorMessage}`);
        }
        
        // 恢复按钮状态
        translateBtn.disabled = false;
        translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>开始翻译';
      }
      
    } catch (error) {
      console.error('提交翻译任务异常:', error);
      alert(`提交翻译任务失败: ${error.message}`);
      
      // 恢复按钮状态
      translateBtn.disabled = false;
      translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>开始翻译';
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
            
            // 处理翻译策略数据
            if (message.translationStrategies) {
              displayTranslationStrategies(message.translationStrategies);
            } else {
              // **新增**：本地没有拿到，就让 background 去拉一次
              console.log('本地没策略，主动请求后台获取一次');
              chrome.runtime.sendMessage({
                action: 'fetchTranslationStrategies',
                taskId: currentTaskId,
                videoId: currentVideoId
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('请求后台获取翻译策略失败', chrome.runtime.lastError);
                } else if (response && response.success && response.strategies) {
                  // 拿到策略，存在本地再显示一次
                  displayTranslationStrategies(response.strategies);
                } else {
                  console.warn('后台未返回策略');
                }
              });
            }
          

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
              translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>开始翻译';
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

      // 加载并恢复翻译策略
      const strategyFlagKey = `has_translation_strategies_${currentVideoId}`;
      const strategyDataKey = `translation_strategies_${currentVideoId}`;
      const strategyData = await chrome.storage.local.get([strategyFlagKey, strategyDataKey]);
      console.log('从存储加载翻译策略:', strategyData);
      
      if (taskStatus) {
        // 有任务记录，恢复状态
        currentTaskId = taskStatus.taskId;
        progressSection.style.display = 'block';
        
        // 如果有翻译策略数据，恢复显示
        // if (taskStatus.translationStrategies) {
        //   displayTranslationStrategies(taskStatus.translationStrategies);
        // }
        // if (strategyData[strategyFlagKey]) {
        //   displayTranslationStrategies(strategyData[strategyDataKey]);
        // }

        if (strategyData[strategyFlagKey]) {
          // 正常恢复
          displayTranslationStrategies(strategyData[strategyDataKey]);
      
        } else {
          // **新增**：本地没有拿到，就让 background 去拉一次
          console.log('本地没策略，主动请求后台获取一次');
          chrome.runtime.sendMessage({
            action: 'fetchTranslationStrategies',
            taskId: currentTaskId,
            videoId: currentVideoId
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('请求后台获取翻译策略失败', chrome.runtime.lastError);
            } else if (response && response.success && response.strategies) {
              // 拿到策略，存在本地再显示一次
              displayTranslationStrategies(response.strategies);
            } else {
              console.warn('后台未返回策略');
            }
          });
        }
      
        
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
          translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>开始翻译';
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
   * 保存任务状态（通过Background Script）
   * @param {string} videoId - 视频ID  
   * @param {object} status - 任务状态
   */
  async function saveTaskStatus(videoId, status) {
    // 这个函数现在主要由background处理，popup端保留用于向后兼容
    console.log('popup.js中的saveTaskStatus已废弃，请使用background处理存储操作');
  }
  
  /**
   * 更新翻译策略数据（通过Background Script）
   * @param {string} videoId - 视频ID
   * @param {Object} strategies - 翻译策略数据
   */
  async function updateTranslationStrategies(videoId, strategies_data) {
    // 这个函数现在主要由background处理，popup端保留用于向后兼容
    console.log('popup.js中的updateTranslationStrategies已废弃，请使用background处理存储操作');
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
   * 显示翻译策略
   * @param {Object} data - 包含翻译策略的数据对象
   */
  function displayTranslationStrategies(data) {
    // 记录传入的翻译策略数据
    console.log('传入的翻译策略数据:', data);

    // 直接获取translation_strategies数组
    const strategies = data.strategies || [];
    console.log('获取到的翻译策略数据:', strategies);

    // 如果没有策略数据，不显示翻译策略区域
    if (!strategies || strategies.length === 0) {
      console.log('翻译策略数据格式有问题或为空，不显示策略区域');
      return;
    }
    
    // 通过验证后，显示策略区域
    strategiesSection.style.display = 'block';
    
    // 隐藏加载状态，显示策略列表
    strategiesStatus.style.display = 'none';
    strategiesList.style.display = 'block';
    
    // 清空现有策略列表
    strategiesList.innerHTML = '';
    
    console.log('开始写入翻译策略数据');
    // 添加策略条目
    strategies.forEach(strategy => {
      const li = document.createElement('li');
      li.textContent = strategy;
      strategiesList.appendChild(li);
    });
    console.log('写入翻译策略数据完成');
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
        return '思考翻译策略...';
      case 'strategies_ready':
        return '正在翻译...';
      case 'completed':
        return '翻译完成！';
      case 'failed':
        return '翻译失败';
      default:
        return '状态异常，请刷新页面';
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
   * 检查用户登录状态（通过background script）
   */
  async function checkLoginStatus() {
    try {
      console.log('向background请求检查登录状态...');
      
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkLoginStatus' }, resolve);
      });
      
      if (response && !chrome.runtime.lastError) {
        console.log('收到登录状态响应:', response);
        
        if (response.isLoggedIn && response.userInfo) {
          userInfo = response.userInfo;
          updateLoginStatus(true);
        } else {
          userInfo = null;
          updateLoginStatus(false);
        }
      } else {
        console.error('检查登录状态失败:', chrome.runtime.lastError);
        userInfo = null;
        updateLoginStatus(false);
      }
    } catch (error) {
      console.error('检查登录状态异常:', error);
      userInfo = null;
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
      loginLink.href = 'https://auth.rxaigc.com'; // 账户管理页面
    } else {
      // 未登录状态
      loginText.textContent = '未登录';
      loginLink.href = 'https://auth.rxaigc.com'; // 登录页面
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
        chrome.tabs.create({ url: 'https://auth.rxaigc.com' });
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
   * 用户登出（通过background script）
   */
  async function logout() {
    try {
      console.log('向background请求登出...');
      
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'logout' }, resolve);
      });
      
      if (response && response.success) {
        console.log('登出成功');
        userInfo = null;
        updateLoginStatus(false);
        
        // 隐藏下拉菜单
        if (userDropdown) {
          userDropdown.style.display = 'none';
        }
      } else {
        console.error('登出失败:', response ? response.message : '未知错误');
      }
    } catch (error) {
      console.error('登出异常:', error);
    }
  }
  
  /**
   * 设置测试登录状态（通过background script）
   */
  async function testSetLoginStatus() {
    try {
      console.log('向background请求设置测试登录状态...');
      
      const testUserInfo = {
        username: '测试用户',
        daily_quota: 500,
        user_id: 'test_user_123'
      };
      
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'setTestLoginStatus',
          testUserInfo: testUserInfo
        }, resolve);
      });
      
      if (response && response.isLoggedIn) {
        console.log('设置测试登录状态成功:', response);
        userInfo = response.userInfo;
        updateLoginStatus(true);
      } else {
        console.error('设置测试登录状态失败:', response ? response.error : '未知错误');
      }
    } catch (error) {
      console.error('设置测试登录状态异常:', error);
    }
  }
  
  // 双击logo区域触发测试登录（仅用于开发测试）
  document.querySelector('.logo').addEventListener('dblclick', testSetLoginStatus);
  
  /**
   * 测试翻译策略显示
   * 仅用于开发测试
   */
  async function testTranslationStrategies() {
    console.log('启动翻译策略测试...');
    
    if (!currentVideoId) {
      alert('无法获取当前视频ID');
      return;
    }
    
    try {
      // 从本地存储获取翻译策略数据
      const strategyFlagKey = `has_translation_strategies_${currentVideoId}`;
      const strategyDataKey = `translation_strategies_${currentVideoId}`;
      
      const strategyData = await chrome.storage.local.get([strategyFlagKey, strategyDataKey]);
      console.log('从存储加载翻译策略数据:', strategyData);
      
      if (strategyData[strategyFlagKey] && strategyData[strategyDataKey]) {
        // 有存储的策略数据，直接显示
        console.log('找到存储的翻译策略，开始显示...');
        displayTranslationStrategies(strategyData[strategyDataKey]);
      } else {
        // 没有存储的策略数据，尝试从接口获取
        console.log('未找到存储的翻译策略，尝试从接口获取...');
        
        // 检查是否有当前任务ID
        if (!currentTaskId) {
          // 尝试从存储中获取任务ID
          const taskStatusKey = `task_status_${currentVideoId}`;
          const taskData = await chrome.storage.local.get([taskStatusKey]);
          if (taskData[taskStatusKey] && taskData[taskStatusKey].taskId) {
            currentTaskId = taskData[taskStatusKey].taskId;
            console.log('从存储中找到任务ID:', currentTaskId);
          }
        }
        
        if (currentTaskId) {
          try {
            console.log('调用接口获取翻译策略...');
            const response = await fetch(`${API_SERVER}/api/tasks/${currentTaskId}/strategies`, {
              credentials: 'include'
            });
            
            if (response.ok) {
              const strategiesData = await response.json();
              console.log('接口返回翻译策略数据:', strategiesData);
              
              // 保存到本地存储
              await updateTranslationStrategies(currentVideoId, strategiesData);
              
              // 显示翻译策略
              displayTranslationStrategies(strategiesData);
              return;
            } else {
              console.error('接口调用失败:', response.status);
            }
          } catch (apiError) {
            console.error('调用接口获取翻译策略失败:', apiError);
          }
        }
        
        // 如果接口调用失败或没有任务ID，使用测试数据
        console.log('使用测试数据作为回退...');
        const testData = {
          strategies: [
            "准确翻译和解释关键技术名词，特别是'Transformer'应直接采用音译'变换器'，并首次出现时给出简要定义。",
            "保持教学和学术风格，注意逻辑性和条理性，把课程讲解的结构清晰地传达出来。",
            "遇到Stanford的专有课程内容或案例，结合上下文查找权威译法或作简要背景说明。",
            "special_terms_strategies: 例如'Transformer'译为'变换器模型'，'self-attention'译为'自注意力机制'，'encoder-decoder'译为'编码器-解码器'结构；课程编号和章节请保留原文，如'CS25'。"
          ]
        };
        
        // 调用显示翻译策略函数
        displayTranslationStrategies(testData);
      }
      
    } catch (error) {
      console.error('获取翻译策略数据失败:', error);
      alert('获取翻译策略数据失败: ' + error.message);
    }
  }
});