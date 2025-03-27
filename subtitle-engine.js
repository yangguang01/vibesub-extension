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
    this.subtitleContainer.style.bottom = '80px'; // 调整位置，避免与YouTube控件重叠
    this.subtitleContainer.style.left = '0';
    this.subtitleContainer.style.width = '100%';
    this.subtitleContainer.style.textAlign = 'center';
    this.subtitleContainer.style.color = 'white';
    this.subtitleContainer.style.fontSize = '48px'; // 增大字体
    this.subtitleContainer.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)'; // 增强阴影
    this.subtitleContainer.style.zIndex = '9999'; // 大幅提高z-index
    this.subtitleContainer.style.padding = '10px';
    this.subtitleContainer.style.pointerEvents = 'none';
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
    
    // 记录创建成功
    console.log('字幕容器详情:', {
      '存在DOM中': !!document.querySelector('.youtube-custom-subtitle'),
      'z-index': this.subtitleContainer.style.zIndex,
      '位置': this.subtitleContainer.style.bottom,
      '父元素': this.subtitleContainer.parentElement
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
    
    this.clearSubtitle();
    this.currentSubtitle = null;
  }
}