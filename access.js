/* A classroom convenience gate, not server-side access control.
 * The repository and static assets are public. Never use this to protect secrets.
 * Only a password digest is stored; Xingyun credentials are unrelated.
 */
(() => {
  'use strict';
  const EXPECTED_HASH = '2b12975ce25c98c0fb5402a3310d337d2674fc4ce6ffc111f65df74843d5edc2';
  const STORAGE_KEY = 'academic-english-classroom-access-v1';
  const authorized = () => {
    try { return sessionStorage.getItem(STORAGE_KEY) === EXPECTED_HASH; }
    catch { return false; }
  };
  if (document.currentScript?.hasAttribute('data-classroom-guard')) {
    if (authorized()) document.getElementById('classroom-access-style')?.remove();
    else location.replace('index.html');
    return;
  }
  if (authorized()) {
    location.replace('classroom.html');
    return;
  }
  const form = document.getElementById('accessForm');
  const input = document.getElementById('accessPassword');
  const message = document.getElementById('accessMessage');
  const submit = document.getElementById('accessSubmit');
  if (!form || !input || !message || !submit) return;
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    message.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || !input.value) return;
    submit.disabled = true;
    message.textContent = '正在验证…';
    try {
      if (!globalThis.crypto?.subtle) throw new Error('CRYPTO_UNAVAILABLE');
      const bytes = new TextEncoder().encode(input.value);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
      if (hash !== EXPECTED_HASH) {
        input.setAttribute('aria-invalid', 'true');
        message.textContent = '密码不正确，请重新输入。';
        input.focus();
        input.select();
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, EXPECTED_HASH);
      if (!authorized()) throw new Error('STORAGE_UNAVAILABLE');
      input.value = '';
      location.replace('classroom.html');
    } catch (error) {
      message.textContent = error?.message === 'CRYPTO_UNAVAILABLE'
        ? '请通过 HTTPS 网站或 localhost 打开，并使用新版 Edge 或 Chrome。'
        : '浏览器未允许会话存储，请允许该网站存储数据后重试。';
    } finally {
      submit.disabled = false;
    }
  });
})();
