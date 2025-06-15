/**
 * Simple YouTube Subtitles
 * 
 * 一个简易的字幕引擎，负责解析SRT文件和显示字幕
 */

class SubtitleEngine {
  constructor(videoElement) {
    console.log('SubtitleEngine: 初始化字幕引擎');
    this.video = videoElement;
    this.subtitles = [];
    this.currentSubtitle = null;
    this.subtitleContainer = null;
    this.checkInterval = null;
    
    // 拖拽相关状态
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.subtitleX = 0; // 字幕X偏移量
    this.subtitleY = 0; // 字幕Y偏移量
    this.defaultBottomPosition = 80; // 默认底部位置
    
    // 绑定拖拽事件
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    
    // 从存储中加载位置设置
    this.loadPositionSettings();
  }

  /**
   * 从存储中加载位置设置
   */
  async loadPositionSettings() {
    try {
      const data = await chrome.storage.local.get(['subtitlePosition']);
      if (data.subtitlePosition) {
        this.subtitleX = data.subtitlePosition.x || 0;
        this.subtitleY = data.subtitlePosition.y || 0;
        console.log('SubtitleEngine: 加载位置设置', { x: this.subtitleX, y: this.subtitleY });
      }
    } catch (error) {
      console.error('SubtitleEngine: 加载位置设置失败', error);
    }
  }

  /**
   * 保存位置设置到存储
   */
  async savePositionSettings() {
    try {
      await chrome.storage.local.set({
        subtitlePosition: {
          x: this.subtitleX,
          y: this.subtitleY
        }
      });
      console.log('SubtitleEngine: 保存位置设置', { x: this.subtitleX, y: this.subtitleY });
    } catch (error) {
      console.error('SubtitleEngine: 保存位置设置失败', error);
    }
  }

  /**
   * 鼠标按下事件处理
   */
  handleMouseDown(event) {
    if (event.target.closest('.youtube-custom-subtitle')) {
      event.preventDefault();
      this.isDragging = true;
      this.dragStartX = event.clientX - this.subtitleX;
      this.dragStartY = event.clientY - this.subtitleY;
      
      // 添加拖拽样式
      this.subtitleContainer.classList.add('dragging');
      this.subtitleContainer.style.cursor = 'grabbing';
      this.subtitleContainer.style.userSelect = 'none';
      
      // 添加全局事件监听器
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
      
      console.log('SubtitleEngine: 开始拖拽字幕');
    }
  }

  /**
   * 鼠标移动事件处理
   */
  handleMouseMove(event) {
    if (!this.isDragging) return;
    
    event.preventDefault();
    
    // 计算新位置，无边界限制，让用户自由控制
    this.subtitleX = event.clientX - this.dragStartX;
    this.subtitleY = event.clientY - this.dragStartY;
    
    // 更新字幕位置
    this.updateSubtitlePosition();
  }

  /**
   * 鼠标释放事件处理
   */
  handleMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      
      // 移除拖拽样式
      this.subtitleContainer.classList.remove('dragging');
      this.subtitleContainer.style.cursor = 'grab';
      
      // 移除全局事件监听器
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
      
      // 保存位置设置
      this.savePositionSettings();
      
