/*
 * Xmov / Xingyun live adapter. No SDK is downloaded until connect() is called
 * by a user gesture. The local learning site and its scripted practice do not
 * depend on this file making any network requests.
 *
 * API verified against official documentation on 2026-10-31:
 * https://www.xingyun3d.com/developers/67-543
 * https://www.xingyun3d.com/developers/68-547
 * https://www.xingyun3d.com/developers/69-562
 *
 * onStatus(status, detail): pending | connected | error | destroyed
 * onText(fullText, detail): REPLACE the UI text; this is cumulative, not a delta.
 * onError(error): sanitized Error with optional code; no raw credentials/cause.
 *
 * appSecret is a browser-side credential, visible in developer tools while in
 * use. Memory-only is not secret storage. Never bundle credentials, record the
 * credential form, or pass a high-privilege LLM/provider key to this adapter.
 */
(function (global) {
  "use strict";

  const SDK_URL = "https://media.xingyun3d.com/xingyun3d/general/litesdk/xmovAvatar_e2e@latest.js";
  const GATEWAY = "https://nebula-agent.xingyun3d.com/user/v1/ttsa_v2/session";
  const diagnostics = global.XmovDiagnostics;
  let sdkLoadPromise = null;

  function invoke(callback) {
    if (typeof callback !== "function") return;
    const args = Array.prototype.slice.call(arguments, 1);
    try {
      const result = callback.apply(null, args);
      if (result && typeof result.catch === "function") result.catch(function () {});
    } catch (_) {
      // A consumer callback must not break the vendor SDK's event handling.
    }
  }

  function loadSDK() {
    if (typeof global.XingyunAvatarAgent === "function") return Promise.resolve();
    if (sdkLoadPromise) return sdkLoadPromise;
    sdkLoadPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.dataset.xmovTutorSdk = "true";
      let settled = false;
      const timer = global.setTimeout(function () {
        finish(new Error("Xingyun SDK download timed out. Check the network or use offline practice."));
      }, 30000);
      function finish(error) {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          reject(error);
        } else resolve();
      }
      script.onload = function () {
        finish(typeof global.XingyunAvatarAgent === "function" ? null :
          new Error("The official SDK loaded without XingyunAvatarAgent. Its API may have changed."));
      };
      script.onerror = function () {
        finish(new Error("Cannot load the official Xingyun SDK. Check network access and content restrictions."));
      };
      document.head.appendChild(script);
    }).catch(function (error) {
      sdkLoadPromise = null;
      throw error;
    });
    return sdkLoadPromise;
  }

  class XmovTutorAdapter {
    constructor(options) {
      options = options || {};
      this.containerId = options.containerId;
      this.onStatus = options.onStatus;
      this.onText = options.onText;
      this.onError = options.onError;
      this.onSpeech = options.onSpeech;
      this.onDiagnostic = options.onDiagnostic;
      this.status = "destroyed";
      this.busy = false;
      this._agent = null;
      this._generation = 0;
      this._connectPromise = null;
      this._initResolved = false;
      this._text = "";
      this._acceptText = false;
      this._answerTurn = null;
      this._speechJob = null;
      this._retiredSpeechIds = new Set();
      this._redactions = [];
      this._connectionError = null;
      this._onPageHide = () => { void this.destroy(); };
    }

    _status(status, detail) {
      this.status = status;
      if (status === "pending" || status === "error") {
        this._answerTurn = null;
        this._acceptText = false;
        this.busy = false;
        this._finishSpeech("failed", new Error("The live session is not ready. Reconnect before continuing the lecture."));
      }
      invoke(this.onStatus, status, detail || {});
    }

    _error(error, stage, changeStatus) {
      const safe = diagnostics.safeError(error, stage, this._redactions);
      // Retain a concrete callback error when init() later rejects with only
      // AGENT_INIT_FAILED or a generic timeout. No raw causes are retained.
      const rank = diagnostics.errorRank;
      if (!this._initResolved && (!this._connectionError || rank(safe) > rank(this._connectionError))) this._connectionError = safe;
      if (changeStatus !== false) this._status("error", { stage: safe.stage, message: safe.message, code: safe.code, domain: safe.domain });
      invoke(this.onError, safe);
      return safe;
    }

    static async testNetwork(onResult) {
      const report = (code, message) => invoke(onResult, {stage: 'selfcheck', code, message});
      // Do not HEAD/GET the authenticated session endpoint: its expected 401
      // can become a fetch network error under CORS/opaque-response policies.
      // Only load the public SDK. No instance, session, POST or microphone.
      await loadSDK().then(() => report('SDK_OK', '官方 SDK 已载入（可能使用浏览器缓存；尚未创建会话）。'),
        error => report('SDK_FAILED', diagnostics.safeError(error, 'sdk').message));
      report('SESSION_NOT_TESTED', '自检不调用会话接口；鉴权、额度、WebSocket 和声音仍需点击「连接星云」验证。');
    }

    _finishSpeech(result, error) {
      const job = this._speechJob;
      if (!job) return;
      this._speechJob = null;
      global.clearTimeout(job.timer);
      if (job.id != null) {
        this._retiredSpeechIds.add(String(job.id));
        if (this._retiredSpeechIds.size > 200) this._retiredSpeechIds.delete(this._retiredSpeechIds.values().next().value);
      }
      this.busy = false;
      if (error) job.reject(error); else job.resolve(result);
    }

    _speechEvent(state, detail) {
      detail = detail || {};
      const id = detail.clientSpeakId;
      if (id != null && this._retiredSpeechIds.has(String(id))) return;
      const job = this._speechJob;
      if (job && state === "speak_start") {
        if (job.id != null && id != null && String(job.id) !== String(id)) return;
        job.started = true;
        if (id != null) job.id = id;
      }
      invoke(this.onSpeech, state, detail);
      // Two callback layers can report the same completion. Only settle the
      // current started utterance, and ignore retired ids after interruption.
      if (job && (id == null || job.id == null || String(id) === String(job.id))) {
        if (state === "speak_end" && job.started) this._finishSpeech("completed");
        else if (state === "speak_error") this._finishSpeech("failed", new Error("Xmov could not finish this lecture sentence."));
      }
    }

    connect(credentials) {
      if (this._connectPromise) return this._connectPromise;
      if (this.status === "connected") return Promise.resolve(this);
      try {
        if (global.location.protocol === "file:") {
          throw new Error("Live Xmov is unavailable in the offline file. Use HTTPS or the localhost launch script; offline exercises still work.");
        }
        const localHost = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/.test(global.location.hostname);
        if (global.location.protocol !== "https:" && !(global.location.protocol === "http:" && localHost)) {
          throw new Error("Live Xmov requires HTTPS or localhost, not an ordinary HTTP/LAN address.");
        }
        if (global.navigator.onLine === false) throw new Error("You are offline. No SDK was loaded; use offline practice or a recorded replay.");
        if (global.navigator.userActivation && !global.navigator.userActivation.isActive) {
          throw new Error("Click Connect to explicitly start the live avatar. It does not connect automatically.");
        }
        if (!credentials || typeof credentials.appId !== "string" || !credentials.appId.trim() ||
            typeof credentials.appSecret !== "string" || !credentials.appSecret.trim()) {
          throw new Error("Enter your own Xingyun App ID and App Secret. This site contains no demo credentials.");
        }
        const id = String(this.containerId || "").replace(/^#/, "");
        const container = document.getElementById(id);
        if (!container) throw new Error("The live-avatar container could not be found.");
        const bounds = container.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) throw new Error("Show the live-avatar panel before connecting; its container needs a visible width and height.");
        const generation = ++this._generation;
        this._redactions = [credentials.appId.trim(), credentials.appSecret.trim()];
        this._initResolved = false;
        this._connectionError = null;
        this._status("pending", { stage: "sdk", message: "Loading the official live SDK…" });
        this._connectPromise = this._connect(container, this._redactions[0], this._redactions[1], generation)
          .finally(() => {
            if (generation === this._generation) this._connectPromise = null;
          });
        return this._connectPromise;
      } catch (error) {
        return Promise.reject(this._error(error, "preflight"));
      }
    }

    async _connect(container, appId, appSecret, generation) {
      let agent = null;
      let timeout = null;
      let stage = 'sdk';
      const active = () => generation === this._generation;
      try {
        // Clean up a previous failed session before allocating a new one.
        if (this._agent) {
          const old = this._agent;
          this._agent = null;
          await old.destroy("retry");
        }
        await loadSDK();
        if (!active()) return this;
        stage = 'initializing';
        this._status("pending", { stage: "initializing", message: "Connecting to Xingyun; not ready yet…" });
        agent = new global.XingyunAvatarAgent({
          container: container,
          appId: appId,
          appSecret: appSecret,
          gatewayServer: GATEWAY,
          enableDebugger: false,
          onMessage: (error) => {
            if (active()) this._error(error, "render-or-session");
          },
          onRenderChange: (renderState) => {
            if (active()) invoke(this.onDiagnostic, {stage: 'rendering', renderState: diagnostics.clean(renderState, this._redactions, 40)});
          },
          agentCallbacks: {
            onSocketStateChange: (socketState) => {
              if (active()) invoke(this.onDiagnostic, {stage: 'socket', socketState: diagnostics.clean(socketState, this._redactions, 40)});
            },
            onAgentStateChange: (state) => {
              if (!active()) return;
              if (state === "running" && this._initResolved) {
                this._status("connected", { agentState: state, message: "Live Xmov connected." });
              } else if (state === "initializing" || state === "ready" || state === "reconnecting") {
                if (state === "reconnecting") {
                  // A lost request is not replayed by the SDK after recovery.
                  // Release the local turn, and ignore its delayed text chunks.
                  this.busy = false;
                  this._acceptText = false;
                }
                this._status("pending", { stage: state === "reconnecting" ? 'reconnecting' : 'initializing', agentState: state, message: state === "reconnecting" ? "Reconnecting; questions are paused…" : "Initializing live avatar…" });
              } else if (state === "failed" || state === "stopped") {
                this.busy = false;
                this._status("error", { agentState: state, message: "Live avatar is unavailable. Reconnect or switch to offline practice." });
              } else if (state === "destroyed") {
                this.busy = false;
                this._status("destroyed", { agentState: state });
              }
            },
            onLLMResponse: (response) => {
              if (!active() || !this._acceptText || !response) return;
              if (response.event === "chunk") {
                if (this._answerTurn) this._answerTurn.generated = true;
                if (response.isFirst) this._text = "";
                this._text += typeof response.text === "string" ? response.text : "";
                invoke(this.onText, this._text, { event: "chunk", isFirst: !!response.isFirst, done: false, source: "xmov-live" });
              } else if (response.event === "done") {
                // Official docs append only chunk text; done.text may duplicate it.
                invoke(this.onText, this._text, { event: "done", done: true, source: "xmov-live" });
              }
            },
            onConversationChange: (event) => {
              if (!active() || !event) return;
              if (event.state === "speaking" && this._speechJob) this._speechJob.started = true;
              // Prefer identified speak_end when available. Generic completion
              // has no request id and can arrive after an interrupted sentence.
              if (event.state === "completed" && this._speechJob?.started && this._speechJob.id == null) this._finishSpeech("completed");
              if (event.state === "failed") this._finishSpeech("failed", new Error("Xmov reported a failed speech turn."));
              const turn = this._answerTurn;
              if (turn) {
                if (event.state === "asking") turn.started = true;
                if (event.state === "speaking" && (turn.started || turn.generated)) turn.speaking = true;
                if (event.state === "completed" && !turn.speaking) return;
                if (event.state === "completed" || event.state === "failed") {
                  this._answerTurn = null;
                  this._acceptText = false;
                  this.busy = false;
                }
              } else if (event.state === "completed" && this._speechJob) return;
              // ask() resolving is NOT a signal that audio has finished.
              invoke(this.onStatus, this.status, { conversationState: event.state, busy: this.busy });
            },
            onSpeakStateChange: (event) => {
              if (!active() || !event) return;
              this._speechEvent(event.state, { source: "xmov-live", clientSpeakId: event.clientSpeakId });
            },
            onError: (error) => {
              if (!active()) return;
              if (error && error.code === "E2E_RECONNECTING") {
                this.busy = false;
                this._acceptText = false;
                this._status("pending", { stage: "reconnecting", message: "The SDK is reconnecting. Questions are paused." });
              } else {
                this.busy = false;
                this._error(error, "agent");
              }
            }
          },
          onSpeakStateChange: (state, clientSpeakId) => {
            if (active()) this._speechEvent(state, { source: "xmov-live", clientSpeakId: clientSpeakId });
          },
          onVoiceStateChange: (state, duration, clientSpeakId) => {
            if (active()) this._speechEvent(state, { source: "xmov-live", duration: duration, clientSpeakId: clientSpeakId });
          }
        });
        this._agent = agent;
        global.addEventListener("pagehide", this._onPageHide);
        const initTimeout = new Promise(function (_, reject) {
          timeout = global.setTimeout(function () { reject(new Error("Xingyun initialization timed out. Check app permissions, quota, network and browser graphics.")); }, 90000);
        });
        await Promise.race([agent.init({
          onDownloadProgress: (progress) => {
            if (active() && !this._initResolved && this.status !== "error") {
              const percent = Math.max(0, Math.min(100, Number(progress) || 0));
              stage = 'resources';
              this._status("pending", { stage: "resources", progress: percent, message: "Loading live resources: " + Math.round(percent) + "%" });
            }
          }
        }), initTimeout]);
        if (!active()) {
          await agent.destroy("cancelled");
          return this;
        }
        // 100% download, script.onload and the early 'ready' state are not enough.
        // Official init() resolves only once running; check that state explicitly.
        if (typeof agent.getAgentState !== "function" || agent.getAgentState() !== "running") {
          throw new Error("The SDK initialized without reaching running state. Live interaction has not been verified.");
        }
        this._initResolved = true;
        this._status("connected", { agentState: "running", message: "Live Xmov connected." });
        return this;
      } catch (error) {
        if (!active()) return this;
        const rejected = diagnostics.safeError(error, stage, this._redactions);
        const previous = this._connectionError;
        const chosen = previous && diagnostics.errorRank(previous) >= diagnostics.errorRank(rejected) ? previous : rejected;
        const safe = this._error(chosen, chosen.stage);
        if (agent) {
          // Suppress callbacks from disposal; they must not erase the error state.
          this._generation++;
          try { await agent.destroy("init_failed"); } catch (_) {}
          if (this._agent === agent) this._agent = null;
        }
        this._connectPromise = null;
        this._redactions = [];
        global.removeEventListener("pagehide", this._onPageHide);
        throw safe;
      } finally {
        global.clearTimeout(timeout);
        appId = "";
        appSecret = "";
      }
    }

    async ask(text) {
      if (!this._agent || this.status !== "connected" || this._agent.getAgentState() !== "running") {
        throw this._error(new Error("The live avatar is not ready. Connect successfully before asking."), "ask", false);
      }
      if (typeof text !== "string" || !text.trim()) throw this._error(new Error("Type a question first."), "ask", false);
      if (this.busy) throw this._error(new Error("Wait for the current answer or click Interrupt before asking again."), "ask", false);
      this._text = "";
      this._acceptText = true;
      this._answerTurn = { started: false, generated: false, speaking: false };
      this.busy = true;
      try {
        await this._agent.ask(text.trim());
        // No scripted reply or fallback answer is emitted from the live adapter.
      } catch (error) {
        this.busy = false;
        this._acceptText = false;
        this._answerTurn = null;
        throw this._error(error, "ask");
      }
    }

    async speak(text) {
      if (!this._agent || this.status !== "connected" || this._agent.getAgentState() !== "running") {
        throw this._error(new Error("The live avatar is not ready. Connect successfully before speaking."), "speak", false);
      }
      if (typeof text !== "string" || !text.trim()) throw this._error(new Error("The lecture sentence is empty."), "speak", false);
      if (this.busy) throw this._error(new Error("Interrupt or finish the current turn before speaking."), "speak", false);
      this._acceptText = false;
      this._answerTurn = null;
      this.busy = true;
      return new Promise((resolve, reject) => {
        const job = { resolve, reject, started: false, id: null, timer: null };
        this._speechJob = job;
        job.timer = global.setTimeout(() => {
          if (this._speechJob !== job) return;
          try { this._agent?.interrupt("lecture_timeout"); } catch (_) {}
          this._finishSpeech("timeout", new Error("No speech completion signal. The lecture is paused; it did not auto-advance."));
        }, 75000);
        try { this._agent.speak(text.trim(), true, true); }
        catch (error) { this._finishSpeech("failed", this._error(error, "speak")); }
      });
    }

    interrupt() {
      if (!this._agent || this.status !== "connected") return false;
      try {
        this._agent.interrupt("speak");
        this.busy = false;
        this._acceptText = false;
        this._answerTurn = null;
        this._finishSpeech("interrupted");
        invoke(this.onSpeech, "interrupted", { source: "xmov-live" });
        invoke(this.onStatus, this.status, { conversationState: "interrupted", busy: false });
        return true;
      } catch (error) {
        this._error(error, "interrupt");
        return false;
      }
    }

    async destroy() {
      this._generation++;
      const agent = this._agent;
      this._agent = null;
      this._connectPromise = null;
      this._initResolved = false;
      this._acceptText = false;
      this._answerTurn = null;
      this._finishSpeech("destroyed");
      this._text = "";
      this.busy = false;
      global.removeEventListener("pagehide", this._onPageHide);
      this._status("destroyed", { message: "Live connection closed." });
      try {
        if (agent) await agent.destroy("user");
      } catch (error) {
        this._error(error, "destroy", false);
      } finally {
        this._redactions = [];
      }
    }
  }

  global.XmovTutorAdapter = XmovTutorAdapter;
})(window);
