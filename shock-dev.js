/* SHOCK Male Grooming — "Modalità dev" nel pannello admin.
   Pulsante posizionato subito sopra Logout, con sopra di esso un
   elenco live di chi è in sessione dev in questo momento (pallino
   colorato + nome + orario di ingresso, come le note condivise Apple).
   Il pannello è React: ci agganciamo al pulsante Logout, che è un
   punto di riferimento stabile nel markup, e ci riposizioniamo se
   React ricostruisce quella parte. */
(function () {
  var API = {
    state: '/api/dev/state',
    enter: '/api/dev/enter',
    exit: '/api/dev/exit',
    config: '/api/config',
  };
  var WIDGET_ID = 'shock-dev-widget';
  var POLL_MS = 15000;

  function pwd() {
    try {
      return sessionStorage.getItem('admin_password') || '';
    } catch (_) {
      return '';
    }
  }

  function api(url, method, body) {
    return fetch(url, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pwd() },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    }).then(function (r) {
      return r.json().then(function (j) {
        return { status: r.status, body: j };
      });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Colore stabile per nome: stesso nome, stesso pallino, sempre.
  function colorOf(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return 'hsl(' + (h % 360) + ',68%,58%)';
  }

  function orario(ms) {
    if (!ms) return '';
    try {
      return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  /* ---------- stile ---------- */
  function css() {
    if (document.getElementById('shock-dev-css')) return;
    var st = document.createElement('style');
    st.id = 'shock-dev-css';
    st.textContent =
      '#' + WIDGET_ID + '{padding:0 12px}' +
      '#sd-live{margin-bottom:6px}' +
      '#sd-live:empty{display:none}' +
      '.sd-row{display:flex;align-items:center;gap:8px;padding:5px 12px;font-size:.78rem;' +
      'color:rgba(255,255,255,.55)}' +
      '.sd-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 3px currentColor22}' +
      '.sd-row .sd-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.sd-row .sd-me{color:rgba(255,255,255,.3);font-size:.68rem}' +
      '.sd-row .sd-time{font-size:.68rem;color:rgba(255,255,255,.32);flex-shrink:0}' +
      '.sd-devbtn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;' +
      'border-radius:10px;border:none;cursor:pointer;background:transparent;' +
      'color:rgba(255,255,255,.45);font-size:.85rem;font-weight:500;text-align:left;' +
      'font-family:inherit;transition:background .15s,color .15s}' +
      '.sd-devbtn:hover{background:rgba(255,255,255,.05);color:rgba(255,255,255,.7)}' +
      '.sd-devbtn.sd-active{color:#c9a84c}' +
      '.sd-devbtn .sd-ic{font-size:1rem;width:20px;text-align:center;flex-shrink:0}' +
      /* overlay del pannello modale */
      '.sd-ov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;' +
      'align-items:center;justify-content:center;padding:20px}' +
      '.sd-card{background:#1C1917;border:1px solid rgba(255,255,255,.09);border-radius:18px;' +
      'padding:26px 26px 22px;width:100%;max-width:420px;max-height:88vh;overflow:auto;' +
      'color:#f0ece5;font-family:system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6);' +
      'position:relative}' +
      '.sd-card h2{margin:0 0 4px;font-size:1.15rem;letter-spacing:.02em}' +
      '.sd-card .sd-sub{margin:0 0 20px;font-size:.8rem;color:rgba(240,236,229,.45);line-height:1.5}' +
      '.sd-sec{border-top:1px solid rgba(255,255,255,.08);margin-top:20px;padding-top:18px}' +
      '.sd-sec h3{margin:0 0 12px;font-size:.68rem;text-transform:uppercase;letter-spacing:.12em;' +
      'color:rgba(240,236,229,.42);font-weight:700}' +
      '.sd-card input{width:100%;padding:11px 13px;background:#0f0e0d;color:#fff;font-size:15px;' +
      'border:1px solid rgba(255,255,255,.13);border-radius:10px;outline:none;font-family:inherit;' +
      'margin-bottom:10px}' +
      '.sd-card input:focus{border-color:#c9a84c}' +
      '.sd-btn{width:100%;border:none;border-radius:100px;padding:13px;font-size:.85rem;' +
      'font-weight:800;cursor:pointer;letter-spacing:.04em;font-family:inherit;text-transform:uppercase}' +
      '.sd-go{background:#c9a84c;color:#0a0908}' +
      '.sd-off{background:rgba(255,255,255,.1);color:#f0ece5}' +
      '.sd-btn:disabled{opacity:.55;cursor:default}' +
      '.sd-x{position:absolute;top:14px;right:16px;background:none;border:0;' +
      'color:rgba(240,236,229,.5);font-size:1.5rem;cursor:pointer;line-height:1;padding:4px 8px}' +
      '.sd-badge{display:inline-block;padding:5px 12px;border-radius:100px;font-size:.72rem;' +
      'font-weight:700;letter-spacing:.04em}' +
      '.sd-on{background:rgba(201,168,76,.16);color:#c9a84c}' +
      '.sd-no{background:rgba(255,255,255,.08);color:rgba(240,236,229,.6)}' +
      '.sd-msg{font-size:.8rem;line-height:1.5;padding:10px 12px;border-radius:9px;margin-bottom:12px}' +
      '.sd-err{background:rgba(239,68,68,.13);color:#e0685e}' +
      '.sd-ok{background:rgba(76,175,80,.13);color:#7bbf7b}' +
      '.sd-warn{background:rgba(201,168,76,.12);color:#c9a84c}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------- elenco live sopra il pulsante ---------- */
  var lastSessions = null;

  function renderLive(sessions) {
    var box = document.getElementById('sd-live');
    if (!box) return;
    if (!sessions || !sessions.length) {
      box.innerHTML = '';
      return;
    }
    var h = '';
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var col = colorOf(s.name || '?');
      h += '<div class="sd-row"><span class="sd-dot" style="background:' + col + '"></span>' +
        '<span class="sd-name">' + esc(s.name) + '</span>' +
        (s.me ? '<span class="sd-me">tu</span>' : '') +
        '<span class="sd-time">' + esc(orario(s.since)) + '</span></div>';
    }
    box.innerHTML = h;
  }

  function poll() {
    if (!pwd()) return;
    api(API.state).then(function (r) {
      if (r.status !== 200) return;
      lastSessions = r.body.sessions || [];
      renderLive(lastSessions);
      var btn = document.getElementById('shock-dev-item');
      if (btn) btn.classList.toggle('sd-active', !!r.body.dev);
    });
  }

  /* ---------- pannello modale (entra/esci, countdown) ---------- */
  var ov = null;

  function close() {
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
  }

  function toLocalInput(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var p = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
    return (
      d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      'T' + p(d.getHours()) + ':' + p(d.getMinutes())
    );
  }

  function openModal() {
    css();
    close();
    ov = document.createElement('div');
    ov.className = 'sd-ov';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) close();
    });
    ov.innerHTML =
      '<div class="sd-card"><button class="sd-x" aria-label="Chiudi">&times;</button>' +
      '<h2>Modalità dev</h2>' +
      '<p class="sd-sub">Il sito è chiuso al pubblico. La modalità dev vale solo per ' +
      'questo dispositivo e resta attiva anche dopo aver ricaricato o chiuso il browser.</p>' +
      '<div id="sd-body">Carico…</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.sd-x').addEventListener('click', close);
    renderModal();
  }

  function renderModal(msg) {
    var box = document.getElementById('sd-body');
    if (!box) return;
    api(API.state).then(function (r) {
      var s = r.body || {};
      lastSessions = s.sessions || [];
      renderLive(lastSessions);
      var h = '';
      if (msg) h += '<div class="sd-msg ' + msg.k + '">' + esc(msg.t) + '</div>';
      if (!s.kv) {
        h +=
          '<div class="sd-msg sd-warn">Memoria KV non collegata: la data del countdown non ' +
          'può essere salvata e l\'elenco di chi è in sessione resta vuoto. Il blocco del sito ' +
          'e la modalità dev funzionano comunque.</div>';
      }

      h += '<p style="margin:0 0 14px"><span class="sd-badge ' + (s.dev ? 'sd-on' : 'sd-no') + '">' +
        (s.dev ? 'Questo dispositivo è in modalità dev' : 'Questo dispositivo vede la pagina di attesa') +
        '</span></p>';

      if (s.dev) {
        h += '<p class="sd-sub" style="margin:0 0 12px">Sei entrato come <strong>' + esc(s.name) +
          '</strong>. Puoi navigare il sito normalmente.</p>' +
          '<button class="sd-btn sd-off" id="sd-exit">Esci dalla modalità dev</button>';
      } else {
        h += '<input id="sd-name" type="text" maxlength="40" placeholder="Il tuo nome" autocomplete="off"/>' +
          '<button class="sd-btn sd-go" id="sd-enter">Entra in modalità dev</button>';
      }

      h += '<div class="sd-sec"><h3>Countdown della pagina di attesa</h3>' +
        '<input id="sd-cd" type="datetime-local" value="' + esc(toLocalInput(s.countdown)) + '"/>' +
        '<button class="sd-btn sd-off" id="sd-save">Salva data</button></div>';

      box.innerHTML = h;

      var b;
      if ((b = document.getElementById('sd-enter'))) {
        b.addEventListener('click', function () {
          var n = (document.getElementById('sd-name').value || '').trim();
          if (!n) return renderModal({ k: 'sd-err', t: 'Scrivi il tuo nome prima di entrare.' });
          b.disabled = true;
          api(API.enter, 'POST', { name: n, password: pwd() }).then(function (r) {
            if (r.status !== 200) return renderModal({ k: 'sd-err', t: r.body.error || 'Errore' });
            renderModal({ k: 'sd-ok', t: 'Modalità dev attiva su questo dispositivo.' });
            poll();
          });
        });
      }
      if ((b = document.getElementById('sd-exit'))) {
        b.addEventListener('click', function () {
          b.disabled = true;
          api(API.exit, 'POST').then(function () {
            renderModal({ k: 'sd-ok', t: 'Modalità dev disattivata su questo dispositivo.' });
            poll();
          });
        });
      }
      if ((b = document.getElementById('sd-save'))) {
        b.addEventListener('click', function () {
          var v = document.getElementById('sd-cd').value;
          if (!v) return renderModal({ k: 'sd-err', t: 'Scegli una data.' });
          b.disabled = true;
          api(API.config, 'POST', { countdown: new Date(v).toISOString() }).then(function (r) {
            if (r.status !== 200) return renderModal({ k: 'sd-err', t: r.body.error || 'Errore' });
            renderModal({ k: 'sd-ok', t: 'Data del countdown aggiornata.' });
          });
        });
      }
    });
  }

  /* ---------- ancoraggio: subito sopra il pulsante Logout ---------- */
  function findLogoutBtn() {
    var els = document.querySelectorAll('button');
    for (var i = 0; i < els.length; i++) {
      if (/logout/i.test((els[i].textContent || '').trim())) return els[i];
    }
    return null;
  }

  function buildWidget() {
    var wrap = document.createElement('div');
    wrap.id = WIDGET_ID;
    wrap.innerHTML =
      '<div id="sd-live"></div>' +
      '<button type="button" class="sd-devbtn" id="shock-dev-item">' +
      '<span class="sd-ic">🛠</span>Modalità dev</button>';
    wrap.querySelector('#shock-dev-item').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openModal();
    });
    return wrap;
  }

  function mount() {
    if (!pwd()) return; // non ancora autenticato
    var logout = findLogoutBtn();
    if (!logout || !logout.parentNode) return;
    var existing = document.getElementById(WIDGET_ID);
    if (existing) {
      // React puo' aver ricostruito il footer: ci riposizioniamo se serve.
      if (existing.nextSibling !== logout) logout.parentNode.insertBefore(existing, logout);
      return;
    }
    logout.parentNode.insertBefore(buildWidget(), logout);
    renderLive(lastSessions);
    poll();
  }

  function start() {
    mount();
    if (window.MutationObserver) {
      var pend = 0;
      new MutationObserver(function () {
        if (pend) return;
        pend = 1;
        setTimeout(function () {
          pend = 0;
          mount();
        }, 250);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(mount, 2000); // rete di sicurezza dopo il login
    setInterval(poll, POLL_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
