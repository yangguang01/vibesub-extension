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
  let statusCheckInterval = null;
  
  // 加载保存的设置
  await loadSettings();
  
  // 获取当前标签页的YouTube视频信息
  await getCurrentVideoInfo();
  
  // 加载任务状态
  await loadTaskStatus();
  
  // 设置事件监听器
  translateBtn.addEventListener('click', submitTranslationTask);
  modelSelect.addEventListener('change', saveSettings);
  customPromptInput.addEventListener('change', saveSettings);
  specialTermsInput.addEventListener('change', saveSettings);
  targetLangSelect.addEventListener('change', saveSettings);
  
  // 开关按钮监听
  togglePrompt.addEventListener('change', function() {
    promptContainer.style.display = this.checked ? 'block' : 'none';
    saveToggleState();
  });
  
  toggleTerms.addEventListener('change', function() {
    termsContainer.style.display = this.checked ? 'block' : 'none';
    saveToggleState();
  });
  
  /**
   * 加载保存的设置
   */
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get([
        'translationModel', 
        'customPrompt',
        'specialTerms',
        'targetLanguage',
        'promptToggle',
        'termsToggle'
      ]);
      
      if (settings.translationModel) {
        modelSelect.value = settings.translationModel;
      }
      
      if (settings.customPrompt) {
        customPromptInput.value = settings.customPrompt;
      }
      
      if (settings.specialTerms) {
        specialTermsInput.value = settings.specialTerms;
      }
      
      if (settings.targetLanguage) {
        targetLangSelect.value = settings.targetLanguage;
      }
      
      // 恢复开关状态
      if (settings.promptToggle !== undefined) {
        togglePrompt.checked = settings.promptToggle;
        promptContainer.style.display = settings.promptToggle ? 'block' : 'none';
      }
      
      if (settings.termsToggle !== undefined) {
        toggleTerms.checked = settings.termsToggle;
        termsContainer.style.display = settings.termsToggle ? 'block' : 'none';
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }
  
  /**
   * 保存设置
   */
  async function saveSettings() {
    try {
      await chrome.storage.sync.set({
        translationModel: modelSelect.value,
        customPrompt: customPromptInput.value,
        specialTerms: specialTermsInput.value,
        targetLanguage: targetLangSelect.value
      });
      console.log('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  }
  
  /**
   * 保存开关状态
   */
  async function saveToggleState() {
    try {
      await chrome.storage.sync.set({
        promptToggle: togglePrompt.checked,
        termsToggle: toggleTerms.checked
      });
      console.log('开关状态已保存');
    } catch (error) {
      console.error('保存开关状态失败:', error);
    }
  }
  
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
      
      // 保存任务ID并开始查询状态
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
      
      // 开始查询任务状态
      startStatusCheck();
      
    } catch (error) {
      console.error('提交翻译任务失败:', error);
      alert(`提交翻译任务失败: ${error.message}`);
      
      // 恢复按钮状态
      translateBtn.disabled = false;
      translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>翻译字幕';
    }
  }
  
  /**
   * 加载任务状态并更新UI
   */
  async function loadTaskStatus() {
    if (!currentVideoId) return;
    
    try {
      const key = `task_status_${currentVideoId}`;
      const data = await chrome.storage.local.get([key]);
      const taskStatus = data[key];
      
      if (taskStatus && taskStatus.status !== 'completed' && taskStatus.status !== 'failed') {
        // 有正在进行的任务，恢复状态
        currentTaskId = taskStatus.taskId;
        progressSection.style.display = 'block';
        updateProgress(taskStatus.progress || 0, getStatusText(taskStatus.status));
        
        // 禁用按钮
        translateBtn.disabled = true;
        translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-spinner fa-spin"></i></span>翻译中...';
        
        // 开始查询任务状态
        startStatusCheck();
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
   * 开始定期查询任务状态
   */
  function startStatusCheck() {
    // 清除现有定时器
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }
    
    // 设置新的定时器，每5秒查询一次
    statusCheckInterval = setInterval(checkTaskStatus, 5000);
    
    // 立即执行一次
    checkTaskStatus();
  }
  
  /**
   * 查询任务状态
   */
  async function checkTaskStatus() {
    if (!currentTaskId || !currentVideoId) return;
    
    try {
      const response = await fetch(`${API_SERVER}/api/tasks/${currentTaskId}`);
      
      if (!response.ok) {
        throw new Error('获取任务状态失败');
      }
      
      const data = await response.json();
      console.log('任务状态:', data);
      
      // 更新进度显示
      updateProgress(
        data.progress || 0,
        getStatusText(data.status)
      );
      
      // 保存最新状态
      await saveTaskStatus(currentVideoId, {
        taskId: currentTaskId,
        status: data.status,
        progress: data.progress || 0,
        updatedAt: new Date().toISOString()
      });
      
      // 如果任务已完成或失败，停止查询
      if (data.status === 'completed') {
        clearInterval(statusCheckInterval);
        
        // 下载字幕文件
        await downloadSubtitleFile();
        
        // 恢复按钮状态
        translateBtn.disabled = false;
        translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>翻译字幕';
        
      } else if (data.status === 'failed') {
        clearInterval(statusCheckInterval);
        
        // 显示错误信息
        alert(`翻译任务失败: ${data.error || '未知错误'}`);
        
        // 恢复按钮状态
        translateBtn.disabled = false;
        translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>翻译字幕';
      }
      
    } catch (error) {
      console.error('查询任务状态失败:', error);
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
        return '未知状态';
    }
  }
  
  /**
   * 下载字幕文件
   */
  async function downloadSubtitleFile() {
    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      const response = await fetch(`${API_SERVER}/api/subtitles/${currentTaskId}`);
      
      if (!response.ok) {
        throw new Error('下载字幕文件失败');
      }
      
      const srtContent = await response.text();
      
      // 发送消息到内容脚本，保存字幕文件
      chrome.tabs.sendMessage(
        currentTab.id,
        {
          action: 'saveSubtitleFile',
          data: {
            videoId: currentVideoId,
            srtContent: srtContent
          }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('保存字幕文件失败:', chrome.runtime.lastError);
            return;
          }
          
          if (response && response.success) {
            // 在当前页面应用字幕
            chrome.tabs.sendMessage(
              currentTab.id,
              { action: 'applySubtitles' }
            );
            
            // 关闭弹出窗口
            window.close();
          }
        }
      );
    } catch (error) {
      console.error('下载字幕文件失败:', error);
      alert(`下载字幕文件失败: ${error.message}`);
    }
  }
}); 