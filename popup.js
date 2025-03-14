/**
 * Tube Trans - AI精翻字幕
 * 弹出窗口脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 获取DOM元素
  const thumbnailEl = document.getElementById('thumbnail');
  const videoTitleEl = document.getElementById('video-title');
  const durationEl = document.getElementById('duration');
  const subtitleAvailableEl = document.getElementById('subtitle-available');
  const modelSelect = document.getElementById('model');
  const apiKeyInput = document.getElementById('api-key');
  const toggleKeyBtn = document.getElementById('toggle-key');
  const targetLangSelect = document.getElementById('target-lang');
  const translateBtn = document.getElementById('translate-btn');
  
  // 加载保存的设置
  await loadSettings();
  
  // 获取当前标签页的YouTube视频信息
  await getCurrentVideoInfo();
  
  // 设置事件监听器
  toggleKeyBtn.addEventListener('click', toggleApiKeyVisibility);
  translateBtn.addEventListener('click', submitTranslationTask);
  modelSelect.addEventListener('change', saveSettings);
  apiKeyInput.addEventListener('blur', saveSettings);
  targetLangSelect.addEventListener('change', saveSettings);
  
  /**
   * 加载保存的设置
   */
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get([
        'translationModel', 
        'apiKey', 
        'targetLanguage'
      ]);
      
      if (settings.translationModel) {
        modelSelect.value = settings.translationModel;
      }
      
      if (settings.apiKey) {
        apiKeyInput.value = settings.apiKey;
      }
      
      if (settings.targetLanguage) {
        targetLangSelect.value = settings.targetLanguage;
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
        apiKey: apiKeyInput.value,
        targetLanguage: targetLangSelect.value
      });
      console.log('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  }
  
  /**
   * 切换API密钥可见性
   */
  function toggleApiKeyVisibility() {
    const eyeIcon = toggleKeyBtn.querySelector('i');
    
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      eyeIcon.classList.remove('fa-eye');
      eyeIcon.classList.add('fa-eye-slash');
    } else {
      apiKeyInput.type = 'password';
      eyeIcon.classList.remove('fa-eye-slash');
      eyeIcon.classList.add('fa-eye');
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
    // 更新缩略图
    if (videoInfo.thumbnail) {
      thumbnailEl.src = videoInfo.thumbnail;
      thumbnailEl.alt = videoInfo.title || '视频缩略图';
    }
    
    // 更新标题
    if (videoInfo.title) {
      videoTitleEl.textContent = videoInfo.title;
    }
    
    // 更新时长
    if (videoInfo.duration) {
      durationEl.textContent = formatDuration(videoInfo.duration);
    }
    
    // 更新字幕状态
    if (videoInfo.hasSubtitles !== undefined) {
      subtitleAvailableEl.textContent = videoInfo.hasSubtitles 
        ? '字幕可用' 
        : '无字幕';
      
      // 如果没有字幕，禁用翻译按钮
      if (!videoInfo.hasSubtitles) {
        translateBtn.disabled = true;
        translateBtn.title = '当前视频没有可用字幕';
      }
    }
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
   * 格式化视频时长
   */
  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '--:--';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${padZero(remainingMinutes)}:${padZero(remainingSeconds)}`;
    }
    
    return `${minutes}:${padZero(remainingSeconds)}`;
  }
  
  /**
   * 数字补零
   */
  function padZero(num) {
    return num.toString().padStart(2, '0');
  }
  
  /**
   * 提交翻译任务
   */
  async function submitTranslationTask() {
    // 检查API密钥
    if (!apiKeyInput.value.trim()) {
      alert('请输入API密钥');
      apiKeyInput.focus();
      return;
    }
    
    // 获取当前标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    // 禁用按钮，显示加载状态
    translateBtn.disabled = true;
    translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-spinner fa-spin"></i></span>提交中...';
    
    // 发送翻译请求到内容脚本
    chrome.tabs.sendMessage(
      currentTab.id,
      {
        action: 'translateSubtitles',
        settings: {
          model: modelSelect.value,
          apiKey: apiKeyInput.value,
          targetLanguage: targetLangSelect.value
        }
      },
      (response) => {
        // 恢复按钮状态
        translateBtn.disabled = false;
        translateBtn.innerHTML = '<span class="submit-icon icon"><i class="fas fa-language"></i></span>翻译字幕';
        
        if (chrome.runtime.lastError) {
          console.error('提交翻译任务失败:', chrome.runtime.lastError);
          alert('提交翻译任务失败，请重试');
          return;
        }
        
        if (response && response.success) {
          // 关闭弹出窗口
          window.close();
        } else {
          alert(response?.message || '提交翻译任务失败，请重试');
        }
      }
    );
  }
}); 