/* SHOCK Male Grooming — storefront + carrello condiviso
   Usato da prodotti.html e prodotto.html. Parla direttamente con la
   Shopify Storefront API (token pubblico) e usa il checkout ospitato
   e sicuro di Shopify. Nessun dato sensibile lato client. */
(function () {
  "use strict";
  var SURL = "https://shock-male-grooming.myshopify.com/api/2024-01/graphql.json";
  var STOKEN = "0a215f25881fcbcbd0a0a7d8405b7ff6";
  var CART_KEY = "shock_cart_id_v1";
  var ACCENT = "#c9a84c";

  function sfetch(query, variables) {
    return fetch(SURL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": STOKEN },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.errors) throw new Error(j.errors[0] && j.errors[0].message || "Errore Storefront");
        return j.data;
      });
  }

  function money(amount, code) {
    var n = parseFloat(amount || "0");
    try {
      return new Intl.NumberFormat("it-IT", { style: "currency", currency: code || "EUR" }).format(n);
    } catch (e) {
      return "€" + n.toFixed(2);
    }
  }

  var CART_FIELDS =
    "id checkoutUrl totalQuantity cost{subtotalAmount{amount currencyCode}} " +
    "lines(first:100){edges{node{id quantity merchandise{... on ProductVariant{" +
    "id title image{url altText} price{amount currencyCode} product{title handle}}}}}}";

  var state = { cart: null, busy: false };
  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (f) { try { f(state.cart); } catch (e) {} }); updateBadge(); }

  function getCartId() { try { return localStorage.getItem(CART_KEY); } catch (e) { return null; } }
  function setCartId(id) { try { id ? localStorage.setItem(CART_KEY, id) : localStorage.removeItem(CART_KEY); } catch (e) {} }

  function loadCart() {
    var id = getCartId();
    if (!id) { state.cart = null; emit(); return Promise.resolve(null); }
    return sfetch("query($id:ID!){cart(id:$id){" + CART_FIELDS + "}}", { id: id })
      .then(function (d) {
        // d.cart null = carrello completato/scaduto: solo in questo caso lo svuotiamo
        if (d.cart) { state.cart = d.cart; }
        else { state.cart = null; setCartId(null); }
        emit();
        return d.cart;
      })
      // errore di rete transitorio: NON svuotare, mantieni lo stato attuale
      .catch(function () { emit(); return state.cart; });
  }

  function createCart(variantId, qty) {
    return sfetch(
      "mutation($lines:[CartLineInput!]){cartCreate(input:{lines:$lines}){cart{" + CART_FIELDS + "}userErrors{message}}}",
      { lines: [{ merchandiseId: variantId, quantity: qty }] }
    ).then(function (d) {
      var res = d.cartCreate;
      if (res.userErrors && res.userErrors.length) throw new Error(res.userErrors[0].message);
      state.cart = res.cart;
      setCartId(res.cart.id);
      emit();
      return res.cart;
    });
  }

  function add(variantId, qty) {
    qty = qty || 1;
    state.busy = true;
    var id = getCartId();
    var p;
    if (!id || !state.cart) {
      p = createCart(variantId, qty);
    } else {
      p = sfetch(
        "mutation($id:ID!,$lines:[CartLineInput!]!){cartLinesAdd(cartId:$id,lines:$lines){cart{" + CART_FIELDS + "}userErrors{message}}}",
        { id: id, lines: [{ merchandiseId: variantId, quantity: qty }] }
      ).then(function (d) {
        var res = d.cartLinesAdd;
        if (res.userErrors && res.userErrors.length) throw new Error(res.userErrors[0].message);
        // se il carrello era stato completato, cart può tornare null → ricrea
        if (!res.cart) { setCartId(null); return createCart(variantId, qty); }
        state.cart = res.cart;
        emit();
        return res.cart;
      });
    }
    return p.finally(function () { state.busy = false; });
  }

  function updateLine(lineId, qty) {
    var id = getCartId();
    if (!id) return Promise.resolve();
    if (qty <= 0) return removeLine(lineId);
    return sfetch(
      "mutation($id:ID!,$lines:[CartLineUpdateInput!]!){cartLinesUpdate(cartId:$id,lines:$lines){cart{" + CART_FIELDS + "}userErrors{message}}}",
      { id: id, lines: [{ id: lineId, quantity: qty }] }
    ).then(function (d) { state.cart = d.cartLinesUpdate.cart; emit(); });
  }

  function removeLine(lineId) {
    var id = getCartId();
    if (!id) return Promise.resolve();
    return sfetch(
      "mutation($id:ID!,$ids:[ID!]!){cartLinesRemove(cartId:$id,lineIds:$ids){cart{" + CART_FIELDS + "}userErrors{message}}}",
      { id: id, ids: [lineId] }
    ).then(function (d) { state.cart = d.cartLinesRemove.cart; emit(); });
  }

  /* ---------- UI: badge + drawer ---------- */
  function updateBadge() {
    var n = (state.cart && state.cart.totalQuantity) || 0;
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = n;
      el.style.display = n > 0 ? "flex" : "none";
    });
  }

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }

  var drawer, overlay;
  function buildDrawer() {
    if (drawer) return;
    overlay = el("div", { id: "shock-cart-overlay" });
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9998;opacity:0;pointer-events:none;transition:opacity .3s;backdrop-filter:blur(2px)";
    overlay.addEventListener("click", close);

    drawer = el("aside", { id: "shock-cart-drawer", "aria-label": "Carrello" });
    drawer.style.cssText =
      "position:fixed;top:0;right:0;height:100%;width:min(420px,92vw);background:#141312;z-index:9999;" +
      "transform:translateX(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;" +
      "box-shadow:-20px 0 60px rgba(0,0,0,.5);color:#f0ece5;font-family:var(--font-b,system-ui,sans-serif)";
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    onChange(renderDrawer);
    renderDrawer();
  }

  function renderDrawer() {
    if (!drawer) return;
    var cart = state.cart;
    var lines = (cart && cart.lines && cart.lines.edges) || [];
    var sub = cart && cart.cost && cart.cost.subtotalAmount;
    var head =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:22px 22px 16px;border-bottom:1px solid rgba(255,255,255,.08)">' +
      '<span style="font-family:var(--font-brand);font-weight:700;font-size:1.1rem;letter-spacing:.04em;text-transform:uppercase">Carrello</span>' +
      '<button data-cart-close aria-label="Chiudi" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#f0ece5;font-size:1.35rem;cursor:pointer;line-height:1;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center">&times;</button></div>';

    var body;
    if (!lines.length) {
      body =
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px;text-align:center">' +
        '<div style="font-size:2.4rem;opacity:.35">🛒</div>' +
        '<p style="color:rgba(255,255,255,.4);font-size:.9rem">Il tuo carrello è vuoto</p>' +
        '<a href="/prodotti" style="margin-top:6px;color:' + ACCENT + ';text-decoration:none;font-weight:600;font-size:.85rem">Scopri i prodotti →</a></div>';
    } else {
      var items = lines
        .map(function (e) {
          var n = e.node, m = n.merchandise;
          var img = m.image && m.image.url ? m.image.url : "";
          var variantLabel = m.title && m.title !== "Default Title" ? '<p style="color:rgba(255,255,255,.35);font-size:.72rem;margin-top:2px">' + m.title + "</p>" : "";
          return (
            '<div style="display:flex;gap:12px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,.06)">' +
            '<div style="width:64px;height:64px;border-radius:8px;overflow:hidden;background:#0a0908;flex-shrink:0">' +
            (img ? '<img src="' + img + '" alt="" style="width:100%;height:100%;object-fit:cover">' : "") +
            "</div>" +
            '<div style="flex:1;min-width:0">' +
            '<p style="font-weight:600;font-size:.85rem;line-height:1.2">' + m.product.title + "</p>" +
            variantLabel +
            '<div style="display:flex;align-items:center;gap:10px;margin-top:8px">' +
            '<div style="display:flex;align-items:center;border:1px solid rgba(255,255,255,.15);border-radius:100px">' +
            '<button data-line-dec="' + n.id + '" style="background:none;border:none;color:#f0ece5;width:26px;height:26px;cursor:pointer;font-size:1rem">−</button>' +
            '<span style="min-width:20px;text-align:center;font-size:.82rem">' + n.quantity + "</span>" +
            '<button data-line-inc="' + n.id + '" style="background:none;border:none;color:#f0ece5;width:26px;height:26px;cursor:pointer;font-size:1rem">+</button>' +
            "</div>" +
            '<button data-line-rm="' + n.id + '" style="background:none;border:none;color:#e0685e;font-size:.76rem;font-weight:600;cursor:pointer;margin-left:auto;text-decoration:underline;text-underline-offset:2px">Rimuovi</button>' +
            "</div></div>" +
            '<div style="font-weight:700;font-size:.85rem;white-space:nowrap">' + money(m.price.amount * n.quantity, m.price.currencyCode) + "</div>" +
            "</div>"
          );
        })
        .join("");
      body =
        '<div style="flex:1;overflow-y:auto;padding:4px 22px">' + items + "</div>" +
        '<div style="padding:18px 22px 24px;border-top:1px solid rgba(255,255,255,.08)">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:14px">' +
        '<span style="color:rgba(255,255,255,.5);font-size:.85rem">Subtotale</span>' +
        '<span style="font-weight:700;font-size:1.05rem">' + (sub ? money(sub.amount, sub.currencyCode) : "—") + "</span></div>" +
        '<p style="color:rgba(255,255,255,.3);font-size:.7rem;margin-bottom:14px">Spedizione e tasse calcolate al checkout.</p>' +
        '<button data-cart-checkout style="width:100%;background:' + ACCENT + ';color:#0a0908;border:none;border-radius:100px;padding:15px;font-weight:700;font-size:.9rem;letter-spacing:.03em;cursor:pointer;font-family:var(--font-brand);text-transform:uppercase">Vai al checkout</button>' +
        "</div>";
    }
    drawer.innerHTML = head + body;

    drawer.querySelector("[data-cart-close]").addEventListener("click", close);
    drawer.querySelectorAll("[data-line-inc]").forEach(function (b) {
      b.addEventListener("click", function () { var l = findLine(b.getAttribute("data-line-inc")); if (l) updateLine(l.id, l.quantity + 1); });
    });
    drawer.querySelectorAll("[data-line-dec]").forEach(function (b) {
      b.addEventListener("click", function () { var l = findLine(b.getAttribute("data-line-dec")); if (l) updateLine(l.id, l.quantity - 1); });
    });
    drawer.querySelectorAll("[data-line-rm]").forEach(function (b) {
      b.addEventListener("click", function () { removeLine(b.getAttribute("data-line-rm")); });
    });
    var co = drawer.querySelector("[data-cart-checkout]");
    if (co) co.addEventListener("click", function () { if (state.cart && state.cart.checkoutUrl) window.location.href = state.cart.checkoutUrl; });
  }

  function findLine(id) {
    var lines = (state.cart && state.cart.lines && state.cart.lines.edges) || [];
    for (var i = 0; i < lines.length; i++) if (lines[i].node.id === id) return lines[i].node;
    return null;
  }

  function open() {
    buildDrawer();
    if (!state.cart && getCartId()) loadCart(); // assicura il contenuto aggiornato
    requestAnimationFrame(function () { overlay.style.opacity = "1"; overlay.style.pointerEvents = "auto"; drawer.style.transform = "translateX(0)"; });
  }
  function close() { if (!drawer) return; overlay.style.opacity = "0"; overlay.style.pointerEvents = "none"; drawer.style.transform = "translateX(100%)"; }

  function flash(msg) {
    var t = el("div", null, msg);
    t.style.cssText =
      "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#141312;color:#f0ece5;border:1px solid " +
      ACCENT + ";padding:12px 22px;border-radius:100px;z-index:10000;font-size:.85rem;font-family:var(--font-b,sans-serif);" +
      "box-shadow:0 10px 40px rgba(0,0,0,.5);opacity:0;transition:opacity .25s,transform .25s";
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = "1"; t.style.transform = "translateX(-50%) translateY(-6px)"; });
    setTimeout(function () { t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 300); }, 2000);
  }

  function init() {
    buildDrawer();
    // Delega globale: apre il carrello da QUALSIASI elemento carrello, anche
    // quelli renderizzati/re-renderizzati da React (home) dopo l'hydration.
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-cart-open],[aria-label="Carrello"]');
      if (t) { e.preventDefault(); open(); }
    });
    // Mantiene il badge corretto anche se React ri-renderizza la navbar (scroll).
    window.addEventListener("scroll", function () {
      if (badgeRaf) return; badgeRaf = requestAnimationFrame(function () { badgeRaf = 0; updateBadge(); });
    }, { passive: true });
    setInterval(updateBadge, 1500);
    loadCart();
  }
  var badgeRaf = 0;

  window.ShockShop = {
    sfetch: sfetch, money: money, add: add, open: open, close: close, loadCart: loadCart,
    updateLine: updateLine, removeLine: removeLine, onChange: onChange, flash: flash, init: init,
    ACCENT: ACCENT,
    addAndOpen: function (variantId, qty) {
      return add(variantId, qty).then(function () { open(); }).catch(function (err) { flash("Errore: " + (err.message || "riprova")); });
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
