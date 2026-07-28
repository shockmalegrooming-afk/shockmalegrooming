/* SHOCK Male Grooming — comandi "modalità dev" nel pannello admin.
   Aggiunge una voce nel menu di sinistra da cui si attiva la modalità
   dev per QUESTO dispositivo, si vede chi altro è in sessione e si
   imposta la data del countdown della pagina di attesa.
   Il pannello è React: la voce di menu viene clonata da una esistente
   (così eredita lo stile) e riagganciata se React ricostruisce il menu. */
(function () {
  var API = {
    state: '/api/dev/state',
    enter: '/api/dev/enter',
    exit: '/api/dev/exit',
    config: '/api/config',
  };
  var ITEM_ID = 'shock-dev-item';

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

  /* ---------- stile del pannello ---------- */
  function css() {
    if (document.getElementById('shock-dev-css')) return;
    var st = document.createElement('style');
    st.id = 'shock-dev-css';
    st.textContent =
      '.sd-ov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;' +
      'align-items:center;justify-content:center;padding:20px}' +
      '.sd-card{background:#1C1917;border:1px solid rgba(255,255,255,.09);border-radius:18px;' +
      'padding:26px 26px 22px;width:100%;max-width:470px;max-height:88vh;overflow:auto;' +
      'color:#f0ece5;font-family:system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6)}' +
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
      '.sd-x{position:absolute;top:14px;right:16px;background:none;border:0;color:rgba(240,236,229,.5);' +
      'font-size:1.5rem;cursor:pointer;line-height:1;padding:4px 8px}' +
      '.sd-wrap{position:relative}' +
      '.sd-badge{display:inline-block;padding:5px 12px;border-radius:100px;font-size:.72rem;' +
      'font-weight:700;letter-spacing:.04em}' +
      '.sd-on{background:rgba(201,168,76,.16);color:#c9a84c}' +
      '.sd-no{background:rgba(255,255,255,.08);color:rgba(240,236,229,.6)}' +
      '.sd-list{list-style:none;margin:0;padding:0}' +
      '.sd-list li{display:flex;justify-content:space-between;align-items:center;gap:10px;' +
      'padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.87rem}' +
      '.sd-list li:last-child{border-bottom:0}' +
      '.sd-when{font-size:.72rem;color:rgba(240,236,229,.38)}' +
      '.sd-msg{font-size:.8rem;line-height:1.5;padding:10px 12px;border-radius:9px;margin-bottom:12px}' +
      '.sd-err{background:rgba(239,68,68,.13);color:#e0685e}' +
      '.sd-ok{background:rgba(76,175,80,.13);color:#7bbf7b}' +
      '.sd-warn{background:rgba(201,168,76,.12);color:#c9a84c}' +
      '.sd-empty{font-size:.83rem;color:rgba(240,236,229,.4);margin:0}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------- pannello ---------- */
  var ov = null;

  function close() {
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function quando(ms) {
    if (!ms) return '';
    var d = Math.round((Date.now() - ms) / 60000);
    if (d < 1) return 'ora';
    if (d < 60) return d + ' min fa';
    var h = Math.round(d / 60);
    return h < 24 ? h + 'h fa' : Math.round(h / 24) + 'g fa';
  }

  // ISO -> valore per <input type="datetime-local"> in ora locale
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

  function open() {
    css();
    close();
    ov = document.createElement('div');
    ov.className = 'sd-ov';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) close();
    });
    ov.innerHTML =
      '<div class="sd-card sd-wrap"><button class="sd-x" aria-label="Chiudi">&times;</button>' +
      '<h2>Modalità dev</h2>' +
      '<p class="sd-sub">Il sito è chiuso al pubblico. La modalità dev vale solo per ' +
      'questo dispositivo e resta attiva anche dopo aver ricaricato o chiuso il browser.</p>' +
      '<div id="sd-body">Carico…</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.sd-x').addEventListener('click', close);
    render();
  }

  function render(msg) {
    var box = document.getElementById('sd-body');
    if (!box) return;
    api(API.state).then(function (r) {
      var s = r.body || {};
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

      h += '<div class="sd-sec"><h3>In sessione dev adesso</h3>';
      if (s.sessions && s.sessions.length) {
        h += '<ul class="sd-list">';
        for (var i = 0; i < s.sessions.length; i++) {
          var x = s.sessions[i];
          h += '<li><span>' + esc(x.name) + (x.me ? ' <span class="sd-when">(tu)</span>' : '') +
            '</span><span class="sd-when">' + esc(quando(x.seen)) + '</span></li>';
        }
        h += '</ul>';
      } else {
        h += '<p class="sd-empty">Nessuno al momento.</p>';
      }
      h += '</div>';

      h += '<div class="sd-sec"><h3>Countdown della pagina di attesa</h3>' +
        '<input id="sd-cd" type="datetime-local" value="' + esc(toLocalInput(s.countdown)) + '"/>' +
        '<button class="sd-btn sd-off" id="sd-save">Salva data</button></div>';

      box.innerHTML = h;

      var b;
      if ((b = document.getElementById('sd-enter'))) {
        b.addEventListener('click', function () {
          var n = (document.getElementById('sd-name').value || '').trim();
          if (!n) return render({ k: 'sd-err', t: 'Scrivi il tuo nome prima di entrare.' });
          b.disabled = true;
          api(API.enter, 'POST', { name: n, password: pwd() }).then(function (r) {
            if (r.status !== 200) return render({ k: 'sd-err', t: r.body.error || 'Errore' });
            render({ k: 'sd-ok', t: 'Modalità dev attiva su questo dispositivo.' });
          });
        });
      }
      if ((b = document.getElementById('sd-exit'))) {
        b.addEventListener('click', function () {
          b.disabled = true;
          api(API.exit, 'POST').then(function () {
            render({ k: 'sd-ok', t: 'Modalità dev disattivata su questo dispositivo.' });
          });
        });
      }
      if ((b = document.getElementById('sd-save'))) {
        b.addEventListener('click', function () {
          var v = document.getElementById('sd-cd').value;
          if (!v) return render({ k: 'sd-err', t: 'Scegli una data.' });
          b.disabled = true;
          api(API.config, 'POST', { countdown: new Date(v).toISOString() }).then(function (r) {
            if (r.status !== 200) return render({ k: 'sd-err', t: r.body.error || 'Errore' });
            render({ k: 'sd-ok', t: 'Data del countdown aggiornata.' });
          });
        });
      }
    });
  }

  /* ---------- voce nel menu di sinistra ---------- */
  // Cloniamo una voce esistente per ereditarne lo stile, qualunque esso sia.
  var LABELS = ['Dashboard', 'Ordini', 'Clienti', 'Prodotti', 'Inventario',
                'Sconti', 'Bundle', 'Punti fedeltà', 'Vendita in negozio'];

  // Cerchiamo il contenitore i cui FIGLI DIRETTI sono le voci di menu:
  // partire dal testo "Dashboard" porterebbe allo span interno, non alla riga.
  function findMenu() {
    var nodes = document.querySelectorAll('div,nav,aside,ul,section');
    var best = null, bestScore = 2;
    for (var i = 0; i < nodes.length; i++) {
      var kids = nodes[i].children;
      if (kids.length < 3) continue;
      var score = 0;
      for (var j = 0; j < kids.length; j++) {
        if (LABELS.indexOf((kids[j].textContent || '').trim()) >= 0) score++;
      }
      if (score > bestScore) { bestScore = score; best = nodes[i]; }
    }
    return best;
  }

  function findProto() {
    var menu = findMenu();
    if (!menu) return null;
    var kids = menu.children;
    for (var i = 0; i < kids.length; i++) {
      if ((kids[i].textContent || '').trim() === 'Dashboard') return kids[i];
    }
    return kids[0] || null;
  }

  function setLabel(node, text) {
    var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var last = null, n;
    while ((n = w.nextNode())) if ((n.nodeValue || '').trim()) last = n;
    if (last) last.nodeValue = text;
    else node.textContent = text;
  }

  function mount() {
    if (document.getElementById(ITEM_ID)) return;
    if (!pwd()) return; // non ancora autenticato: nessun menu da agganciare
    var proto = findProto();
    if (!proto || !proto.parentNode) return;
    var item = proto.cloneNode(true);
    item.id = ITEM_ID;
    item.removeAttribute('href');
    setLabel(item, 'Modalità dev');
    item.style.cursor = 'pointer';
    item.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open();
    });
    proto.parentNode.appendChild(item);
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
