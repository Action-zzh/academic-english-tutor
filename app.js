(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const course = window.AECOURSE;
  const diagnostics = new window.XmovDiagnostics.Journal();
  let checkingConnection = false;
  // Prime the browser's asynchronous voice catalogue before rehearsal starts.
  window.speechSynthesis?.getVoices();
  const state = {
    mode: 'preview', adapter: null, connected: false, connection: 0, releasing: null,
    answerNode: null, answerBusy: false, questionEpoch: 0, history: [],
    speechCancel: null, subtitle: { en: '', zh: '', source: '' }, rendered: -1,
    recorder: null, stream: null, recordingUrl: null, replayUrl: null, recognition: null
  };
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const current = () => course.slides[player.index];
  function toast(text) {
    $('toast').textContent = text;
    $('toast').classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $('toast').classList.remove('visible'), 4500);
  }
  function connectionStatus(kind, text) {
    $('connectionStatus').className = 'status ' + kind;
    $('connectionStatus').querySelector('span').textContent = text;
  }
  function showSubtitle(en, zh, source) {
    state.subtitle = { en, zh, source };
    renderSubtitle();
  }
  function renderSubtitle() {
    $('subtitleEnglish').textContent = state.subtitle.en;
    $('subtitleChinese').textContent = state.subtitle.zh;
    $('subtitleSource').textContent = state.subtitle.source;
    document.body.classList.toggle('subtitle-off', $('subtitleMode').value === 'off');
    $('subtitleChinese').hidden = $('subtitleMode').value !== 'both' || !state.subtitle.zh;
  }
  function renderSlide() {
    const slide = current();
    $('slideCanvas').className = 'slide-canvas imported-slide';
    $('slideCanvas').innerHTML = `<img src="${esc(slide.image)}" alt="原课件第 ${slide.sourcePage} 页：${esc(slide.title)}" width="1920" height="1440"><p class="slide-load-error" hidden>课件图片未加载。请完整解压新课堂包，保留 dist/assets/slides 文件夹。</p>`;
    $('slideCanvas').querySelector('img').onerror = () => {
      if (current() !== slide) return;
      pauseAll('error');
      $('slideCanvas').querySelector('.slide-load-error').hidden = false;
      toast('本页图片未加载，讲解已暂停。请完整解压课堂包。');
    };
    $('slideTitleSmall').textContent = `${String(player.index + 1).padStart(2, '0')} · ${slide.cn}`;
    $('thumbnails').innerHTML = course.slides.map((s, i) => `<button class="slide-thumb source-thumb ${i === player.index ? 'active' : ''}" data-slide="${i}" aria-current="${i === player.index ? 'page' : 'false'}" aria-label="第 ${i + 1} 页 · ${esc(s.title)}" title="${i + 1} · ${esc(s.cn)}"><img src="${esc(s.thumb)}" alt="" width="240" height="180" loading="lazy"><span class="thumb-number">${String(i + 1).padStart(2, '0')}</span></button>`).join('');
    document.querySelectorAll('[data-slide]').forEach(b => b.onclick = () => selectSlide(Number(b.dataset.slide)));
    $('thumbnails').querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    showSubtitle('Ready for this slide. Press Play to begin.', slide.cn + ' · 点击播放开始本页讲解', 'LECTURE SLIDE · ' + (player.index + 1));
    state.rendered = player.index;
    scaleSlide();
  }
  function scaleSlide() {
    const frame = $('slideFrame'), area = frame.parentElement;
    const css = getComputedStyle(area), fc = getComputedStyle(frame);
    const horizontal = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
    const vertical = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom) + $('slideStageNote').offsetHeight + (parseFloat(css.rowGap) || 0);
    const insetX = parseFloat(fc.borderLeftWidth) + parseFloat(fc.borderRightWidth) + parseFloat(fc.paddingLeft) + parseFloat(fc.paddingRight);
    const insetY = parseFloat(fc.borderTopWidth) + parseFloat(fc.borderBottomWidth) + parseFloat(fc.paddingTop) + parseFloat(fc.paddingBottom);
    const ratio = course.width / course.height;
    const inner = Math.max(60, Math.min(area.clientWidth - horizontal - insetX, (area.clientHeight - vertical - insetY) * ratio));
    frame.style.width = (inner + insetX) + 'px';
    frame.style.height = (inner / ratio + insetY) + 'px';
    $('slideStageNote').style.width = (inner + insetX) + 'px';
    $('slideCanvas').style.width = course.width + 'px';
    $('slideCanvas').style.height = course.height + 'px';
    $('slideCanvas').style.transform = `scale(${inner / course.width})`;
  }
  function stopOutputs() {
    state.speechCancel?.();
    state.speechCancel = null;
    if (state.adapter?.busy) {
      const interrupted = state.adapter.interrupt();
      if (!interrupted) toast('打断未被服务确认。请先断开数字人，再继续。');
    }
  }
  function cancelAnswer() {
    ++state.questionEpoch;
    clearTimeout(cancelAnswer.timer);
    if (state.answerBusy && state.answerNode) {
      state.answerNode.parentElement.querySelector('small').textContent = 'LIVE XMOV · INTERRUPTED / PARTIAL';
    }
    state.answerNode = null;
    state.answerBusy = false;
    $('askButton').disabled = false;
  }
  function pauseAll(reason = 'paused') {
    cancelAnswer();
    player.pause(reason);
  }
  function selectSlide(index) {
    cancelAnswer();
    player.select(index);
  }
  function localSpeech(text) {
    return new Promise((resolve, reject) => {
      let settled = false, timer, utterance;
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (state.speechCancel === cancel) state.speechCancel = null;
        if (error) reject(error); else resolve(result);
      };
      const cancel = () => {
        finish('interrupted');
        if (utterance) window.speechSynthesis.cancel();
      };
      state.speechCancel = cancel;
      if (state.mode === 'captions') {
        timer = setTimeout(() => finish('completed'), Math.max(1800, text.split(/\s+/).length * 60000 / course.wordsPerMinute));
        return;
      }
      const voice = window.speechSynthesis?.getVoices().find(v => v.localService && /^en(?:[-_]|$)/i.test(v.lang));
      if (!voice) { finish('failed', new Error('本机没有可用的离线英语音色。请选择仅字幕排练，或连接星云。')); return; }
      utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = Number($('speechRate').value);
      utterance.onend = () => finish('completed');
      utterance.onerror = () => finish('failed', new Error('浏览器语音没有完成。未自动改成静音播放。'));
      timer = setTimeout(() => { finish('failed', new Error('浏览器语音未结束，已暂停。')); window.speechSynthesis.cancel(); }, 60000);
      window.speechSynthesis.speak(utterance);
    });
  }
  const player = new window.LecturePlayer({
    slides: course.slides,
    autoAdvance: () => $('autoAdvance').checked,
    stopSpeech: stopOutputs,
    speak: text => {
      if (state.mode === 'live') {
        if (!state.connected || !state.adapter) return Promise.reject(new Error('星云连接已断开，请重连或选择离线排练。'));
        return state.adapter.speak(text);
      }
      if (state.mode === 'browser' || state.mode === 'captions') return localSpeech(text);
      return Promise.reject(new Error('请先选择播放方式。'));
    },
    onCue: cue => showSubtitle(cue.en, cue.zh, state.mode === 'live' ? 'AUTHORED LECTURE · XMOV SPEECH' : state.mode === 'browser' ? 'BROWSER VOICE REHEARSAL · 非数字人' : 'CAPTION REHEARSAL · 无声音'),
    onChange: p => {
      if (state.rendered !== p.index) renderSlide();
      $('pageCounter').textContent = `${p.index + 1} / ${course.slides.length}`;
      const progress = Math.round((p.index + p.cue / current().cues.length) / course.slides.length * 100);
      $('progressFill').style.width = progress + '%';
      $('progressTrack').setAttribute('aria-valuenow', String(progress));
      $('prevButton').disabled = p.index === 0;
      $('nextButton').disabled = p.index === course.slides.length - 1;
      $('playButton').textContent = p.status === 'playing' ? '■ 暂停讲解' : p.status === 'complete' ? '↻ 重讲本页' : p.status === 'paused' ? '▶ 继续讲解' : '▶ 播放讲解';
      const names = { playing: state.mode === 'live' ? '正在讲解' : '排练中 · 非数字人', paused: '已暂停 · 可继续', complete: '本页已完成', ready: '准备讲解', error: '讲解中断 · 请检查连接' };
      $('teacherState').textContent = names[p.status] || '准备讲解';
    },
    onError: error => {
      if (state.mode === 'browser') {
        state.mode = 'preview';
        connectionStatus('error', '语音排练不可用');
        $('modeLabel').textContent = '浏览器语音不可用';
        $('teacherState').textContent = '点击播放 · 重选排练方式';
      }
      toast(error.message);
    }
  });
  function beginLecture() {
    if (state.answerBusy) pauseAll();
    if (state.mode === 'preview' || (state.mode === 'live' && !state.connected)) {
      $('rehearsalDialog').showModal();
      return;
    }
    closeChat();
    void player.play();
  }
  function message(text, label, type = 'tutor') {
    const el = document.createElement('div');
    el.className = 'message ' + type;
    el.innerHTML = `<small>${esc(label)}</small><p></p>`;
    el.querySelector('p').textContent = text;
    $('transcript').append(el);
    $('transcript').scrollTop = $('transcript').scrollHeight;
    return el.querySelector('p');
  }
  function openChat() { $('chatPanel').hidden = false; $('chatButton').setAttribute('aria-expanded', 'true'); }
  function closeChat() { $('chatPanel').hidden = true; $('chatButton').setAttribute('aria-expanded', 'false'); }
  async function ask(question) {
    question = String(question || '').trim().slice(0, 1500);
    if (!question || state.answerBusy) return;
    pauseAll();
    openChat();
    message(question, 'STUDENT', 'user');
    $('question').value = '';
    if (!state.connected || !state.adapter) {
      message('Please connect Xmov for a live answer. Offline mode displays the authored lecture only.', 'NOT CONNECTED', 'notice');
      return;
    }
    const adapter = state.adapter, request = ++state.questionEpoch;
    const row = { slide: player.index + 1, question, answer: '', mode: 'xmov-live', complete: false };
    state.history.push(row);
    state.answerNode = message('Waiting for the real Xmov response…', 'LIVE XMOV · WAITING');
    state.answerBusy = true;
    $('askButton').disabled = true;
    const previous = state.history.slice(-4, -1).filter(x => x.complete).map(x => `Student: ${x.question}\nTutor: ${x.answer}`).join('\n');
    const prompt = `${window.AELAB.tutorPrompt}\nCourse context: ${window.AELAB.context}\nCurrent physical slide ${player.index + 1} of ${course.slides.length}: ${current().title}.\n<slide_source>\n${current().sourceText}\n</slide_source>\nAuthored explanation: ${current().en}\nPrevious conversation (context only):\n${previous}\nCurrent student question: ${question}`;
    showSubtitle('Waiting for the tutor’s answer…', '实时问答 · 课件讲解已暂停', 'LIVE XMOV · Q&A');
    cancelAnswer.timer = setTimeout(() => {
      if (request !== state.questionEpoch) return;
      pauseAll('error');
      message('No completion signal was received. The lecture remains paused. Reconnect or retry after checking the service.', 'LIVE TIMEOUT', 'notice');
    }, 90000);
    try {
      // Let callbacks from the just-interrupted lecture drain before asking.
      await new Promise(resolve => setTimeout(resolve, 300));
      if (request !== state.questionEpoch || adapter !== state.adapter) return;
      await adapter.ask(prompt);
    }
    catch (_) {
      if (request !== state.questionEpoch) return;
      cancelAnswer();
      message('The live request failed. No prepared answer was substituted.', 'LIVE ERROR', 'notice');
    }
  }
  function placeholder() {
    $('avatar-container').innerHTML = '<div id="avatarPlaceholder" class="avatar-placeholder"><div class="teacher-monogram">AE</div><h2>你的数字人讲师</h2><p>接入魔珐星云，开始逐页授课</p><button id="stageConnect" class="gold-button">连接星云数字人</button><small>这里将显示真实数字人<br>当前未连接，不是静态人物演示</small></div>';
    $('stageConnect').onclick = openConfig;
  }
  function updateConnectionReport() {
    $('connectionReport').value = diagnostics.report();
  }
  function connectionEvent(kind, detail) {
    diagnostics.record(kind, detail);
    updateConnectionReport();
  }
  function showConnectionFailure(error) {
    diagnostics.failure(error);
    $('connectionMessage').textContent = window.XmovDiagnostics.describe(diagnostics.error);
    $('connectionDiagnostics').open = true;
    updateConnectionReport();
    if (!$('configDialog').open) toast('星云连接出现错误。点击「配置」查看具体错误和诊断报告。');
  }
  function updateConnectionButtons() {
    $('connectSubmit').disabled = !!state.adapter || !!state.releasing || checkingConnection;
    $('connectionCheck').disabled = !!state.adapter || !!state.releasing || checkingConnection;
  }
  async function disconnect() {
    const attempt = ++state.connection;
    pauseAll();
    const adapter = state.adapter;
    state.adapter = null;
    state.connected = false;
    state.mode = 'preview';
    $('connectForm').reset();
    $('connectSubmit').disabled = true;
    $('connectionCheck').disabled = true;
    connectionStatus('', '已断开');
    $('modeLabel').textContent = '课件预览';
    $('answerMode').textContent = '尚未连接实时问答';
    $('speechRate').disabled = false;
    const release = adapter ? adapter.destroy().catch(() => {}) : state.releasing;
    state.releasing = release;
    if (release) await release;
    if (state.releasing === release) state.releasing = null;
    if (attempt !== state.connection) return;
    placeholder();
    updateConnectionButtons();
  }
  function openConfig() {
    if (state.recorder?.state === 'recording') { toast('请先停止录屏，避免录到密钥。'); return; }
    if (!$('configDialog').open) $('configDialog').showModal();
    // Dispose an errored session before the next Connect click. Awaiting inside
    // the submit handler would lose the transient browser user activation.
    if (state.adapter && !state.connected && state.adapter.status !== 'pending') void disconnect();
    updateConnectionButtons();
    $('connectionMessage').textContent = state.connected ? '已连接。直接关闭此面板开始讲解；更换应用请先断开。' : diagnostics.error ? window.XmovDiagnostics.describe(diagnostics.error) : state.adapter ? '正在连接，请等待，或点击离线排练取消。' : '诊断版 ' + window.XmovDiagnostics.BUILD + ' · 可先运行无密钥自检。';
    updateConnectionReport();
  }
  $('connectForm').onsubmit = async event => {
    event.preventDefault();
    if (state.adapter || state.releasing || checkingConnection) return;
    const form = event.currentTarget;
    const appId = form.elements.appId.value.trim(), appSecret = form.elements.appSecret.value.trim();
    if (!appId || !appSecret) return;
    pauseAll();
    const attempt = ++state.connection;
    // Keep earlier selfcheck evidence; only clear the previous attempt's error.
    diagnostics.error = null;
    diagnostics.env = window.XmovDiagnostics.environment();
    connectionEvent('connect', {message: '用户主动连接；凭据不写入诊断报告。'});
    $('avatar-container').replaceChildren();
    $('connectSubmit').disabled = true;
    $('connectionCheck').disabled = true;
    $('connectionMessage').textContent = '正在连接，等待真实的就绪状态…';
    const valid = () => attempt === state.connection && state.adapter === adapter;
    const adapter = new window.XmovTutorAdapter({
      containerId: 'avatar-container',
      onStatus: (status, detail) => {
        if (!valid()) return;
        if (!detail.conversationState) connectionEvent(status, detail);
        if (status === 'connected') {
          if (!state.connected) {
            diagnostics.error = null;
            $('connectionMessage').textContent = '已连接。关闭面板后点击播放讲解。';
            updateConnectionReport();
            state.connected = true; state.mode = 'live';
            connectionStatus('live', '已连接');
            $('modeLabel').textContent = 'Live Xmov · 具身智能';
            $('answerMode').textContent = 'Live Xmov · 实时回答';
            $('speechRate').disabled = true;
          }
          if (detail.conversationState === 'completed' && state.answerBusy) {
            clearTimeout(cancelAnswer.timer);
            const last = state.history[state.history.length - 1];
            if (last) last.complete = true;
            state.answerBusy = false; state.answerNode = null;
            $('askButton').disabled = false;
            $('teacherState').textContent = '回答结束 · 点击继续讲解';
          }
          if (detail.conversationState === 'failed' && state.answerBusy) {
            cancelAnswer();
            message('The answer failed and may be incomplete.', 'LIVE ERROR', 'notice');
          }
        } else if (status === 'pending') {
          if (state.connected) pauseAll('error');
          state.connected = false;
          connectionStatus('active', '连接中…');
          if (!diagnostics.error) $('connectionMessage').textContent = detail.message || '正在连接…';
        } else if (status === 'error' || status === 'destroyed') {
          state.connected = false;
          pauseAll('error');
          connectionStatus('error', '连接不可用');
          if (detail.code || detail.stage) showConnectionFailure(detail);
          else if (!diagnostics.error) $('connectionMessage').textContent = detail.message || '连接已中断；诊断报告保留了最后状态。';
        }
      },
      onText: (text, meta) => {
        if (!valid() || !state.answerNode || !state.answerBusy) return;
        state.answerNode.textContent = text;
        state.answerNode.parentElement.querySelector('small').textContent = 'LIVE XMOV · GENERATED ANSWER';
        state.history[state.history.length - 1].answer = text;
        $('transcript').scrollTop = $('transcript').scrollHeight;
        // English is the actual model output. Do not invent a live translation.
        showSubtitle(text, '实时英文回答 · 非预写讲稿，未自动翻译', 'LIVE XMOV · Q&A');
      },
      onSpeech: kind => {
        if (valid() && (kind === 'speak_start' || kind === 'voice_start')) $('teacherState').textContent = state.answerBusy ? '正在回答' : '正在讲解';
      },
      onDiagnostic: detail => { if (valid()) connectionEvent('sdk-state', detail); },
      onError: error => { if (valid()) showConnectionFailure(error); }
    });
    state.adapter = adapter;
    try {
      // No awaited work before this call: the Connect click owns activation.
      const pending = adapter.connect({ appId, appSecret });
      form.reset();
      await pending;
      if (valid() && state.connected) { $('configDialog').close(); toast('星云已连接。点击播放讲解，开始本页课程。'); }
    } catch (error) {
      if (valid()) {
        // Keep the sanitized SDK exception visible after destroying the session.
        showConnectionFailure(error);
        const failure = diagnostics.error;
        await disconnect();
        if (!state.adapter && diagnostics.error === failure) connectionStatus('error', '连接失败 · 查看配置');
      }
    } finally { updateConnectionButtons(); }
  };
  $('connectionCheck').onclick = async () => {
    if (state.adapter || state.releasing || checkingConnection) return;
    checkingConnection = true;
    updateConnectionButtons();
    $('connectionDiagnostics').open = true;
    diagnostics.env = window.XmovDiagnostics.environment();
    connectionEvent('selfcheck', {message: '检查本机能力和星云公开 SDK；不读取表单，不创建数字人会话。'});
    $('connectionCheckStatus').textContent = '正在检测（最多约 30 秒）…';
    try {
      await window.XmovTutorAdapter.testNetwork(detail => {
        connectionEvent('selfcheck', detail);
        $('connectionCheckStatus').textContent = detail.message;
      });
      $('connectionCheckStatus').textContent = '自检完成，结果在下方报告中。自检不会验证账号、额度或完整实时会话。';
    } catch (_) {
      connectionEvent('selfcheck', {message: '此浏览器无法完成自检。请保留环境信息，使用最新版 Chrome / Edge。'});
      $('connectionCheckStatus').textContent = '自检未完成，已有结果保留在报告中。';
    } finally { checkingConnection = false; updateConnectionButtons(); }
  };
  $('copyConnectionReport').onclick = async () => {
    updateConnectionReport();
    try {
      await navigator.clipboard.writeText($('connectionReport').value);
      $('connectionCheckStatus').textContent = '诊断报告已复制，可以粘贴发送；无需截图密钥面板。';
    } catch (_) {
      $('connectionReport').focus(); $('connectionReport').select();
      $('connectionCheckStatus').textContent = '浏览器未允许自动复制。报告已选中，请按 Ctrl+C（Mac：⌘C）。';
    }
  };
  $('configDialog').addEventListener('close', () => {
    $('connectForm').reset();
    if (state.adapter?.status === 'pending') void disconnect();
  });
  $('offlineButton').onclick = () => { void disconnect(); $('configDialog').close(); toast('已断开星云。播放时可选择离线排练。'); };
  $('playButton').onclick = () => player.status === 'playing' ? pauseAll() : beginLecture();
  $('prevButton').onclick = () => selectSlide(player.index - 1);
  $('nextButton').onclick = () => selectSlide(player.index + 1);
  $('resumeButton').onclick = beginLecture;
  $('configButton').onclick = openConfig;
  $('chatButton').onclick = () => $('chatPanel').hidden ? openChat() : closeChat();
  $('closeChat').onclick = closeChat;
  $('askForm').onsubmit = event => { event.preventDefault(); void ask($('question').value); };
  document.querySelectorAll('[data-question]').forEach(button => button.onclick = () => void ask(button.dataset.question));
  $('helpButton').onclick = () => $('helpDialog').showModal();
  $('scriptButton').onclick = () => {
    $('scriptContent').innerHTML = `<p class="script-meta">原课件 ${player.index + 1} / ${course.slides.length} · ${esc(current().cn)} · 本页约 ${Math.round(current().estimatedSeconds)} 秒</p>` + current().cues.map((cue, i) => `<p class="script-meta">${i + 1} / ${current().cues.length}</p><p class="script-en" lang="en">${esc(cue.en)}</p><p class="script-zh">${esc(cue.zh)}</p>`).join('');
    $('scriptDialog').showModal();
  };
  $('zoomButton').onclick = () => {
    pauseAll();
    $('zoomTitle').textContent = `原课件 ${player.index + 1} / ${course.slides.length} · ${current().cn}`;
    $('zoomImage').src = current().image;
    $('zoomImage').alt = current().title;
    $('zoomDialog').showModal();
  };
  $('subtitleMode').onchange = renderSubtitle;
  $('fullscreenButton').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (_) { toast('当前浏览器未提供全屏模式。'); }
  };
  $('rehearsalConnect').onclick = () => { $('rehearsalDialog').close(); openConfig(); };
  function rehearsal(mode) {
    state.mode = mode;
    $('rehearsalDialog').close();
    connectionStatus('active', mode === 'browser' ? '语音排练' : '字幕排练');
    $('modeLabel').textContent = '离线排练 · 非数字人';
    beginLecture();
  }
  $('browserRehearsal').onclick = () => rehearsal('browser');
  $('textRehearsal').onclick = () => rehearsal('captions');
  // Web Speech here is an optional input aid, never an automatic submission.
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  $('voiceButton').onclick = () => {
    if (!Recognition) { toast('此浏览器不支持语音输入，请直接输入英文问题。'); return; }
    if (state.recognition) { state.recognition.stop(); return; }
    pauseAll();
    const rec = new Recognition();
    state.recognition = rec;
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = event => { $('question').value = Array.from(event.results).map(r => r[0].transcript).join(' ').slice(0, 1500); };
    rec.onerror = () => toast('语音输入未完成。请检查麦克风权限，或改为输入文字。');
    rec.onend = () => { state.recognition = null; $('voiceButton').textContent = '语音'; toast('请核对识别文本，再点击发送。'); };
    try { rec.start(); $('voiceButton').textContent = '停止'; }
    catch (_) { state.recognition = null; toast('无法启动语音识别。'); }
  };
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
  addEventListener('keydown', event => {
    if (event.target.closest('input,textarea,select,button,a,summary') || document.querySelector('dialog[open]')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); selectSlide(player.index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); selectSlide(player.index + 1); }
    if (event.key === ' ') { event.preventDefault(); $('playButton').click(); }
  });
  new ResizeObserver(scaleSlide).observe($('slideFrame').parentElement);
  document.fonts?.ready.then(scaleSlide);
  $('exportButton').onclick = () => {
    const lines = ['Academic English lecture Q&A', 'Lesson: ' + course.topic, 'Source: ' + course.source.name + ' / ' + course.source.author, 'Slide numbers refer to physical file order (1–47).', ...state.history.map(x => `\nSlide ${x.slide} | ${x.complete ? 'completed' : 'partial or failed'}\nStudent: ${x.question}\nXmov: ${x.answer}`)];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/plain;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'academic-english-qa.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('recordButton').onclick = () => $('recordDialog').showModal();
  function stopRecording() {
    if (state.recorder?.state === 'recording') state.recorder.stop();
    state.stream?.getTracks().forEach(t => t.stop());
    state.stream = null;
    $('startRecording').disabled = false; $('stopRecording').disabled = true;
    $('recordButton').textContent = '高清录制'; $('recordButton').classList.remove('recording');
  }
  $('startRecording').onclick = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) { $('recordStatus').textContent = '本浏览器不支持网页录屏，请使用系统录屏工具并检查系统音频。'; return; }
    if (state.recorder?.state === 'recording') return;
    $('startRecording').disabled = true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: {width: {ideal: 1920}, height: {ideal: 1080}, frameRate: {ideal: 30}}, audio: true });
      state.stream = stream;
      const chunks = [], preferred = 'video/webm;codecs=vp9,opus';
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(preferred) ? {mimeType: preferred} : {});
      state.recorder = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || 'video/webm';
        if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
        state.recordingUrl = URL.createObjectURL(new Blob(chunks, {type}));
        $('recordDownload').href = state.recordingUrl;
        $('recordDownload').download = 'academic-english-replay.' + (type.includes('mp4') ? 'mp4' : 'webm');
        $('recordDownload').textContent = '下载本次录屏'; $('recordDownload').hidden = false;
        $('recordStatus').textContent = '已停止。请下载并回放，确认确实录到了英文声音。刷新前务必下载。';
        stopRecording();
        if (!$('recordDialog').open) $('recordDialog').showModal();
      };
      recorder.onerror = () => { stopRecording(); $('recordStatus').textContent = '录制出现错误。请检查保存文件，必要时使用系统录屏。'; };
      stream.getVideoTracks()[0].onended = stopRecording;
      recorder.start(1000);
      $('stopRecording').disabled = false;
      $('recordButton').textContent = '● 录制中'; $('recordButton').classList.add('recording');
      $('recordDialog').close();
      toast(stream.getAudioTracks().length ? '录制中。点击右上角录制按钮停止；请勿打开密钥面板。' : '正在录制，但没有音轨！停止后重新选择带音频的标签页。');
    } catch (_) { stopRecording(); $('recordStatus').textContent = '录屏未开始或共享被取消。'; }
  };
  $('stopRecording').onclick = stopRecording;
  $('openReplay').onclick = () => { pauseAll(); $('helpDialog').close(); $('replayDialog').showModal(); };
  $('replayInput').onchange = event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.type && !file.type.startsWith('video/')) { toast('请选择视频文件。'); return; }
    $('replayVideo').pause();
    if (state.replayUrl) URL.revokeObjectURL(state.replayUrl);
    state.replayUrl = URL.createObjectURL(file); $('replayVideo').src = state.replayUrl;
  };
  $('replayDialog').addEventListener('close', () => $('replayVideo').pause());
  addEventListener('pagehide', () => {
    state.speechCancel?.(); state.recognition?.abort();
    void state.adapter?.destroy(); state.stream?.getTracks().forEach(t => t.stop());
    if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
    if (state.replayUrl) URL.revokeObjectURL(state.replayUrl);
  });
  player.emit();
  placeholder();
})();
