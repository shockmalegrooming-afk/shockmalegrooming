/* SHOCK Male Grooming — pulsante "Nuovo cliente" nel pannello admin.
   La sezione Clienti (tab React caricata al volo) non ha modo di
   creare un cliente da zero — utile per chi compra in negozio e
   vuole iscriversi al programma fedelta'. Non tocchiamo il bundle
   minificato: un pulsante flottante, ancorato all'area di contenuto,
   compare solo quando la scheda "Clienti" e' quella aperta, e chiama
   l'endpoint /api/admin/customers.json che il worker gia' inoltra
   pari pari all'Admin API di Shopify (nessuna modifica al server). */
(function () {
  var BTN_ID = 'ac-fab';

  function pwd() {
    try {
      return sessionStorage.getItem('admin_password') || '';
    } catch (_) {
      return '';
    }
  }

  function adminFetch(path, opts) {
    opts = opts || {};
    return fetch('/api/admin/' + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json', 'X-Admin-Password': pwd() }, opts.headers || {}),
      body: opts.body,
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && (j.errors ? JSON.stringify(j.errors) : j.error)) || 'Errore');
        return j;
      });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function css() {
    if (document.getElementById('ac-css')) return;
    var st = document.createElement('style');
    st.id = 'ac-css';
    st.textContent =
      '#' + BTN_ID + '{position:absolute;top:28px;right:32px;z-index:40;display:flex;align-items:center;' +
      'gap:8px;background:#c9a84c;color:#0a0908;border:none;border-radius:100px;padding:11px 20px;' +
      'font-size:.85rem;font-weight:800;letter-spacing:.02em;cursor:pointer;font-family:inherit;' +
      'box-shadow:0 6px 20px rgba(201,168,76,.3);transition:filter .15s}' +
      '#' + BTN_ID + ':hover{filter:brightness(1.08)}' +
      '@media(max-width:768px){#' + BTN_ID + '{top:auto;bottom:20px;right:20px}}' +
      '.ac-ov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;' +
      'align-items:center;justify-content:center;padding:20px}' +
      '.ac-card{background:#1C1917;border:1px solid rgba(255,255,255,.09);border-radius:18px;' +
      'padding:26px 26px 22px;width:100%;max-width:420px;max-height:88vh;overflow:auto;' +
      'color:#f0ece5;font-family:system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6);' +
      'position:relative}' +
      '.ac-card h2{margin:0 0 4px;font-size:1.15rem;letter-spacing:.02em}' +
      '.ac-card .ac-sub{margin:0 0 20px;font-size:.8rem;color:rgba(240,236,229,.45);line-height:1.5}' +
      '.ac-card label{display:block;font-size:.72rem;color:rgba(240,236,229,.45);text-transform:uppercase;' +
      'letter-spacing:.06em;margin:0 0 6px}' +
      '.ac-card input{width:100%;padding:11px 13px;background:#0f0e0d;color:#fff;font-size:15px;' +
      'border:1px solid rgba(255,255,255,.13);border-radius:10px;outline:none;font-family:inherit;' +
      'margin-bottom:14px}' +
      '.ac-card input:focus{border-color:#c9a84c}' +
      '.ac-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.ac-tags{display:flex;gap:16px;margin:-2px 0 16px}' +
      '.ac-tags label{display:flex;align-items:center;gap:8px;font-size:.82rem;color:rgba(240,236,229,.75);' +
      'text-transform:none;letter-spacing:0;cursor:pointer;margin:0}' +
      '.ac-tags input{width:auto;margin:0}' +
      '.ac-btn{width:100%;border:none;border-radius:100px;padding:13px;font-size:.85rem;' +
      'font-weight:800;cursor:pointer;letter-spacing:.04em;font-family:inherit;text-transform:uppercase;' +
      'background:#c9a84c;color:#0a0908}' +
      '.ac-btn:disabled{opacity:.55;cursor:default}' +
      '.ac-x{position:absolute;top:14px;right:16px;background:none;border:0;' +
      'color:rgba(240,236,229,.5);font-size:1.5rem;cursor:pointer;line-height:1;padding:4px 8px}' +
      '.ac-msg{font-size:.8rem;line-height:1.5;padding:10px 12px;border-radius:9px;margin-bottom:14px}' +
      '.ac-err{background:rgba(239,68,68,.13);color:#e0685e}' +
      '.ac-ok{background:rgba(76,175,80,.13);color:#7bbf7b}';
    (document.head || document.documentElement).appendChild(st);
  }

  var ov = null;
  function close() {
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
  }

  function openModal() {
    css();
    close();
    ov = document.createElement('div');
    ov.className = 'ac-ov';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) close();
    });
    ov.innerHTML =
      '<div class="ac-card"><button class="ac-x" aria-label="Chiudi">&times;</button>' +
      '<h2>Nuovo cliente</h2>' +
      '<p class="ac-sub">Utile per chi compra in negozio e vuole entrare nel programma fedelta’.</p>' +
      '<div id="ac-msg"></div>' +
      '<form id="ac-form">' +
      '<div class="ac-row2">' +
      '<div><label for="ac-fn">Nome</label><input id="ac-fn" autocomplete="off"/></div>' +
      '<div><label for="ac-ln">Cognome</label><input id="ac-ln" autocomplete="off"/></div>' +
      '</div>' +
      '<label for="ac-em">Email</label><input id="ac-em" type="email" autocomplete="off"/>' +
      '<label for="ac-ph">Telefono <span style="text-transform:none;font-weight:400">(facoltativo)</span></label>' +
      '<input id="ac-ph" type="tel" placeholder="+39 333 1234567" autocomplete="off"/>' +
      '<div class="ac-tags">' +
      '<label><input id="ac-tag-nl" type="checkbox"/> Newsletter</label>' +
      '<label><input id="ac-tag-bb" type="checkbox"/> Barbiere</label>' +
      '</div>' +
      '<button class="ac-btn" id="ac-save" type="submit">Crea cliente</button>' +
      '</form></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ac-x').addEventListener('click', close);
    document.getElementById('ac-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
    setTimeout(function () {
      var f = document.getElementById('ac-fn');
      if (f) f.focus();
    }, 30);
  }

  function msg(kind, text) {
    var box = document.getElementById('ac-msg');
    if (box) box.innerHTML = '<div class="ac-msg ' + kind + '">' + esc(text) + '</div>';
  }

  function submit() {
    var fn = (document.getElementById('ac-fn').value || '').trim();
    var ln = (document.getElementById('ac-ln').value || '').trim();
    var em = (document.getElementById('ac-em').value || '').trim();
    var ph = (document.getElementById('ac-ph').value || '').trim();
    if (!fn && !ln) return msg('ac-err', 'Serve almeno un nome o un cognome.');
    if (!em) return msg('ac-err', "Serve un'email.");

    var tags = [];
    if (document.getElementById('ac-tag-nl').checked) tags.push('newsletter');
    if (document.getElementById('ac-tag-bb').checked) tags.push('barbiere');

    var customer = { first_name: fn, last_name: ln, email: em, tags: tags.join(', ') };
    if (ph) customer.phone = ph;

    var btn = document.getElementById('ac-save');
    btn.disabled = true;
    btn.textContent = 'Creo…';
    msg('', '');
    adminFetch('customers.json', { method: 'POST', body: JSON.stringify({ customer: customer }) })
      .then(function () {
        msg('ac-ok', '✓ Cliente creato. Ricarico la lista…');
        setTimeout(function () {
          location.reload();
        }, 900);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Crea cliente';
        msg('ac-err', 'Errore: ' + (err.message || '').slice(0, 140));
      });
  }

  /* ---------- ancoraggio: solo quando la scheda Clienti e' aperta ---------- */
  function findClientiHeading() {
    var hs = document.querySelectorAll('h2');
    for (var i = 0; i < hs.length; i++) {
      if ((hs[i].textContent || '').trim() === 'Clienti') return hs[i];
    }
    return null;
  }

  function buildBtn() {
    var b = document.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.innerHTML = '<span aria-hidden="true">+</span> Nuovo cliente';
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openModal();
    });
    return b;
  }

  function mount() {
    if (!pwd()) return;
    css();
    var heading = findClientiHeading();
    var main = document.querySelector('main');
    var btn = document.getElementById(BTN_ID);

    if (!heading) {
      // Non siamo nella scheda Clienti (o React l'ha smontata): nascondi.
      if (btn) btn.style.display = 'none';
      return;
    }
    if (!main) return;
    if (getComputedStyle(main).position === 'static') main.style.position = 'relative';

    if (!btn) {
      btn = buildBtn();
      main.appendChild(btn); // in coda: non tocca l'ordine dei figli di React
    }
    btn.style.display = 'flex';
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
        }, 200);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(mount, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
