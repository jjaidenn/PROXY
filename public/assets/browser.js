(() => {
  const form = document.getElementById('address-form');
  const input = document.getElementById('address');
  const home = document.getElementById('home-screen');
  const stage = document.getElementById('frame-stage');
  const strip = document.getElementById('tab-strip');
  const status = document.getElementById('status');
  const hint = document.getElementById('frame-hint');
  const tabs = [];
  let activeId = null;
  let nextId = 1;
  let hintTimer = null;

  function activeTab() { return tabs.find(tab => tab.id === activeId) || null; }
  function setStatus(value) { status.textContent = value; }
  function updateControls() {
    const tab = activeTab();
    document.getElementById('back').disabled = !tab || tab.index <= 0;
    document.getElementById('forward').disabled = !tab || tab.index >= tab.history.length - 1;
    document.getElementById('reload').disabled = !tab || !tab.url;
  }
  function renderTabs() {
    strip.querySelectorAll('.tab').forEach(node => node.remove());
    tabs.forEach(tab => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab' + (tab.id === activeId ? ' active' : '');
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(tab.id === activeId));
      button.title = tab.url || 'New tab';
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = tab.url ? (() => { try { return new URL(tab.url).hostname; } catch { return 'Page'; } })() : 'New tab';
      const close = document.createElement('span');
      close.className = 'tab-close';
      close.setAttribute('aria-label', 'Close tab');
      close.textContent = '×';
      button.append(label, close);
      button.addEventListener('click', event => {
        if (event.target === close) { closeTab(tab.id); return; }
        activateTab(tab.id);
      });
      strip.insertBefore(button, document.getElementById('new-tab'));
    });
  }
  function activateTab(id) {
    const tab = tabs.find(item => item.id === id);
    if (!tab) return;
    activeId = id;
    tabs.forEach(item => { item.frame.hidden = item.id !== id; });
    home.classList.toggle('hidden', !!tab.url);
    input.value = tab.url || '';
    hint.classList.remove('show');
    clearTimeout(hintTimer);
    setStatus(tab.url ? 'PAGE OPEN' : 'READY');
    renderTabs();
    updateControls();
  }
  function createTab() {
    const id = nextId++;
    const frame = document.createElement('iframe');
    frame.className = 'browser-frame';
    frame.title = 'PROXY tab ' + id;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.hidden = true;
    frame.addEventListener('load', () => {
      const tab = tabs.find(item => item.id === id);
      if (!tab || !tab.url || activeId !== id) return;
      setStatus('PAGE RESPONSE RECEIVED');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => {
        if (activeId === id && tab.url) {
          hint.classList.add('show');
          setStatus('EMBED STATUS UNKNOWN');
        }
      }, 4500);
    });
    stage.appendChild(frame);
    tabs.push({ id, frame, history: [], index: -1, url: '' });
    activateTab(id);
  }
  function closeTab(id) {
    const index = tabs.findIndex(tab => tab.id === id);
    if (index < 0) return;
    tabs[index].frame.remove();
    tabs.splice(index, 1);
    if (!tabs.length) { createTab(); return; }
    if (activeId === id) activateTab(tabs[Math.max(0, index - 1)].id);
    else { renderTabs(); updateControls(); }
  }
  function normalizeAddress(raw) {
    const value = raw.trim();
    if (!value) return null;
    const appMatch = value.match(/^proxy:\/\/([a-z0-9-]+)\/?$/i);
    if (appMatch) {
      const slug = appMatch[1].toLowerCase();
      return new URL(slug === 'apps' ? './apps/' : './apps/' + slug + '/', location.href).href;
    }
    if (value.startsWith('/apps/')) return new URL(value, location.origin).href;
    if (/^https?:\/\//i.test(value)) return value;
    if (!/\s/.test(value) && value.includes('.')) return 'https://' + value;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(value);
  }
  function navigate(value, addHistory = true) {
    const tab = activeTab();
    if (!tab) return;
    let url;
    try {
      url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    } catch {
      setStatus('INVALID ADDRESS');
      return;
    }
    const finalUrl = url.href;
    if (addHistory) {
      tab.history = tab.history.slice(0, tab.index + 1);
      tab.history.push(finalUrl);
      tab.index = tab.history.length - 1;
    }
    tab.url = finalUrl;
    input.value = finalUrl;
    home.classList.add('hidden');
    hint.classList.remove('show');
    clearTimeout(hintTimer);
    setStatus('LOADING');
    tab.frame.src = finalUrl;
    renderTabs();
    updateControls();
    hintTimer = setTimeout(() => {
      if (activeId === tab.id && tab.url) {
        hint.classList.add('show');
        setStatus('EMBED STATUS UNKNOWN');
      }
    }, 6500);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = normalizeAddress(input.value);
    if (url) navigate(url);
  });
  document.querySelectorAll('[data-url]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      navigate(link.dataset.url);
    });
  });
  document.getElementById('new-tab').addEventListener('click', createTab);
  document.getElementById('home').addEventListener('click', () => {
    const tab = activeTab();
    if (!tab) return;
    tab.url = '';
    tab.history = [];
    tab.index = -1;
    tab.frame.removeAttribute('src');
    input.value = '';
    home.classList.remove('hidden');
    hint.classList.remove('show');
    clearTimeout(hintTimer);
    setStatus('READY');
    renderTabs();
    updateControls();
  });
  document.getElementById('back').addEventListener('click', () => {
    const tab = activeTab();
    if (tab && tab.index > 0) { tab.index--; navigate(tab.history[tab.index], false); }
  });
  document.getElementById('forward').addEventListener('click', () => {
    const tab = activeTab();
    if (tab && tab.index < tab.history.length - 1) { tab.index++; navigate(tab.history[tab.index], false); }
  });
  document.getElementById('reload').addEventListener('click', () => {
    const tab = activeTab();
    if (tab && tab.url) { setStatus('RELOADING'); tab.frame.src = tab.url; }
  });
  createTab();
})();