(function() {
    // 获取全局对象（支持浏览器和service worker环境）
    const globalObj = (typeof window !== 'undefined') ? window : globalThis;
    
    // 避免重复初始化
    if (globalObj.TubeTransDebug) {
      return;
    }
  
    const DEBUG_MODE = false;
  
    globalObj.TubeTransDebug = {
      log: (...args) => {
        if (DEBUG_MODE) {
          console.log('[TubeTrans]', ...args);
        }
      },
      error: (...args) => {
        if (DEBUG_MODE) {
          console.error('[TubeTrans]', ...args);
        }
      }
    };
  })();