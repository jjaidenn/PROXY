(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const form = $('address-form');
  const input = $('address');
  const home = $('home-screen');
  const stage = $('frame-stage');
  const strip = $('tab-strip');
  const status = $('status');
  const hint = $('frame-hint');
  const tabs = [];
  let activeId = null;
  let nextId = 1;
  let hintTimer = null;

  const activeTab = () => tabs.find(tab => tab.id === activeId) || null;
  const setStatus = value => { status.textContent = value; };
  const clearTimers = tab => {
    if (!tab) return;
    clearTimeout(tab.loadTimer);
    clearTimeout(tab.hintTimer);
    tab.loadTimer = null;
    tab.hintTimer = null;
  };
  const showHint = (message, url = '') => {
    hint.replaceChildren();
    const text = document.createElement('span');
    text.textContent = message;
    hint.appendChild(text);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'hint-link';
      link.textContent = 'Open site separately';
      hint.appendChild(link);
    }
    hint.classList.add('show');
  };
  const hideHint = () => hint.classList.remove('show');

  function updateControls() {
    const tab = activeTab();
    $('back').disabled = !tab || tab.index <= 0;
    $('forward').disabled = !tab || tab.index >= tab.history.length - 1;
    $('reload').disabled = !tab || !tab.url;
    $('home').disabled = !tab;
  }

  function renderTabs() {
    strip.querySelectorAll('.tab-item').forEach(node => node.remove());
    tabs.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-item';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab' + (tab.id === activeId ? ' active' : '');
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(tab.id === activeId));
      button.title = tab.url || 'New tab';
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = tab.url ? (() => {
        try { return new URL(tab.url).hostname; } catch { return 'Page'; }
      })() : 'New tab';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.setAttribute('aria-label', 'Close ' + (tab.url || 'new') + ' tab');
      close.title = 'Close tab';
      close.textContent = '×';
      close.addEventListener('click', () => closeTab(tab.id));
      button.append(label);
      button.addEventListener('click', () => activateTab(tab.id));
      item.append(button, close);
      strip.insertBefore(item, $('new-tab'));
    });
  }

  function activateTab(id) {
    const tab = tabs.find(item => item.id === id);
    if (!tab) return;
    activeId = id;
    tabs.forEach(item => { item.frame.hidden = item.id !== id; });
    home.classList.toggle('hidden', !!tab.url);
    input.value = tab.url || '';
    hideHint();
    clearTimeout(hintTimer);
    setStatus(tab.loading ? 'LOADING' : tab.url ? 'PAGE OPEN · EMBED STATUS UNKNOWN' : 'READY');
    renderTabs();
    updateControls();
  }

  function createTab() {
    const id = nextId++;
    const frame = document.createElement('iframe');
    frame.className = 'browser-frame';
    frame.title = 'PROXY tab ' + id;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.loading = 'eager';
    frame.allow = 'fullscreen; autoplay; clipboard-read; clipboard-write';
    frame.hidden = true;
    const tab = { id, frame, history: [], index: -1, url: '', loading: false, loadTimer: null, hintTimer: null };

    frame.addEventListener('load', () => {
      tab.loading = false;
      clearTimeout(tab.loadTimer);
      tab.loadTimer = null;
      if (!tab.url) {
        if (activeId === id) setStatus('READY');
        return;
      }
      if (activeId !== id) return;
      setStatus('RESPONSE RECEIVED · PAGE VISIBILITY UNVERIFIED');
      hideHint();

      // Same-origin pages can safely report their final URL and title.
      // Cross-origin pages remain isolated by the browser's same-origin policy.
      try {
        const finalUrl = frame.contentWindow.location.href;
        if (finalUrl && finalUrl !== 'about:blank' && finalUrl !== tab.url) {
          tab.url = finalUrl;
          input.value = finalUrl;
          if (tab.index >= 0) tab.history[tab.index] = finalUrl;
          renderTabs();
        }
        const pageTitle = frame.contentDocument.title;
        if (pageTitle) frame.title = pageTitle + ' — PROXY tab ' + id;
      } catch (_) {
        // Expected for cross-origin pages.
      }

      tab.hintTimer = setTimeout(() => {
        if (activeId === id && tab.url) {
          showHint('The site responded, but may not allow embedded viewing. This is a website limitation, not a loading fix PROXY can force.', tab.url);
          setStatus('EMBED STATUS UNKNOWN');
        }
      }, 5000);
    });

    stage.appendChild(frame);
    tabs.push(tab);
    activateTab(id);
  }

  function closeTab(id) {
    const index = tabs.findIndex(tab => tab.id === id);
    if (index < 0) return;
    const wasActive = activeId === id;
    clearTimers(tabs[index]);
    tabs[index].frame.remove();
    tabs.splice(index, 1);
    if (!tabs.length) createTab();
    else if (wasActive) activateTab(tabs[Math.max(0, index - 1)].id);
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
      url = new URL(value, location.href);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('Unsupported address');
    } catch (_) {
      setStatus('INVALID ADDRESS');
      showHint('Enter a valid website address or search phrase.');
      return;
    }

    const finalUrl = url.href;
    clearTimers(tab);
    if (addHistory) {
      tab.history = tab.history.slice(0, tab.index + 1);
      tab.history.push(finalUrl);
      tab.index = tab.history.length - 1;
    }
    tab.url = finalUrl;
    tab.loading = true;
    input.value = finalUrl;
    home.classList.add('hidden');
    hideHint();
    setStatus('LOADING');
    tab.frame.src = finalUrl;
    renderTabs();
    updateControls();

    tab.loadTimer = setTimeout(() => {
      tab.loading = false;
      if (activeId === tab.id) {
        setStatus('SLOW OR BLOCKED');
        showHint('No page response arrived within 30 seconds. The site may be offline, slow, or incompatible with embedded viewing.', tab.url);
      }
    }, 30000);
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

  $('new-tab').addEventListener('click', createTab);
  $('home').addEventListener('click', () => {
    const tab = activeTab();
    if (!tab) return;
    clearTimers(tab);
    tab.url = '';
    tab.loading = false;
    tab.history = [];
    tab.index = -1;
    tab.frame.src = 'about:blank';
    input.value = '';
    home.classList.remove('hidden');
    hideHint();
    setStatus('READY');
    renderTabs();
    updateControls();
  });

  $('back').addEventListener('click', () => {
    const tab = activeTab();
    if (tab && tab.index > 0) {
      tab.index--;
      navigate(tab.history[tab.index], false);
    }
  });
  $('forward').addEventListener('click', () => {
    const tab = activeTab();
    if (tab && tab.index < tab.history.length - 1) {
      tab.index++;
      navigate(tab.history[tab.index], false);
    }
  });
  $('reload').addEventListener('click', () => {
    const tab = activeTab();
    if (!tab || !tab.url) return;
    clearTimers(tab);
    tab.loading = true;
    hideHint();
    setStatus('RELOADING');
    tab.frame.src = tab.url;
    tab.loadTimer = setTimeout(() => {
      tab.loading = false;
      if (activeId === tab.id) {
        setStatus('SLOW OR BLOCKED');
        showHint('The reload did not respond within 30 seconds. The site may be offline or incompatible with embedded viewing.', tab.url);
      }
    }, 30000);
  });

  // Desktop keyboard shortcuts; normal typing in the address field is untouched.
  document.addEventListener('keydown', event => {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      input.focus();
      input.select();
    } else if (modifier && event.key.toLowerCase() === 't') {
      event.preventDefault();
      createTab();
    } else if (modifier && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      if (tabs.length > 1) closeTab(activeId);
    } else if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      $('back').click();
    } else if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault();
      $('forward').click();
    }
  });

  createTab();
})();