/* Local-only connection diagnostics. Never collect credentials, SDK raw events,
 * request/response bodies, full URLs, speech text or browser storage. */
(function (global) {
  'use strict';
  const BUILD = '2026-10-31.3';
  const stages = {
    preflight: '本机环境检查', sdk: '下载星云 SDK', initializing: '创建星云会话',
    resources: '下载数字人资源', 'render-or-session': '渲染 / 会话',
    agent: '智能体服务', socket: '实时连接', rendering: '数字人渲染',
    reconnecting: '重连', connect: '初始化', ask: '实时问答', speak: '播报',
    interrupt: '打断', destroy: '断开', selfcheck: '无密钥自检'
  };
  function clean(value, secrets = [], limit = 700) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    let text = String(value);
    for (const secret of secrets.filter(x => typeof x === 'string' && x).sort((a, b) => b.length - a.length)) {
      for (const variant of [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)]) {
        text = text.split(variant).join('[已隐藏]');
      }
    }
    return text
      .replace(/(?:https?|wss?):\/\/[^\s<>"']+/gi, '[网址已隐藏]')
      .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/gi, '[认证信息已隐藏]')
      .replace(/(["']?(?:app[_-]?(?:id|secret)|api[_-]?key|access[_-]?token|token|session[_-]?id|authorization|sign(?:ature)?)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;&}\]]+)/gi, '$1[已隐藏]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[令牌已隐藏]')
      .replace(/[A-Za-z0-9_+/=-]{40,}/g, '[长标识已隐藏]')
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
      .slice(0, limit);
  }
  function safeError(error, stage, secrets = []) {
    const message = typeof error === 'string' ? error : error?.message;
    let text = clean(message, secrets) || '星云请求失败，SDK 未提供具体说明。';
    // Read only a known error message, never stringify a raw cause/event.
    const inner = error?.cause?.message || error?.originalError?.message;
    if (typeof inner === 'string' && inner !== message) text += ' / 原因：' + clean(inner, secrets, 300);
    const safe = new Error(text.slice(0, 1000));
    const code = clean(error?.code, secrets, 80);
    if (/^[A-Za-z0-9_-]{1,80}$/.test(code)) safe.code = code;
    if (['permission', 'network', 'asr', 'brain', 'ttsa', 'quota', 'sdk'].includes(error?.domain)) safe.domain = error.domain;
    safe.stage = Object.hasOwn(stages, stage) ? stage : 'connect';
    return safe;
  }
  function hint(error) {
    const code = String(error.code || ''), number = Number(code);
    if (error.stage === 'sdk') return '星云 SDK 没有成功载入。先运行下方无密钥自检；可用手机热点对比。不能据此认定必须开代理。';
    if (error.domain === 'quota' || code === 'E2E_CLOSE_4009') return '服务报告额度限制：到星云控制台核对剩余额度和有效期；先断开另一台电脑的会话再试。不要重复消耗额度。';
    if (error.domain === 'permission' || code === 'E2E_CLOSE_4001') return '服务报告权限 / 令牌问题：在星云控制台核对当前应用的接入凭据及权限，不要把凭据发到聊天。';
    if (code === '10005' && /WebGL\s*2/i.test(error.message)) return '星云的严格 WebGL2 检查未通过，不是代理地址或密钥报错。请在 Edge 的 edge://settings/system 开启「可用时使用图形加速」，重新启动浏览器后重试。若仍失败，在 edge://gpu 查看 WebGL2 状态；不要用实验开关强制绕过显卡限制。';
    if (number >= 60001 && number <= 60007) return 'SDK 报告 WebGL / 显卡上下文错误。用最新版 Chrome 或 Edge，核对浏览器图形加速和显卡驱动，并查看无密钥自检的 WebGL2 结果。';
    if (number >= 40001 && number <= 40007) return 'SDK 报告解码错误。用最新版 Chrome 或 Edge 重试，并核对浏览器图形加速；这不是 localhost 地址错误。';
    if (error.domain === 'network' || (number >= 50001 && number <= 50004) || /fetch|network|websocket/i.test(error.message)) return '连接链路未完成。先用同一台电脑换手机热点对比；能打开官网不代表会话和 WebSocket 都可用。网页无法读取代理设置，不要关闭安全防护。';
    if (error.stage === 'preflight') return '按上方具体提示检查。本机 127.0.0.1 地址不是代理；请使用脚本打开的页面和最新版 Chrome / Edge。';
    return '请复制下方诊断报告用于定位。先断开另一台电脑的星云会话；暂时不能仅凭这条错误判定是网络、凭据还是服务端问题。';
  }
  function describe(error) {
    return ['连接失败 · ' + (stages[error.stage] || '初始化'),
      error.code ? '错误码：' + error.code : '错误码：SDK 未提供',
      error.domain ? '错误域：' + error.domain : '', error.message, hint(error)].filter(Boolean).join('\n');
  }
  const errorRank = error => error?.code && error.code !== 'AGENT_INIT_FAILED' ? 2 : error?.code ? 1 : 0;
  function probeWebGL2(strict) {
    let gl;
    try {
      // Fresh canvases are essential: a second getContext() on the same canvas
      // would reuse the first context and silently ignore the stricter options.
      // Official xmovAvatar_e2e@latest.js checkWebGL2Sync, verified 2026-10-31.
      const canvas = document.createElement('canvas');
      gl = strict ? canvas.getContext('webgl2', {failIfMajorPerformanceCaveat: true}) : canvas.getContext('webgl2');
      return gl ? '可用' : '不可用';
    } catch (_) { return '检测失败'; }
    finally {
      try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch (_) {}
    }
  }
  function environment() {
    const nav = global.navigator || {}, ua = nav.userAgent || '';
    const match = ua.match(/(Edg)\/(\d+)/) || ua.match(/(Chrome|Firefox|Version)\/(\d+)/);
    const webgl2 = probeWebGL2(true), basicWebgl2 = probeWebGL2(false);
    const local = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/.test(global.location.hostname);
    return {
      系统: /Windows/i.test(ua) ? 'Windows' : /Macintosh/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '其他 / 未知',
      浏览器: match ? ({Edg: 'Edge', Version: 'Safari'}[match[1]] || match[1]) + ' ' + match[2] : '其他 / 未知',
      打开方式: global.location.protocol === 'file:' ? '直接文件 file:' : local ? '本机 localhost / 127.0.0.1（不是代理）' : global.location.protocol === 'https:' ? 'HTTPS 网站' : '普通 HTTP',
      安全上下文: global.isSecureContext === true ? '是' : global.isSecureContext === false ? '否' : '未知',
      浏览器联网标志: nav.onLine === false ? '离线' : '在线（不保证星云可达）',
      WebGL2: webgl2,
      WebGL2检测口径: '星云相同的创建参数：failIfMajorPerformanceCaveat=true',
      WebGL2普通检测: basicWebgl2,
      WebGL2说明: webgl2 !== '可用' && basicWebgl2 === '可用' ? '普通检测通过，但严格创建失败；请检查图形加速、软件渲染或显卡驱动。不能仅凭此认定具体驱动故障。' : '严格检测通过也不保证后续渲染、声音或会话成功。',
      WebSocket: typeof global.WebSocket === 'function' ? '有' : '无',
      WebAssembly: typeof global.WebAssembly === 'object' ? '有' : '无',
      VideoDecoder: typeof global.VideoDecoder === 'function' ? '有（不保证具体解码器可用）' : '无（仅记录，不单凭此判定失败）'
    };
  }
  class Journal {
    constructor() { this.reset(); }
    reset() { this.started = Date.now(); this.events = []; this.error = null; this.env = null; }
    record(kind, detail = {}) {
      // Whitelist only connection metadata; raw SDK data must never enter here.
      const values = ['stage', 'code', 'domain', 'agentState', 'socketState', 'renderState', 'message']
        .filter(key => detail[key] != null).map(key => key + '=' + clean(detail[key]));
      const line = clean(kind, [], 30) + (values.length ? ' | ' + values.join(' | ') : '');
      if (this.events.at(-1)?.line === line) return;
      this.events.push({seconds: ((Date.now() - this.started) / 1000).toFixed(1), line});
      if (this.events.length > 80) this.events.splice(1, 1);
    }
    failure(error) {
      const safe = safeError(error, error.stage);
      if (!this.error || errorRank(safe) > errorRank(this.error)) this.error = safe;
      this.record('error', safe);
    }
    report() {
      return ['星云课堂连接诊断 · ' + BUILD,
        '仅含环境与脱敏连接事件；不含表单、密钥、请求体、完整网址或问答内容。',
        ...Object.entries(this.env || {}).map(([key, value]) => key + '：' + value),
        '', this.error ? describe(this.error) : '暂无连接失败记录。', '', '连接事件：',
        ...this.events.map(x => x.seconds + 's ' + x.line), '',
        '自检只加载公开 SDK；不验证鉴权、额度、WebSocket 或声音，不创建数字人会话。',
        '无法从网页读取代理设置；127.0.0.1 是这台电脑本身，不是代理出口。'].join('\n');
    }
  }
  global.XmovDiagnostics = Object.freeze({BUILD, clean, safeError, describe, environment, errorRank, Journal});
})(window);
