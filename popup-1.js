/**
 * Tube Trans - AI精翻字幕
 * 弹出窗口脚本 (修改版 - 与后台脚本配合)
 */

// API服务器地址
const API_SERVER = 'https://tube-trans-server-v2-565406642878.us-west1.run.app';


document.addEventListener('DOMContentLoaded', async () => {
  // 获取DOM元素
  const videoTitleEl = document.getElementById('video-title');
  const estimatedTimeEl = document.getElementById('estimated-time');
  const modelSelect = document.getElementById('model');
  const customPromptInput = document.getElementById('custom-prompt');
  const specialTermsInput = document.getElementById('special-terms');
  const targetLangSelect = document.getElementById('target-lang');
  const translateBtn = document.getElementById('translate-btn');
  const progressSection = document.getElementById('translation-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressStatus = document.getElementById('progress-status');
  
  // 开关按钮相关元素
  const togglePrompt = document.getElementById('toggle-prompt');
  const toggleTerms = document.getElementById('toggle-terms');
  const promptContainer = document.getElementById('prompt-container');
  const termsContainer = document.getElementById('terms-container');
  
  // 当前任务和视频信息
  let currentTaskId = null;
  let currentVideoId = null;

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
    // 更新标题
    if (videoInfo.title) {
      videoTitleEl.textContent = videoInfo.title;
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
        <p><i class="fas fa-exclamation-circle"></i> 请在YouTube视频页面打开此插件</p>
        <p>只有在观看视频时才能使用翻译功能</p>
        <p>如果在视频页面仍然看到此提示请刷新页面</p>
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
        language: targetLangSelect.value,
        model: document.getElementById('model').value // 新增此行以获取当前选择的翻译模型
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
      
      // 初始状态对象
      const initialStatus = {
        taskId: currentTaskId,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString()
      };
      
      // 更新本地存储（简化版，主要由后台处理）
      saveTaskStatus(videoId, initialStatus);
      
      // 委托给后台脚本监控任务状态
      chrome.runtime.sendMessage({
        action: 'startTaskMonitoring',
        taskId: currentTaskId,
        videoId: videoId
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('启动后台监控失败:', chrome.runtime.lastError);
        } else {
          console.log('后台监控已启动');
          
          // 提示用户
          setTimeout(() => {
            alert('任务已提交并在后台处理中。您可以关闭此窗口，翻译完成后将收到通知。');
          }, 500);
        }
      });
      
      // 更新UI显示
      updateProgress(0, '任务已创建，后台处理中...');
      
    } catch (error) {
      console.error('提交翻译任务失败:', error);
      alert(`提交翻译任务失败: ${error.message}`);
      
      // 恢复按钮状态
      translateBtn.disabled = false;
      translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>开始翻译';
    }
  }
  
  /**
   * 加载任务状态并更新UI
   */
  async function loadTaskStatus() {
    if (!currentVideoId) {
      console.log('无法获取状态，无视频ID');
      return;
    }
    
    try {
      // 发送消息给后台脚本获取最新状态
      chrome.runtime.sendMessage({
        action: 'getTaskStatus',
        videoId: currentVideoId
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('获取任务状态失败:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.status) {
          const taskStatus = response.status;
          
          // 更新UI和按钮状态
          progressSection.style.display = 'block';
          currentTaskId = taskStatus.taskId;
          
          if (taskStatus.status === 'completed') {
            // 已完成的任务
            updateProgress(1, '翻译完成！');
            translateBtn.disabled = false;
            translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-closed-captioning"></i></span>应用字幕';
            translateBtn.removeEventListener('click', submitTranslationTask);
            translateBtn.addEventListener('click', applyExistingSubtitles);
          } else if (taskStatus.status === 'failed') {
            // 失败的任务
            updateProgress(0, '翻译失败');
            translateBtn.disabled = false;
            translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>开始翻译';
          } else {
            // 进行中的任务
            updateProgress(taskStatus.progress || 0, getStatusText(taskStatus.status));
            translateBtn.disabled = true;
            translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-spinner fa-spin"></i></span>翻译中...';
          }
        }
      });
    } catch (error) {
      console.error('加载任务状态失败:', error);
    }
  }
  
  /**
   * 保存任务状态（简化版，主要任务由后台脚本处理）
   */
  async function saveTaskStatus(videoId, status) {
    if (!videoId) return;
    
    try {
      // 发送消息给后台脚本保存状态
      chrome.runtime.sendMessage({
        action: 'saveTaskStatus',
        videoId: videoId,
        status: status
      });
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
   * 应用已存在的字幕
   */
  async function applyExistingSubtitles() {
    // 可选：简单显示短暂的视觉反馈
  translateBtn.disabled = true;
  translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-spinner fa-spin"></i></span>应用中...';
  
  // 短暂延迟以显示状态变化，然后关闭窗口
  setTimeout(() => {
    window.close();
  }, 300);
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
});