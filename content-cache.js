(function () {
  'use strict';
  const prefix = 'hutao-public-cache-';
  const maxAge = 14 * 24 * 60 * 60 * 1000;
  function read(name) {
    try {
      const entry = JSON.parse(localStorage.getItem(prefix + name));
      if (!entry || !Array.isArray(entry.items) || Date.now() - entry.savedAt > maxAge) return null;
      return entry;
    } catch { return null; }
  }
  function write(name, items) {
    try {
      const value = JSON.stringify({ savedAt: Date.now(), items });
      if (value.length < 1500000) localStorage.setItem(prefix + name, value);
    } catch { /* Browsing remains available when storage is disabled or full. */ }
  }
  function notice(container, retry, savedAt) {
    container.parentElement.querySelector(`[data-cache-for="${container.id}"]`)?.remove();
    const node = document.createElement('div');
    node.className = 'content-cache-notice';
    node.dataset.cacheFor = container.id;
    node.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.textContent = `连接暂时受阻，显示 ${new Date(savedAt).toLocaleDateString('zh-CN')} 保存的内容。`;
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = '重新读取';
    button.onclick = () => { node.remove(); retry(); };
    node.append(text, button); container.before(node);
  }
  function clearNotice(container) {
    container.parentElement.querySelector(`[data-cache-for="${container.id}"]`)?.remove();
  }
  window.ContentCache = { read, write, notice, clearNotice };
}());
