/**
 * Tube Trans - AI精翻字幕
 * 弹出窗口脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  const { ACTIONS } = VibeSubMessages;

  // 获取DOM元素
  const videoTitleEl = document.getElementById('video-title');
  const channelNameEl = document.getElementById('channel-name');
  const translateBtn = document.getElementById('translate-btn');
  const progressSection = document.getElementById('translation-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressStatus = document.getElementById('progress-status');
  
  // 翻译策略相关元素
  const strategiesSection = document.getElementById('translation-strategies');
  const strategiesStatus = document.getElementById('strategies-status');
  const strategiesList = document.getElementById('strategies-list');
  
  // 登录相关元素
  const loginLink = document.getElementById('login-link');
  const loginText = document.getElementById('login-text');
  const userDropdown = document.getElementById('user-dropdown');
  const logoutBtn = document.getElementById('logout-btn');
  
  // 当前任务和视频信息
  let currentTaskId = null;
  let currentVideoId = null;
  
  // 用户信息
  let userInfo = null;
  
  // 当前进度值（用于在新进度值为空时保持之前的值）
  let currentProgress = 0;
  let translateButtonMode = 'translate';

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
    
    TubeTransDebug.log(`调整弹出窗口高度: ${finalHeight}px (内容高度: ${contentHeight}px)`);
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
        TubeTransDebug.error('解析URL失败:', e);
      }
    }
  });
  
  // 获取当前标签页的YouTube视频信息
  await getCurrentVideoInfo();

  // 设置翻译按钮的点击事件
  translateBtn.addEventListener('click', handleTranslateButtonClick);
  
  // 加载任务状态
  await loadTaskStatus();
  
  // 检查登录状态
  await checkLoginStatus();
  
  // 设置登录相关事件监听
  setupLoginEvents();
  
  function handleTranslateButtonClick() {
    if (translateButtonMode === 'apply') {
      applyExistingSubtitles();
      return;
    }
    submitTranslationTask();
  }

  function setTranslateButtonState(mode, label, iconClass, disabled = false) {
    translateButtonMode = mode;
    translateBtn.disabled = disabled;
    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'submit-icon icon';
    const icon = document.createElement('i');
    icon.className = iconClass;
    iconWrapper.appendChild(icon);
    translateBtn.replaceChildren(iconWrapper, document.createTextNode(label));
  }
  
  /**
   * 获取当前标签页的YouTube视频信息（通过Content Script）
   */
  async function getCurrentVideoInfo() {
    try {
      TubeTransDebug.log('[Popup] 开始获取视频信息...');
      
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // 检查是否在YouTube视频页面
      if (!currentTab.url.includes('youtube.com/watch')) {
        TubeTransDebug.log('[Popup] 不是YouTube视频页面');
        showNoVideoMessage();
        return;
      }
      
      // 从URL提取视频ID作为备用
      try {
        const urlParams = new URLSearchParams(new URL(currentTab.url).search);
        const videoId = urlParams.get('v');
        if (videoId) {
          currentVideoId = videoId;
          TubeTransDebug.log('[Popup] 从URL获取视频ID:', videoId);
        }
      } catch (e) {
        TubeTransDebug.error('[Popup] 解析URL失败:', e);
      }
      
      // 通过Content Script获取完整视频信息
      TubeTransDebug.log('[Popup] 向Content Script请求视频信息...');

      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: ACTIONS.GET_VIDEO_INFO },
          (response) => {
            if (chrome.runtime.lastError) {
              TubeTransDebug.error('[Popup] Content Script通信失败:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response);
            }
          }
        );
      });
      
      TubeTransDebug.log('[Popup] 收到Content Script响应:', response);
      
      if (response && response.success && response.videoInfo) {
        // 成功获取视频信息
        updateVideoInfo(response.videoInfo);
        
        // 确保设置了视频ID
        if (response.videoInfo.videoId) {
          currentVideoId = response.videoInfo.videoId;
        }
        
        TubeTransDebug.log('[Popup] 视频信息更新完成');
      } else {
        // 获取失败，显示错误信息
        TubeTransDebug.error('[Popup] 获取视频信息失败:', response ? response.error : '未知错误');
        showNoVideoMessage();
      }
      
    } catch (error) {
      TubeTransDebug.error('[Popup] 获取视频信息异常:', error);
      showNoVideoMessage();
    }
  }
  
  /**
   * 更新视频信息显示
   */
  function updateVideoInfo(videoInfo) {
    TubeTransDebug.log('收到视频信息:', videoInfo);
    
    // 更新标题
    if (videoInfo.title) {
      videoTitleEl.textContent = videoInfo.title;
    }
    
    // 更新频道名称
    if (videoInfo.channelName) {
      TubeTransDebug.log('设置频道名称:', videoInfo.channelName);
      channelNameEl.textContent = videoInfo.channelName;
    } else {
      TubeTransDebug.log('没有收到频道名称或为空');
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
    const container = document.createElement('div');
    container.className = 'no-video';

    const firstLine = document.createElement('p');
    const icon = document.createElement('i');
    icon.className = 'fas fa-exclamation-circle';
    firstLine.appendChild(icon);
    firstLine.appendChild(document.createTextNode(' 请在YouTube视频页面打开此扩展'));

    const secondLine = document.createElement('p');
    secondLine.textContent = '只有在观看视频时才能使用翻译功能';

    container.append(firstLine, secondLine);
    contentEl.replaceChildren(container);
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
          chrome.tabs.create({ url: VibeSubConfig.AUTH_URL });
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
      setTranslateButtonState('translate', '创建任务中...', 'fas fa-spinner fa-spin', true);
      
      // 显示进度区域
      progressSection.style.display = 'block';
      updateProgress(0, '准备中...', { reset: true });
      
      // 构建任务数据
      const taskData = {
        videoId: videoId,
        youtube_url: currentTab.url,
        content_name: document.getElementById('video-title').textContent || '',
        channel_name: document.getElementById('channel-name').textContent || ''
      };
      
      TubeTransDebug.log('向Background发送创建任务请求:', taskData);
      
      // 通过Background Script创建任务
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: ACTIONS.CREATE_TRANSLATION_TASK,
          taskData: taskData
        }, resolve);
      });
      
      TubeTransDebug.log('收到Background响应:', response);
      
      if (response && response.success) {
        // 任务创建成功
        currentTaskId = response.taskId;
        
        // 更新状态文本
        updateProgress(0, VibeSubStatus.getStatusText(response.status || 'pending'));
        
        // 设置监听来自后台的消息
        setupBackgroundMessageListener();
        
        TubeTransDebug.log('翻译任务创建成功，任务ID:', currentTaskId);
        
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
            chrome.tabs.create({ url: VibeSubConfig.AUTH_URL });
            window.close();
          }
        } else {
          // 其他错误，显示错误信息
          alert(`创建翻译任务失败: ${errorMessage}`);
        }
        
        // 恢复按钮状态
        setTranslateButtonState('translate', '开始翻译', 'fas fa-language');
      }
      
    } catch (error) {
      TubeTransDebug.error('提交翻译任务异常:', error);
      alert(`提交翻译任务失败: ${error.message}`);
      
      // 恢复按钮状态
      setTranslateButtonState('translate', '开始翻译', 'fas fa-language');
    }
  }
  
  /**
   * 设置监听来自后台的消息
   */
  function setupBackgroundMessageListener() {
    // 只设置一次监听器
    if (!window.hasBackgroundListener) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === ACTIONS.TASK_STATUS_UPDATE && message.taskId === currentTaskId) {
          TubeTransDebug.log('收到后台任务状态更新:', message);
          
          // 检查是否有错误信息
          if (message.isError && message.errorMessage) {
            // 显示错误状态
            // 如果 message.progress 没有值，使用之前的进度值，如果之前也没有则为0
            const progressValue = message.progress !== undefined && message.progress !== null 
              ? message.progress 
              : currentProgress;
            
            updateProgress(progressValue, message.errorMessage);
          } else {
            // 正常更新任务状态
            // 如果 message.progress 没有值，使用之前的进度值，如果之前也没有则为0
            const progressValue = message.progress !== undefined && message.progress !== null 
              ? message.progress 
              : currentProgress;
            
            updateProgress(
              progressValue,
              getStatusText(message.status || 'unknown')
            );
            
            // 处理翻译策略数据
            if (message.translationStrategies) {
              displayTranslationStrategies(message.translationStrategies);
            } 
          
            // 如果任务完成或失败，更新UI
            if (message.status === 'completed') {
              if (message.subtitleReady === false) {
                updateProgress(1, '字幕文件准备中...');
                setTranslateButtonState('apply', '准备字幕中...', 'fas fa-spinner fa-spin', true);
              } else {
                // 修改按钮为"应用字幕"
                setTranslateButtonState('apply', '应用字幕', 'fas fa-closed-captioning');
              }
            } else if (message.status === 'failed') {
              // 显示错误消息
              updateProgress(currentProgress, message.errorMessage || '翻译失败');
              // 失败的任务显示错误状态
              setTranslateButtonState('translate', '开始翻译', 'fas fa-language');
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
      TubeTransDebug.log('无法获取状态');
      return;
    }
    
    try {
      const key = VibeSubStorage.keys.taskStatus(currentVideoId);
      const data = await chrome.storage.local.get([key]);
      const taskStatus = data[key];
      TubeTransDebug.log('从存储加载任务状态:', taskStatus);

      // 加载并恢复翻译策略
      const strategyFlagKey = VibeSubStorage.keys.hasTranslationStrategies(currentVideoId);
      const strategyDataKey = VibeSubStorage.keys.translationStrategies(currentVideoId);
      const strategyData = await chrome.storage.local.get([strategyFlagKey, strategyDataKey]);
      TubeTransDebug.log('从存储加载翻译策略:', strategyData);
      
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
          TubeTransDebug.log('本地没策略，主动请求后台获取一次');
          chrome.runtime.sendMessage({
            action: ACTIONS.FETCH_TRANSLATION_STRATEGIES,
            taskId: currentTaskId,
            videoId: currentVideoId
          }, (response) => {
            if (chrome.runtime.lastError) {
              TubeTransDebug.error('请求后台获取翻译策略失败', chrome.runtime.lastError);
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
          updateProgress(1, VibeSubStatus.getStatusText('completed'));
          setTranslateButtonState('apply', '应用字幕', 'fas fa-closed-captioning');
          
        } else if (taskStatus.status === 'failed') {
          // 失败的任务显示错误状态
          updateProgress(taskStatus.progress || currentProgress, taskStatus.errorMessage || '翻译失败');
          // 按钮可点击，允许重试
          setTranslateButtonState('translate', '开始翻译', 'fas fa-language');
        } else {
          // 进行中的任务，询问后台当前状态
          updateProgress(taskStatus.progress || 0, getStatusText(taskStatus.status));
          setTranslateButtonState('translate', '翻译中...', 'fas fa-spinner fa-spin', true);
          
          // 查询后台当前的任务状态
          chrome.runtime.sendMessage({
            action: ACTIONS.GET_TASK_STATUS,
            taskId: currentTaskId
          }, (response) => {
            if (chrome.runtime.lastError) {
              TubeTransDebug.error('查询后台任务状态失败:', chrome.runtime.lastError);
            } else if (response && response.success && response.status) {
              TubeTransDebug.log('从后台获取到任务状态:', response.status);
              
              // 根据最新状态更新UI
              updateProgress(
                response.status.progress || 0,
                getStatusText(response.status.status || 'unknown')
              );
            } else {
              // 恢复后台轮询
              chrome.runtime.sendMessage({
                action: ACTIONS.START_TASK_POLLING,
                taskId: currentTaskId,
                videoId: currentVideoId,
                initialTaskState: taskStatus
              });
            }
          });
          
          // 设置监听来自后台的消息
          setupBackgroundMessageListener();
        }
      }
    } catch (error) {
      TubeTransDebug.error('加载任务状态失败:', error);
    }
  }
  
  /**
   * 保存任务状态（通过Background Script）
   * @param {string} videoId - 视频ID  
   * @param {object} status - 任务状态
   */
  async function saveTaskStatus(videoId, status) {
    // 这个函数现在主要由background处理，popup端保留用于向后兼容
    TubeTransDebug.log('popup.js中的saveTaskStatus已废弃，请使用background处理存储操作');
  }
  
  /**
   * 更新翻译策略数据（通过Background Script）
   * @param {string} videoId - 视频ID
   * @param {Object} strategies - 翻译策略数据
   */
  async function updateTranslationStrategies(videoId, strategies_data) {
    // 这个函数现在主要由background处理，popup端保留用于向后兼容
    TubeTransDebug.log('popup.js中的updateTranslationStrategies已废弃，请使用background处理存储操作');
  }
  
  /**
   * 更新进度显示
   */
  function updateProgress(progress, statusText, options = {}) {
    // 更新当前进度值
    currentProgress = options.reset
      ? VibeSubStatus.normalizeProgress(progress, 0)
      : VibeSubStatus.nextProgress(currentProgress, progress);
    
    const percentage = Math.round(currentProgress * 100);
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
    TubeTransDebug.log('传入的翻译策略数据:', data);

    // 直接获取translation_strategies数组
    const strategies = data.strategies || [];
    TubeTransDebug.log('获取到的翻译策略数据:', strategies);

    // 如果没有策略数据，不显示翻译策略区域
    if (!strategies || strategies.length === 0) {
      TubeTransDebug.log('翻译策略数据格式有问题或为空，不显示策略区域');
      return;
    }
    
    // 通过验证后，显示策略区域
    strategiesSection.style.display = 'block';
    
    // 隐藏加载状态，显示策略列表
    strategiesStatus.style.display = 'none';
    strategiesList.style.display = 'block';
    
    // 清空现有策略列表
    strategiesList.replaceChildren();
    
    TubeTransDebug.log('开始写入翻译策略数据');
    // 添加策略条目
    strategies.forEach(strategy => {
      const li = document.createElement('li');
      li.textContent = strategy;
      strategiesList.appendChild(li);
    });
    TubeTransDebug.log('写入翻译策略数据完成');
    // 更新UI高度
    updateUI();
  }
  
  /**
   * 获取状态文本
   */
  function getStatusText(status) {
    return VibeSubStatus.getStatusText(status);
  }


  /**
   * 应用已存在的字幕
   */
  async function applyExistingSubtitles() {
    try {
      // 显示加载状态
      setTranslateButtonState('apply', '应用中...', 'fas fa-spinner fa-spin', true);

      await ensureSubtitleReady();
      
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // 通知内容脚本应用字幕
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: ACTIONS.APPLY_SUBTITLES },
        (response) => {
          if (chrome.runtime.lastError) {
            TubeTransDebug.error('应用字幕失败:', chrome.runtime.lastError);
            alert('应用字幕失败，请刷新页面重试');
            
            // 恢复按钮状态
            setTranslateButtonState('apply', '应用字幕', 'fas fa-closed-captioning');
            return;
          }
          
          if (response && response.success) {
            // 关闭弹出窗口
            window.close();
          } else {
            alert('应用字幕失败: ' + (response ? response.message : '未知错误'));
            
            // 恢复按钮状态
            setTranslateButtonState('apply', '应用字幕', 'fas fa-closed-captioning');
          }
        }
      );
    } catch (error) {
      TubeTransDebug.error('应用字幕失败:', error);
      alert(`应用字幕失败: ${error.message}`);
      
      // 恢复按钮状态
      setTranslateButtonState('apply', '应用字幕', 'fas fa-closed-captioning');
    }
  }

  async function ensureSubtitleReady() {
    if (!currentVideoId || !currentTaskId) {
      throw new Error('缺少任务信息，请刷新页面后重试');
    }

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: ACTIONS.GET_SUBTITLE_FROM_STORAGE,
        videoId: currentVideoId,
        taskId: currentTaskId
      }, (result) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            message: chrome.runtime.lastError.message || '无法读取字幕文件'
          });
          return;
        }
        resolve(result);
      });
    });

    if (!response || !response.success || !response.subtitle) {
      throw new Error(response && response.message ? response.message : '字幕文件还没有下载完成');
    }

    return response.subtitle;
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
      TubeTransDebug.log('向background请求检查登录状态...');
      
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: ACTIONS.CHECK_LOGIN_STATUS }, resolve);
      });
      
      if (response && !chrome.runtime.lastError) {
        TubeTransDebug.log('收到登录状态响应:', response);
        
        if (response.isLoggedIn && response.userInfo) {
          userInfo = response.userInfo;
          updateLoginStatus(true);
        } else {
          userInfo = null;
          updateLoginStatus(false);
        }
      } else {
        TubeTransDebug.error('检查登录状态失败:', chrome.runtime.lastError);
        userInfo = null;
        updateLoginStatus(false);
      }
    } catch (error) {
      TubeTransDebug.error('检查登录状态异常:', error);
      userInfo = null;
      updateLoginStatus(false);
    }
  }
  
  /**
   * 更新登录状态UI
   * @param {boolean} isLoggedIn - 是否已登录
   */
  function updateLoginStatus(isLoggedIn) {
    loginText.textContent = '';

    if (isLoggedIn && userInfo) {
      // 已登录状态
      loginText.appendChild(document.createTextNode(userInfo.username || '已登录'));
      const quota = document.createElement('small');
      quota.textContent = ` (今日额度: ${userInfo.daily_quota || '--'})`;
      loginText.appendChild(quota);
      loginLink.href = VibeSubConfig.AUTH_URL; // 账户管理页面
    } else {
      // 未登录状态
      loginText.textContent = '未登录';
      loginLink.href = VibeSubConfig.AUTH_URL; // 登录页面
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
        chrome.tabs.create({ url: VibeSubConfig.AUTH_URL });
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
      TubeTransDebug.log('向background请求登出...');
      
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: ACTIONS.LOGOUT }, resolve);
      });
      
      if (response && response.success) {
        TubeTransDebug.log('登出成功');
        userInfo = null;
        updateLoginStatus(false);
        
        // 隐藏下拉菜单
        if (userDropdown) {
          userDropdown.style.display = 'none';
        }
      } else {
        TubeTransDebug.error('登出失败:', response ? response.message : '未知错误');
      }
    } catch (error) {
      TubeTransDebug.error('登出异常:', error);
    }
  }
  
});
