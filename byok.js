/* ============================================================
   BYOK Kit — shared Venice "bring your own key" component
   Usage:
     <script src="byok.js"></script>
     In your API calls:  const key = window.getVeniceKey();
                         if (!key) { window.openKeyModal(); return; }
     Non-API features keep working; key is optional until needed.
   ============================================================ */
(function () {
  var LS_KEY = 'venice_user_api_key';
  var REFERRAL = 'https://venice.ai/chat?ref=yN8qqI';

  window.getVeniceKey = function () {
    try { return localStorage.getItem(LS_KEY) || ''; } catch (e) { return ''; }
  };
  window.setVeniceKey = function (k) {
    try { localStorage.setItem(LS_KEY, k.trim()); } catch (e) {}
    refreshBadge();
  };
  window.clearVeniceKey = function () {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    refreshBadge();
  };
  /* open modal; optional reason text shown when an action needs a key */
  window.openKeyModal = function (reason) {
    var m = document.getElementById('byok-modal');
    if (!m) return;
    var msg = document.getElementById('byok-reason');
    msg.textContent = reason || '';
    msg.style.display = reason ? 'block' : 'none';
    var inp = document.getElementById('byok-input');
    inp.value = window.getVeniceKey();
    m.style.display = 'flex';
    setTimeout(function(){ inp.focus(); }, 50);
  };
  window.closeKeyModal = function () {
    document.getElementById('byok-modal').style.display = 'none';
  };

  function refreshBadge() {
    var b = document.getElementById('byok-dot');
    if (b) {
      var has = !!window.getVeniceKey();
      b.style.background = has ? '#00ff9c' : '#666';
      b.title = has ? 'Venice key set' : 'No Venice key set';
    }
  }

  function inject() {
    var css = document.createElement('style');
    css.textContent =
      '#byok-gear{position:fixed;top:14px;right:14px;z-index:99990;width:40px;height:40px;border-radius:50%;' +
      'background:rgba(10,10,10,.75);border:1px solid rgba(255,255,255,.14);color:#9aa;display:flex;align-items:center;' +
      'justify-content:center;cursor:pointer;font-size:18px;backdrop-filter:blur(6px);transition:.25s}' +
      '#byok-gear:hover{color:#fff;border-color:rgba(0,255,156,.6);transform:rotate(30deg)}' +
      '#byok-dot{position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#666;border:1px solid #000}' +
      '#byok-modal{display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);' +
      'align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace}' +
      '#byok-card{width:min(440px,92vw);background:#101014;border:1px solid rgba(0,255,156,.25);border-radius:14px;padding:26px;color:#eee}' +
      '#byok-card h3{margin:0 0 6px;font-size:16px;letter-spacing:.08em}' +
      '#byok-card p{margin:0 0 14px;font-size:12.5px;color:#888;line-height:1.6}' +
      '#byok-reason{display:none;margin:0 0 14px;font-size:12.5px;color:#ffaa00}' +
      '#byok-input{width:100%;box-sizing:border-box;background:#0a0a0c;border:1px solid #2a2a30;color:#fff;' +
      'font:13px ui-monospace,monospace;padding:11px 12px;border-radius:8px;outline:none}' +
      '#byok-input:focus{border-color:#00ff9c}' +
      '#byok-row{display:flex;gap:10px;margin-top:16px}' +
      '#byok-save{flex:1;background:#00ff9c;color:#000;border:0;font:600 13px ui-monospace,monospace;' +
      'padding:11px;border-radius:8px;cursor:pointer}' +
      '#byok-clear{background:transparent;color:#888;border:1px solid #2a2a30;font:12px ui-monospace,monospace;' +
      'padding:11px 14px;border-radius:8px;cursor:pointer}' +
      '#byok-ref{display:block;margin-top:14px;font-size:12px;color:#00e5ff;text-decoration:none}' +
      '#byok-ref:hover{text-decoration:underline}';
    document.head.appendChild(css);

    var gear = document.createElement('div');
    gear.id = 'byok-gear';
    gear.innerHTML = '⚙<span id="byok-dot"></span>';
    gear.onclick = function(){ window.openKeyModal(); };
    document.body.appendChild(gear);

    var m = document.createElement('div');
    m.id = 'byok-modal';
    m.innerHTML =
      '<div id="byok-card">' +
        '<h3>🔑 Your Venice API key</h3>' +
        '<p>Stored only in this browser (localStorage). Sent directly from your browser to api.venice.ai — never to this site\'s server.</p>' +
        '<div id="byok-reason"></div>' +
        '<input id="byok-input" type="password" placeholder="paste your key" autocomplete="off" spellcheck="false">' +
        '<div id="byok-row">' +
          '<button id="byok-save">Save key</button>' +
          '<button id="byok-clear">Clear</button>' +
          '<button id="byok-clear" style="margin-left:auto" onclick="document.getElementById(\'byok-modal\').style.display=\'none\'">Close</button>' +
        '</div>' +
        '<a id="byok-ref" href="' + REFERRAL + '" target="_blank" rel="noopener">No key yet? Get one at venice.ai ↗</a>' +
      '</div>';
    document.body.appendChild(m);

    document.getElementById('byok-save').onclick = function () {
      var v = document.getElementById('byok-input').value.trim();
      if (v) { window.setVeniceKey(v); window.closeKeyModal(); }
    };
    document.getElementById('byok-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('byok-save').click();
      if (e.key === 'Escape') window.closeKeyModal();
    });
    m.addEventListener('click', function (e) { if (e.target === m) window.closeKeyModal(); });
    document.getElementById('byok-clear').onclick = function () {
      window.clearVeniceKey(); document.getElementById('byok-input').value = '';
    };
    refreshBadge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
