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
  var BLOCK_WIDGET_ID = 'shock-block-widget';
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
      '#' + WIDGET_ID + '{padding:10px 12px;border-top:1px solid rgba(255,255,255,.06);' +
      'border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:4px}' +
      '#sd-live{margin-bottom:8px}' +
      '#sd-live:empty{display:none}' +
      '.sd-row{display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:.78rem;' +
      'color:rgba(255,255,255,.55)}' +
      '.sd-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 3px currentColor22}' +
      '.sd-row .sd-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.sd-row .sd-me{color:rgba(255,255,255,.3);font-size:.68rem}' +
      '.sd-row .sd-time{font-size:.68rem;color:rgba(255,255,255,.32);flex-shrink:0}' +
      /* banner: verde spento, rosso con aura quando la modalita' dev e' attiva */
      '.sd-devbtn{display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;' +
      'border-radius:12px;cursor:pointer;font-size:.83rem;font-weight:700;text-align:left;' +
      'font-family:inherit;transition:background .25s,color .25s,border-color .25s,box-shadow .25s;' +
      'background:rgba(34,197,94,.12);border:1.5px solid rgba(34,197,94,.4);color:#4ade80}' +
      '.sd-devbtn:hover{background:rgba(34,197,94,.18)}' +
      '.sd-devbtn .sd-ic{font-size:1rem;width:20px;text-align:center;flex-shrink:0}' +
      /* pulsante "Blocco sito": riga di menu normale, non un banner colorato */
      '#' + BLOCK_WIDGET_ID + '{padding:2px 12px 6px}' +
      '.sd-blockbtn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;' +
      'border-radius:10px;border:none;cursor:pointer;background:transparent;' +
      'color:rgba(255,255,255,.45);font-size:.85rem;font-weight:500;text-align:left;' +
      'font-family:inherit;transition:background .15s,color .15s}' +
      '.sd-blockbtn:hover{background:rgba(255,255,255,.05);color:rgba(255,255,255,.7)}' +
      '.sd-blocklabel{flex:1}' +
      '.sd-blockstatus{font-size:.62rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;' +
      'padding:3px 9px;border-radius:100px;flex-shrink:0}' +
      '.sd-blockstatus.on{background:rgba(76,175,80,.15);color:#7bbf7b}' +
      '.sd-blockstatus.off{background:rgba(239,68,68,.15);color:#e0685e}' +
      '.sd-devbtn.sd-active{background:rgba(239,68,68,.16);border-color:rgba(239,68,68,.55);' +
      'color:#f87171;animation:sdPulse 2.2s ease-in-out infinite}' +
      '.sd-devbtn.sd-active:hover{background:rgba(239,68,68,.22)}' +
      '@keyframes sdPulse{0%,100%{box-shadow:0 0 12px 1px rgba(239,68,68,.28)}' +
      '50%{box-shadow:0 0 22px 5px rgba(239,68,68,.5)}}' +
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

  /* ---------- pannello modale della modalita' dev (entra/esci) ---------- */
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
      '<p class="sd-sub">Se il sito è chiuso al pubblico, la modalità dev ti fa vedere ' +
      'comunque il sito vero. Vale solo per ' +
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
          '<div class="sd-msg sd-warn">Memoria KV non collegata: l\'elenco di chi è in ' +
          'sessione resta vuoto. Il blocco del sito e la modalità dev funzionano comunque.</div>';
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

      box.innerHTML = h;

      // Variabili separate per ognuno: sd-enter e sd-exit sono mutuamente
      // esclusivi nell'HTML, ma condividere una sola "var b" tra i due
      // blocchi fa si' che il secondo controllo (quello del bottone
      // assente) riassegni la stessa variabile a null, azzerando il
      // riferimento che il primo listener aveva gia' catturato in
      // chiusura: al click, "b.disabled = true" lanciava un errore
      // prima ancora di chiamare l'API.
      var enterBtn = document.getElementById('sd-enter');
      if (enterBtn) {
        enterBtn.addEventListener('click', function () {
          var n = (document.getElementById('sd-name').value || '').trim();
          if (!n) return renderModal({ k: 'sd-err', t: 'Scrivi il tuo nome prima di entrare.' });
          enterBtn.disabled = true;
          api(API.enter, 'POST', { name: n, password: pwd() }).then(function (r) {
            if (r.status !== 200) return renderModal({ k: 'sd-err', t: r.body.error || 'Errore' });
            renderModal({ k: 'sd-ok', t: 'Modalità dev attiva su questo dispositivo.' });
            poll();
          });
        });
      }
      var exitBtn = document.getElementById('sd-exit');
      if (exitBtn) {
        exitBtn.addEventListener('click', function () {
          exitBtn.disabled = true;
          api(API.exit, 'POST').then(function () {
            renderModal({ k: 'sd-ok', t: 'Modalità dev disattivata su questo dispositivo.' });
            poll();
          });
        });
      }
    });
  }

  /* ---------- blocco sito: separato dalla modalita' dev ---------- */
  function openBlockModal() {
    css();
    close();
    ov = document.createElement('div');
    ov.className = 'sd-ov';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) close();
    });
    ov.innerHTML =
      '<div class="sd-card"><button class="sd-x" aria-label="Chiudi">&times;</button>' +
      '<h2>Blocco sito</h2>' +
      '<p class="sd-sub">Controlla se il sito è chiuso al pubblico, indipendentemente dalla ' +
      'modalità dev: se lo disattivi il sito si apre a tutti subito, cookie dev o no.</p>' +
      '<div id="sd-block-body">Carico…</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.sd-x').addEventListener('click', close);
    renderBlockModal();
  }

  function renderBlockModal(msg) {
    var box = document.getElementById('sd-block-body');
    if (!box) return;
    api(API.config).then(function (r) {
      var s = r.body || {};
      var h = '';
      if (msg) h += '<div class="sd-msg ' + msg.k + '">' + esc(msg.t) + '</div>';
      if (!s.kv) {
        h +=
          '<div class="sd-msg sd-warn">Memoria KV non collegata: qui non puoi salvare nulla. ' +
          'Il blocco resta quello di partenza.</div>';
      }
      h += '<p style="margin:0 0 14px"><span class="sd-badge ' + (s.enabled ? 'sd-on' : 'sd-no') + '">' +
        (s.enabled ? 'Sito chiuso al pubblico' : 'Sito aperto a tutti') + '</span></p>' +
        '<label style="display:flex;align-items:center;gap:10px;margin-bottom:18px;font-size:.85rem;' +
        'color:rgba(240,236,229,.75);cursor:pointer">' +
        '<input type="checkbox" id="sd-block-en" style="width:auto;margin:0"' +
        (s.enabled ? ' checked' : '') + '/> Blocco attivo</label>' +
        '<div class="sd-sec" style="margin-top:0;padding-top:0;border-top:none">' +
        '<h3>Il countdown inizia <span style="text-transform:none;letter-spacing:0;font-weight:400">' +
        '(facoltativo, solo per te — i visitatori non vedono differenze prima o dopo)</span></h3>' +
        '<input id="sd-block-start" type="datetime-local" value="' + esc(toLocalInput(s.start)) + '"/>' +
        '<h3 style="margin-top:6px">Il countdown finisce</h3>' +
        '<input id="sd-block-end" type="datetime-local" value="' + esc(toLocalInput(s.end)) + '"/>' +
        '<button class="sd-btn sd-go" id="sd-block-save">Salva</button></div>';
      box.innerHTML = h;

      document.getElementById('sd-block-save').addEventListener('click', function () {
        var end = document.getElementById('sd-block-end').value;
        var start = document.getElementById('sd-block-start').value;
        var en = document.getElementById('sd-block-en').checked;
        if (!end) return renderBlockModal({ k: 'sd-err', t: 'Scegli quando finisce il countdown.' });
        this.disabled = true;
        api(API.config, 'POST', {
          enabled: en,
          start: start ? new Date(start).toISOString() : null,
          end: new Date(end).toISOString(),
        }).then(function (r) {
          if (r.status !== 200) return renderBlockModal({ k: 'sd-err', t: r.body.error || 'Errore' });
          renderBlockModal({ k: 'sd-ok', t: 'Impostazioni salvate.' });
          pollBlock();
        });
      });
    });
  }

  function pollBlock() {
    if (!pwd()) return;
    api(API.config).then(function (r) {
      if (r.status !== 200) return;
      var st = document.getElementById('sd-block-status');
      if (st) {
        st.textContent = r.body.enabled ? 'Attivo' : 'Disattivo';
        st.className = 'sd-blockstatus ' + (r.body.enabled ? 'on' : 'off');
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

  function buildBlockWidget() {
    var wrap = document.createElement('div');
    wrap.id = BLOCK_WIDGET_ID;
    wrap.innerHTML =
      '<button type="button" class="sd-blockbtn" id="shock-block-item">' +
      '<span class="sd-ic">🔒</span><span class="sd-blocklabel">Blocco sito</span>' +
      '<span class="sd-blockstatus" id="sd-block-status"></span></button>';
    wrap.querySelector('#shock-block-item').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openBlockModal();
    });
    return wrap;
  }

  function mount() {
    if (!pwd()) return; // non ancora autenticato
    css(); // il banner deve essere gia' stilato al primo disegno, non solo aprendo il pannello
    var logout = findLogoutBtn();
    // footer = il blocco che contiene Logout e "Sito pubblico" insieme;
    // i widget vanno sopra QUEL blocco intero, non solo sopra Logout.
    // Ordine dall'alto: Blocco sito, poi Modalità dev, poi il footer.
    var footer = logout && logout.parentNode;
    var outer = footer && footer.parentNode;
    if (!footer || !outer) return;

    var devW = document.getElementById(WIDGET_ID);
    if (!devW) {
      devW = buildWidget();
      outer.insertBefore(devW, footer);
      renderLive(lastSessions);
      poll();
    } else if (devW.nextSibling !== footer) {
      // React puo' aver ricostruito il footer: ci riposizioniamo se serve.
      outer.insertBefore(devW, footer);
    }

    var blockW = document.getElementById(BLOCK_WIDGET_ID);
    if (!blockW) {
      blockW = buildBlockWidget();
      outer.insertBefore(blockW, devW);
      pollBlock();
    } else if (blockW.nextSibling !== devW) {
      outer.insertBefore(blockW, devW);
    }
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
    setInterval(pollBlock, POLL_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
