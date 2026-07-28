/* SHOCK Male Grooming — pulsante "mostra password"
   Aggiunge l'occhietto a OGNI campo password del sito, comprese le
   finestre caricate al volo (login/registrazione/cambio password), che
   nascono dopo il caricamento della pagina: per questo oltre alla
   scansione iniziale c'e' un MutationObserver.
   Nessuna dipendenza, nessuna modifica ai bundle React. */
(function () {
  var OPEN =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3.2"/></svg>';
  var SHUT =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5 5.5 12 5.5c1.7 0 3.2.4 4.5 1M22.5 12S19 18.5 12 18.5c-1.7 0-3.2-.4-4.5-1"/><path d="M9.9 9.9a3.2 3.2 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';

  function css() {
    if (document.getElementById('shock-eye-css')) return;
    var st = document.createElement('style');
    st.id = 'shock-eye-css';
    st.textContent =
      '.pw-wrap{position:relative;display:block}' +
      '.pw-eye{position:absolute;top:50%;transform:translateY(-50%);right:6px;' +
      'width:38px;height:38px;display:flex;align-items:center;justify-content:center;' +
      'background:none;border:0;padding:0;margin:0;cursor:pointer;border-radius:8px;' +
      'color:rgba(240,236,229,.45);transition:color .15s,background .15s;-webkit-appearance:none}' +
      '.pw-eye:hover{color:#f0ece5;background:rgba(255,255,255,.06)}' +
      '.pw-eye:focus-visible{outline:2px solid #c9a84c;outline-offset:2px}';
    (document.head || document.documentElement).appendChild(st);
  }

  function attach(inp) {
    if (!inp || inp._eye || inp.type !== 'password') return;
    inp._eye = 1;

    var wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);

    // Il margine passa al contenitore: cosi' l'altezza del contenitore
    // coincide con quella del campo e l'occhietto resta centrato.
    var cs = getComputedStyle(inp);
    if (cs.marginBottom && cs.marginBottom !== '0px') {
      wrap.style.marginBottom = cs.marginBottom;
      inp.style.marginBottom = '0';
    }
    // spazio a destra, altrimenti il testo finisce sotto l'icona
    var pr = parseFloat(cs.paddingRight) || 0;
    if (pr < 44) inp.style.paddingRight = '44px';

    var b = document.createElement('button');
    b.type = 'button'; // mai inviare il form
    b.className = 'pw-eye';
    b.tabIndex = -1;
    b.innerHTML = OPEN;
    b.setAttribute('aria-label', 'Mostra password');
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var mostra = inp.type === 'password';
      inp._eyeShow = mostra;
      inp.type = mostra ? 'text' : 'password';
      b.innerHTML = mostra ? SHUT : OPEN;
      b.setAttribute('aria-label', mostra ? 'Nascondi password' : 'Mostra password');
      try {
        inp.focus({ preventScroll: true });
        var n = inp.value.length;
        inp.setSelectionRange(n, n);
      } catch (_) {}
    });
    inp._eyeBtn = b;
    wrap.appendChild(b);
  }

  function scan() {
    css();
    var l = document.querySelectorAll('input[type=password]');
    for (var i = 0; i < l.length; i++) attach(l[i]);
    // React puo' ri-renderizzare e riportare il campo a password:
    // se l'utente l'aveva reso visibile, glielo rimettiamo.
    var vis = document.querySelectorAll('.pw-wrap>input');
    for (var j = 0; j < vis.length; j++) {
      var v = vis[j];
      if (v._eyeShow && v.type === 'password') v.type = 'text';
    }
  }

  function start() {
    scan();
    if (window.MutationObserver) {
      var pend = 0;
      new MutationObserver(function () {
        if (pend) return;
        pend = 1;
        setTimeout(function () {
          pend = 0;
          scan();
        }, 120);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