      console.log('SubtitleEngine: 结束拖拽字幕', { x: this.subtitleX, y: this.subtitleY });
    }
  }

  /**
   * 更新字幕位置
   */
  updateSubtitlePosition() {
    if (this.subtitleContainer) {
      // 计算实际的bottom值
      const bottomValue = this.defaultBottomPosition - this.subtitleY;
      
      this.subtitleContainer.style.transform = `translateX(${this.subtitleX}px)`;
      this.subtitleContainer.style.bottom = `${bottomValue}px`;
    }
  }

  /**
   * 双击重置位置
   */
  handleDoubleClick(event) {
    if (event.target.closest('.youtube-custom-subtitle')) {
      // 重置到默认位置
      this.subtitleX = 0;
      this.subtitleY = 0;
      
      // 更新位置
      this.updateSubtitlePosition();
      
      // 保存设置
      this.savePositionSettings();
      
      console.log('SubtitleEngine: 字幕位置已重置');
      
      // 简单的视觉反馈
      this.subtitleContainer.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        this.subtitleContainer.style.transition = '';
             }, 300);
     }
   }

   /**
    * 显示使用提示
    */
   async showUsageHint() {
     try {
       // 检查是否已经显示过提示
       const data = await chrome.storage.local.get(['subtitleHintShown']);
       if (data.subtitleHintShown) return;

       // 创建提示元素
       const hint = document.createElement('div');
       hint.className = 'subtitle-hint';
       hint.textContent = '💡 拖拽字幕可改变位置，双击重置 💡';

       // 找到视频播放器容器
       const videoPlayer = document.querySelector('.html5-video-player');
       if (videoPlayer) {
         videoPlayer.appendChild(hint);

         // 标记为已显示
         await chrome.storage.local.set({ subtitleHintShown: true });

         // 4秒后移除提示
         setTimeout(() => {
           if (hint.parentElement) {
             hint.parentElement.removeChild(hint);
           }
         }, 4000);
       }
     } catch (error) {
       console.error('SubtitleEngine: 显示提示失败', error);
     }
   }

   /**
   * 解析SRT格式的字幕文件
   * @param {string} srtContent - SRT文件内容
   */
  parseSRT(srtContent) {
    console.log('SubtitleEngine: 开始解析SRT文件');
    
    // 分割字幕块
    const srtLines = srtContent.split('\n');
    let subtitles = [];
    let currentSubtitle = null;
    
    for (let i = 0; i < srtLines.length; i++) {
      const line = srtLines[i].trim();
      
      // 空行表示一个字幕块的结束
      if (line === '') {
        if (currentSubtitle && currentSubtitle.text) {
          subtitles.push(currentSubtitle);
        }
        currentSubtitle = null;
        continue;
      }
      
      // 如果没有当前字幕块，创建一个新的
      if (!currentSubtitle) {
        // 跳过序号行
        if (!isNaN(parseInt(line))) {
          currentSubtitle = { start: 0, end: 0, text: '' };
          continue;
        }
      }
      
      // 解析时间行
      if (currentSubtitle && !currentSubtitle.start && line.includes('-->')) {
        const times = line.split('-->');
        currentSubtitle.start = this.timeToSeconds(times[0].trim());
        currentSubtitle.end = this.timeToSeconds(times[1].trim());
        continue;
      }
      
      // 添加字幕文本
      if (currentSubtitle && currentSubtitle.start) {
        if (currentSubtitle.text) {
          currentSubtitle.text += '<br>' + line;
        } else {
          currentSubtitle.text = line;
        }
      }
    }
    
    // 添加最后一个字幕
    if (currentSubtitle && currentSubtitle.text) {
      subtitles.push(currentSubtitle);
    }
    
    this.subtitles = subtitles;
    console.log(`SubtitleEngine: 解析完成，共有 ${this.subtitles.length} 条字幕`);
    return subtitles;
  }
  
  /**
   * 将SRT时间格式转换为秒
   * @param {string} timeString - SRT格式的时间字符串 (00:00:00,000)
   * @returns {number} 秒数
   */
  timeToSeconds(timeString) {
    const time = timeString.replace(',', '.').split(':');
    return parseFloat(time[0]) * 3600 + parseFloat(time[1]) * 60 + parseFloat(time[2]);
  }
  
  /**
   * 创建字幕容器
   */
  createSubtitleContainer() {
    console.log('SubtitleEngine: 创建字幕容器');
    
    if (this.subtitleContainer) {
      return;
    }
    
    this.subtitleContainer = document.createElement('div');
    this.subtitleContainer.className = 'youtube-custom-subtitle';
    this.subtitleContainer.style.position = 'absolute';
    this.subtitleContainer.style.bottom = `${this.defaultBottomPosition}px`; // 使用默认位置
    this.subtitleContainer.style.left = '0';
    this.subtitleContainer.style.width = '100%';
    this.subtitleContainer.style.textAlign = 'center';
    this.subtitleContainer.style.color = 'white';
    this.subtitleContainer.style.fontSize = '48px'; // 增大字体
    this.subtitleContainer.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)'; // 增强阴影
    this.subtitleContainer.style.zIndex = '9999'; // 大幅提高z-index
    this.subtitleContainer.style.padding = '10px';
    this.subtitleContainer.style.pointerEvents = 'auto'; // 允许交互
    this.subtitleContainer.style.cursor = 'grab'; // 设置拖拽光标
    this.subtitleContainer.style.backgroundColor = 'rgba(0,0,0,0)'; // 添加半透明背景
    this.subtitleContainer.style.display = 'block !important'; // 强制显示
    
    // 尝试不同的方法找到视频播放器容器
    const videoPlayer = document.querySelector('.html5-video-player');
    if (videoPlayer) {
      videoPlayer.appendChild(this.subtitleContainer);
      console.log('SubtitleEngine: 字幕容器已添加到视频播放器中');
    } else {
      const videoContainer = this.video.closest('.html5-video-container');
      if (videoContainer) {
        videoContainer.appendChild(this.subtitleContainer);
        console.log('SubtitleEngine: 字幕容器已添加到视频容器中');
      } else {
        // 最后尝试直接附加到视频旁边
        if (this.video.parentElement) {
          this.video.parentElement.appendChild(this.subtitleContainer);
          console.log('SubtitleEngine: 字幕容器已添加到视频父元素中');
        } else {
          console.error('SubtitleEngine: 无法找到合适的容器，字幕容器未添加');
        }
      }
    }
    
    // 添加拖拽事件监听器
    this.subtitleContainer.addEventListener('mousedown', this.handleMouseDown);
    this.subtitleContainer.addEventListener('dblclick', this.handleDoubleClick);
    
    // 应用保存的位置设置
    this.updateSubtitlePosition();
    
    // 显示使用提示（仅第一次）
    this.showUsageHint();
    
    // 记录创建成功
    console.log('字幕容器详情:', {
      '存在DOM中': !!document.querySelector('.youtube-custom-subtitle'),
      'z-index': this.subtitleContainer.style.zIndex,
      '位置': this.subtitleContainer.style.bottom,
      '父元素': this.subtitleContainer.parentElement,
      '拖拽功能': '已启用'
    });
  }
  
  /**
   * 显示字幕
   */
  showSubtitle(text) {
    if (!this.subtitleContainer) {
      this.createSubtitleContainer();
    }
    
    // 确保字幕容器可见
    this.subtitleContainer.style.display = 'block';
    this.subtitleContainer.style.visibility = 'visible';
    this.subtitleContainer.style.opacity = '1';
    
    // 添加一些HTML结构使字幕更容易阅读
    this.subtitleContainer.innerHTML = `<span style="background-color: rgba(0,0,0,0.5); padding: 3px 8px; border-radius: 4px;">${text}</span>`;
    
    console.log('显示字幕:', {
      '文本': text,
      '容器可见性': this.subtitleContainer.style.display,
      '字幕HTML': this.subtitleContainer.innerHTML
    });
  }
  
  /**
   * 清除字幕
   */
  clearSubtitle() {
    if (this.subtitleContainer) {
      this.subtitleContainer.innerHTML = '';
      console.log('字幕已清除');
    }
  }
  
  /**
   * 开始检查并显示字幕
   */
  start() {
    console.log('SubtitleEngine: 开始监控视频时间并显示字幕');
    
    if (!this.video || this.subtitles.length === 0) {
      console.error('SubtitleEngine: 视频元素或字幕不可用，无法开始显示字幕');
      return;
    }
    
    this.createSubtitleContainer();
    
    // 清除现有的检查间隔
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // 设置新的检查间隔
    this.checkInterval = setInterval(() => {
      const currentTime = this.video.currentTime;
      let foundSubtitle = false;
      
      // 查找当前时间应该显示的字幕
      for (let i = 0; i < this.subtitles.length; i++) {
        const subtitle = this.subtitles[i];
        if (currentTime >= subtitle.start && currentTime <= subtitle.end) {
          if (!this.currentSubtitle || this.currentSubtitle !== subtitle) {
            console.log(`SubtitleEngine: 显示字幕 - ${subtitle.text}`);
            this.currentSubtitle = subtitle;
            this.showSubtitle(subtitle.text);
          }
          foundSubtitle = true;
          break;
        }
      }
      
      // 如果当前时间没有字幕，清除显示
      if (!foundSubtitle && this.currentSubtitle) {
        console.log('SubtitleEngine: 清除字幕');
        this.currentSubtitle = null;
        this.clearSubtitle();
      }
    }, 100);  // 每100毫秒检查一次
  }
  
  /**
   * 停止显示字幕
   */
  stop() {
    console.log('SubtitleEngine: 停止字幕显示');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // 清理拖拽事件监听器
    if (this.subtitleContainer) {
      this.subtitleContainer.removeEventListener('mousedown', this.handleMouseDown);
      this.subtitleContainer.removeEventListener('dblclick', this.handleDoubleClick);
    }
    
    // 清理全局事件监听器（如果正在拖拽）
    if (this.isDragging) {
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
      this.isDragging = false;
    }
    
    this.clearSubtitle();
    this.currentSubtitle = null;
  }
}