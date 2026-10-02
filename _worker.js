const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
};
// force-redeploy: pick up new SHOPIFY_ADMIN_TOKEN (v2)

// Soglie del programma punti: [punti richiesti, sconto in euro].
// La STESSA tabella e' anche scritta a mano nel pannello admin e nella
// pagina punti del cliente (bundle React minificati, non modificabili
// qui in modo sicuro) — se cambiano le une vanno cambiate anche qui,
// altrimenti il server rifiuta richieste legittime. Questa e' pero'
// l'unica copia che CONTA per davvero: e' quella che decide se creare
// lo sconto o no.
const PUNTI_TIERS = [
  [50, 3],
  [100, 6],
  [250, 15],
  [500, 28],
  [1000, 55],
  [2000, 100],
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, search } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env, pathname, search);
    }

    if (pathname === "/api/newsletter") {
      return handleNewsletter(request, env);
    }

    if (pathname === "/api/barbieri") {
      return handleBarbieri(request, env);
    }

    if (pathname === "/api/products") {
      return handleProducts(env);
    }

    if (pathname === "/api/cancel-order") {
      return handleCancelOrder(request, env);
    }

    if (pathname === "/api/create-label") {
      return handleCreateLabel(request, env);
    }

    if (pathname === "/api/sender-addresses") {
      return handleSenderAddresses(request, env);
    }

    if (pathname === "/api/test-sendcloud") {
      return handleTestSendcloud(request, env);
    }

    if (pathname === "/api/manual-tracking") {
      return handleManualTracking(request, env);
    }

    if (pathname === "/api/punti") {
      return handlePunti(request, env);
    }

    if (pathname === "/api/generate-bundle-desc") {
      return handleGenerateBundleDesc(request, env);
    }

    if (pathname === "/api/debug-scopes") return handleDebugScopes(request, env);
    if (pathname === "/api/oauth-callback") return handleOauthCallback(request, env);
    if (pathname === "/api/ambassador/settings") return handleAmbassadorSettings(request, env);
    if (pathname === "/api/ambassador/list") return handleAmbassadorList(request, env);
    if (pathname === "/api/ambassador/create") return handleAmbassadorCreate(request, env);
    if (pathname === "/api/ambassador/toggle") return handleAmbassadorToggle(request, env);
    if (pathname === "/api/ambassador/agreement") return handleAmbassadorAgreement(request, env);
    if (pathname === "/api/ambassador/next-coupon") return handleAmbassadorNextCoupon(request, env);
    if (pathname === "/api/ambassador/sync-sales") return handleAmbassadorSyncSales(request, env);
    if (pathname === "/api/ambassador/me") return handleAmbassadorMe(request, env);

    if (pathname === "/api/dev/enter") return devEnter(request, env);
    if (pathname === "/api/dev/exit") return devExit(request, env);
    if (pathname === "/api/dev/state") return devState(request, env);
    if (pathname === "/api/config") return configRoute(request, env);

    // Blocco pre-lancio: le pagine sono servite solo ai dispositivi in
    // modalita' dev, finche' il blocco e' attivo. Il controllo sta qui,
    // nel worker, e non nel browser: non si aggira ne' disattivando
    // JavaScript ne' leggendo il sorgente. Il blocco e' indipendente
    // dalla modalita' dev: se e' disattivato il sito e' aperto a tutti,
    // cookie dev o no.
    if (isPageRequest(pathname) && !isAdminArea(pathname)) {
      const cfg = await getBlockConfig(env);
      if (cfg.enabled) {
        const dev = await devInfo(request, env);
        if (!dev) return comingSoon(env, cfg);
        const store = kv(env);
        if (store && dev.id && ctx && ctx.waitUntil) ctx.waitUntil(touchSession(store, dev));
      }
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleAdmin(request, env, pathname, search) {
  const pwd = request.headers.get("X-Admin-Password");
  if (!pwd || pwd !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "Non autorizzato" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const match = pathname.match(/\/api\/admin\/(.*)/);
  const shopifyPath = match ? match[1] : "";
  const shopifyUrl = `https://shock-male-grooming.myshopify.com/admin/api/2024-01/${shopifyPath}${search}`;

  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();

  const resp = await fetch(shopifyUrl, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
    },
    body,
  });

  const text = await resp.text();
  return new Response(text, {
    status: resp.status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleNewsletter(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { email } = await request.json().catch(() => ({}));
  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ error: "Email non valida" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
  };
  const base = "https://shock-male-grooming.myshopify.com/admin/api/2024-01";

  const createResp = await fetch(`${base}/customers.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer: {
        email,
        tags: "newsletter",
        email_marketing_consent: { state: "subscribed", opt_in_level: "single_opt_in" },
      },
    }),
  });

  if (createResp.status === 422) {
    const searchResp = await fetch(
      `${base}/customers/search.json?query=email:${encodeURIComponent(email)}`,
      { headers }
    );
    const { customers } = await searchResp.json();
    if (customers?.[0]) {
      const { id, tags } = customers[0];
      const newTags = tags
        ? tags.includes("newsletter") ? tags : `${tags}, newsletter`
        : "newsletter";
      await fetch(`${base}/customers/${id}.json`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ customer: { id, tags: newTags } }),
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function cleanProductTitle(raw) {
  // Strip "SHOCK™ - " prefix (including mojibake variants like "SHOCKâ„¢ - ")
  const cleaned = raw.replace(/^shock[^\-]*-\s*/i, "").trim();
  // Title-case the result
  return (cleaned || raw).replace(/\b\w/g, (c) => c.toUpperCase());
}

async function handleProducts(env) {
  const STOREFRONT_TOKEN = "0a215f25881fcbcbd0a0a7d8405b7ff6";
  const query = `{
    products(first: 50) {
      edges {
        node {
          id
          title
          handle
          description
          productType
          variants(first: 1) { edges { node { price { amount } } } }
          images(first: 1) { edges { node { src } } }
        }
      }
    }
  }`;
  const resp = await fetch(
    "https://shock-male-grooming.myshopify.com/api/2024-01/graphql.json",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query }),
    }
  );
  const raw = await resp.json();
  const edges = raw.data?.products?.edges || [];
  const products = edges.map(({ node: p }) => ({
    id: p.id,
    title: cleanProductTitle(p.title),
    handle: p.handle,
    description: "",
    productType: p.productType || "",
    price: p.variants?.edges?.[0]?.node?.price?.amount || "0",
    image: p.images?.edges?.[0]?.node?.src || null,
  }));
  return new Response(JSON.stringify({ products }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handleCancelOrder(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }
  const { token, orderId } = await request.json().catch(() => ({}));
  if (!token || !orderId) {
    return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  // Verify token belongs to a real customer via Storefront API
  const verifyResp = await fetch(
    "https://shock-male-grooming.myshopify.com/api/2024-01/graphql.json",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": "0a215f25881fcbcbd0a0a7d8405b7ff6",
      },
      body: JSON.stringify({ query: `query { customer(customerAccessToken: "${token}") { id } }` }),
    }
  );
  const { data } = await verifyResp.json();
  if (!data?.customer?.id) {
    return new Response(JSON.stringify({ error: "Token non valido" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  // orderId is like "gid://shopify/Order/12345" — extract numeric part
  const numericId = orderId.split("/").pop();
  const cancelResp = await fetch(
    `https://shock-male-grooming.myshopify.com/admin/api/2024-01/orders/${numericId}/cancel.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
      },
      body: JSON.stringify({ reason: "customer", email: true }),
    }
  );
  const result = await cancelResp.json();
  if (!cancelResp.ok) {
    return new Response(JSON.stringify({ error: result.errors || "Errore annullamento" }), {
      status: cancelResp.status, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function abToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function labelJson(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// Salva un tracking inserito a mano: crea la fulfillment su Shopify e avvisa il cliente
async function handleManualTracking(request, env) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });
  const pwd = request.headers.get("X-Admin-Password");
  if (!pwd || pwd !== env.ADMIN_PASSWORD) return labelJson({ error: "Non autorizzato" }, 401);
  const { orderId, tracking, carrier, url } = await request.json().catch(() => ({}));
  if (!orderId || !tracking) return labelJson({ error: "Inserisci il codice di tracciamento" }, 400);

  const base = "https://shock-male-grooming.myshopify.com/admin/api/2024-01";
  const shHeaders = { "Content-Type": "application/json", "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN };

  const foResp = await fetch(`${base}/orders/${orderId}/fulfillment_orders.json`, { headers: shHeaders });
  const foBody = await foResp.json().catch(() => ({}));
  if (!foResp.ok) {
    // Non scambiare un errore di Shopify (permessi mancanti, ordine
    // inesistente, rate limit) per "ordine gia' spedito o annullato":
    // e' un messaggio diverso e fuorviante, che nasconde la causa vera.
    const msg = typeof foBody.errors === "string" ? foBody.errors : JSON.stringify(foBody.errors || foBody);
    return labelJson({ error: "Shopify (lettura spedizioni): " + msg.slice(0, 200) }, 400);
  }
  const { fulfillment_orders } = foBody;
  const open = (fulfillment_orders || []).filter((f) => f.status === "open" || f.status === "in_progress");
  const use = open.length ? open : (fulfillment_orders || []);
  if (!use.length) return labelJson({ error: "Nessun articolo da evadere (ordine già spedito o annullato)" }, 400);

  const fResp = await fetch(`${base}/fulfillments.json`, {
    method: "POST",
    headers: shHeaders,
    body: JSON.stringify({
      fulfillment: {
        line_items_by_fulfillment_order: use.map((f) => ({ fulfillment_order_id: f.id })),
        tracking_info: { number: tracking, url: url || "", company: carrier || "" },
        notify_customer: true,
      },
    }),
  });
  if (!fResp.ok) {
    const t = await fResp.text();
    let msg = t.slice(0, 200);
    try { const j = JSON.parse(t); if (j.errors) msg = typeof j.errors === "string" ? j.errors : JSON.stringify(j.errors); } catch (e) {}
    return labelJson({ error: "Shopify: " + msg }, 400);
  }
  return labelJson({ success: true });
}

// Test connessione Sendcloud (verifica chiavi, sedi mittente e metodi) — NON crea etichette, gratis
async function handleTestSendcloud(request, env) {
  const pwd = request.headers.get("X-Admin-Password");
  if (!pwd || pwd !== env.ADMIN_PASSWORD) return labelJson({ ok: false, error: "Non autorizzato" }, 401);
  if (!env.SENDCLOUD_PUBLIC_KEY || !env.SENDCLOUD_SECRET_KEY) {
    return labelJson({ ok: false, error: "Chiavi Sendcloud non configurate su Cloudflare (SENDCLOUD_PUBLIC_KEY / SENDCLOUD_SECRET_KEY)" });
  }
  const auth = "Basic " + btoa(`${env.SENDCLOUD_PUBLIC_KEY}:${env.SENDCLOUD_SECRET_KEY}`);
  try {
    const aR = await fetch("https://panel.sendcloud.sc/api/v2/user/addresses/sender", { headers: { Authorization: auth } });
    if (aR.status === 401 || aR.status === 403) {
      return labelJson({ ok: false, error: "Chiavi API non valide (autenticazione Sendcloud fallita)" });
    }
    const aJ = await aR.json().catch(() => ({}));
    const addresses = (aJ.sender_addresses || []).map((a) => [a.company_name || a.contact_name, a.city].filter(Boolean).join(" "));
    const mR = await fetch("https://panel.sendcloud.sc/api/v2/shipping_methods", { headers: { Authorization: auth } });
    const mJ = await mR.json().catch(() => ({}));
    const methods = mJ.shipping_methods || [];
    const itHome = methods.filter((m) => (m.service_point_input === "none" || !m.service_point_input) && (m.countries || []).some((c) => (c.iso_2 || "").toUpperCase() === "IT"));
    // Corrieri che supportano il ritiro (pickup) via API Sendcloud v3: brt, poste_it_delivery, gls_it, dhl*, dpd*, fedex, ups, correos*, hermes_de
    const PICKUP_CARRIERS = ["brt", "poste", "gls", "dhl", "dpd", "fedex", "ups", "correos", "hermes"];
    const carriersUsed = [...new Set(methods.map((m) => (m.carrier || "").toLowerCase()).filter(Boolean))];
    const pickupCarriers = carriersUsed.filter((c) => PICKUP_CARRIERS.some((k) => c.includes(k)));
    return labelJson({
      ok: true,
      addresses,
      methods_total: methods.length,
      methods_it_home: itHome.length,
      sample: itHome.slice(0, 3).map((m) => m.name),
      carriers_used: carriersUsed,
      pickup_possibile: pickupCarriers.length > 0,
      pickup_corrieri: pickupCarriers,
    });
  } catch (e) {
    return labelJson({ ok: false, error: String(e).slice(0, 200) });
  }
}

// Genera una descrizione marketing per un bundle usando Groq (AI), a partire
// dal nome del bundle e dai prodotti inclusi. Usata dal pulsante
// "Genera descrizione con AI" nella scheda Bundle del pannello admin.
async function handleGenerateBundleDesc(request, env) {
  const pwd = request.headers.get("X-Admin-Password");
  if (!pwd || pwd !== env.ADMIN_PASSWORD) return labelJson({ error: "Non autorizzato" }, 401);
  if (!env.GROQ_API_KEY) {
    return labelJson({ error: "Chiave Groq non configurata su Cloudflare (GROQ_API_KEY)" }, 400);
  }
  const { name, products } = await request.json().catch(() => ({}));
  if (!name || !Array.isArray(products) || products.length < 2) {
    return labelJson({ error: "Servono un nome e almeno 2 prodotti" }, 400);
  }
  const prompt =
    `Scrivi una descrizione marketing breve (massimo 3 frasi, 40-60 parole) in italiano per un bundle di prodotti di grooming maschile chiamato "${name}", ` +
    `che contiene questi prodotti: ${products.join(", ")}. ` +
    `Il tono deve essere professionale ma diretto, adatto a un e-commerce italiano di cosmetica maschile da salone/barbiere. ` +
    `Spiega perché questi prodotti funzionano bene insieme (routine logica, es. lavaggio poi cura poi styling), senza inventare ingredienti o proprietà specifiche non menzionate. ` +
    `Non usare virgolette, non ripetere il nome del bundle nel testo, restituisci solo il testo della descrizione senza titoli o elenchi puntati.`;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = body.error?.message || JSON.stringify(body).slice(0, 200);
      return labelJson({ error: "Groq: " + msg }, 400);
    }
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return labelJson({ error: "Risposta AI vuota" }, 400);
    return labelJson({ description: `<p>${text}</p>` });
  } catch (e) {
    return labelJson({ error: String(e).slice(0, 200) }, 500);
  }
}

// Elenco indirizzi mittente configurati su Sendcloud (per scegliere la sede di partenza)
async function handleSenderAddresses(request, env) {
  const pwd = request.headers.get("X-Admin-Password");
  if (!pwd || pwd !== env.ADMIN_PASSWORD) return labelJson({ error: "Non autorizzato" }, 401);
  if (!env.SENDCLOUD_PUBLIC_KEY || !env.SENDCLOUD_SECRET_KEY) return labelJson({ addresses: [] });
  const auth = "Basic " + btoa(`${env.SENDCLOUD_PUBLIC_KEY}:${env.SENDCLOUD_SECRET_KEY}`);
  const r = await fetch("https://panel.sendcloud.sc/api/v2/user/addresses/sender", { headers: { Authorization: auth } });
  const j = await r.json().catch(() => ({}));
  const addresses = (j.sender_addresses || []).map((a) => ({
    id: a.id,
    label: [a.company_name || a.contact_name, a.street, a.house_number, a.city].filter(Boolean).join(" "),
  }));
  return labelJson({ addresses });
}

// Crea un'etichetta di spedizione con Sendcloud e scrive il tracking su Shopify
async function handleCreateLabel(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }
  const pwd = request.headers.get("X-Admin-Password");
  if (!pwd || pwd !== env.ADMIN_PASSWORD) {
    return labelJson({ error: "Non autorizzato" }, 401);
  }
  if (!env.SENDCLOUD_PUBLIC_KEY || !env.SENDCLOUD_SECRET_KEY) {
    return labelJson({ error: "Sendcloud non configurato: aggiungi SENDCLOUD_PUBLIC_KEY e SENDCLOUD_SECRET_KEY su Cloudflare" }, 500);
  }

  const { orderId, weight, length, width, height, senderAddressId } = await request.json().catch(() => ({}));
  if (!orderId) return labelJson({ error: "orderId mancante" }, 400);

  const base = "https://shock-male-grooming.myshopify.com/admin/api/2024-01";
  const shHeaders = { "Content-Type": "application/json", "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN };

  // 1) Recupera l'ordine da Shopify (indirizzo di spedizione)
  const oResp = await fetch(`${base}/orders/${orderId}.json`, { headers: shHeaders });
  if (!oResp.ok) return labelJson({ error: "Ordine non trovato su Shopify" }, 400);
  const { order } = await oResp.json();
  const sa = order.shipping_address;
  if (!sa) return labelJson({ error: "L'ordine non ha un indirizzo di spedizione" }, 400);

  // Estrai il civico dalla via (gli indirizzi italiani lo mettono in fondo)
  let address = sa.address1 || "";
  let house = "";
  const m = address.match(/\s(\d+\S*)$/);
  if (m) { house = m[1]; address = address.slice(0, m.index).trim(); }

  const auth = "Basic " + btoa(`${env.SENDCLOUD_PUBLIC_KEY}:${env.SENDCLOUD_SECRET_KEY}`);
  const v3Headers = { "Content-Type": "application/json", Authorization: auth };

  // Costruisci l'indirizzo mittente (from_address) dalle sedi configurate su Sendcloud
  let from = null;
  try {
    const addrResp = await fetch("https://panel.sendcloud.sc/api/v2/user/addresses/sender", { headers: { Authorization: auth } });
    const addrJson = await addrResp.json().catch(() => ({}));
    const senders = addrJson.sender_addresses || [];
    const picked = (senderAddressId && senders.find((a) => String(a.id) === String(senderAddressId))) || senders[0];
    if (picked) {
      from = {
        name: picked.contact_name || picked.company_name || "SHOCK",
        company_name: picked.company_name || "",
        address_line_1: picked.street || "",
        house_number: String(picked.house_number || ""),
        postal_code: picked.postal_code || "",
        city: picked.city || "",
        country_code: (picked.country || "IT").toUpperCase(),
        phone_number: picked.telephone || "",
        email: picked.email || "",
      };
    }
  } catch (e) {}
  if (!from) {
    return labelJson({ error: "Nessun indirizzo mittente configurato su Sendcloud. Aggiungi una sede di partenza nel pannello Sendcloud." }, 400);
  }

  const dest = (sa.country_code || "IT").toUpperCase();
  const to = {
    name: `${sa.first_name || ""} ${sa.last_name || ""}`.trim() || order.email || "Cliente",
    company_name: sa.company || "",
    address_line_1: address || sa.address1 || "",
    house_number: house,
    address_line_2: sa.address2 || "",
    postal_code: sa.zip || "",
    city: sa.city || "",
    country_code: dest,
    phone_number: sa.phone || order.phone || "",
    email: order.email || "",
  };

  const parcels = [{
    weight: { value: String(parseFloat(weight || "1") || 1), unit: "kg" },
    ...(length && width && height ? { dimensions: { length: String(length), width: String(width), height: String(height), unit: "cm" } } : {}),
  }];

  // 1) Trova le opzioni di spedizione a domicilio disponibili per la tratta (API v3)
  const soResp = await fetch("https://panel.sendcloud.sc/api/v3/shipping-options", {
    method: "POST",
    headers: v3Headers,
    body: JSON.stringify({ from_address: from, to_address: to, parcels }),
  });
  const soText = await soResp.text();
  let soJson = {};
  try { soJson = JSON.parse(soText); } catch (e) {}
  if (!soResp.ok) {
    const msg = (soJson.error && (soJson.error.message || soJson.error.detail)) || soText.slice(0, 300) || "Errore opzioni Sendcloud";
    return labelJson({ error: "Sendcloud (opzioni): " + msg }, 400);
  }
  const options = soJson.data || [];
  const home = options.filter((o) => o.functionalities && o.functionalities.last_mile === "home_delivery");
  const chosen = home[0] || options[0];
  if (!chosen) {
    return labelJson({ error: "Nessun metodo di spedizione a domicilio disponibile su Sendcloud per questa destinazione. Attiva un corriere (es. Poste/BRT) con consegna a domicilio." }, 400);
  }
  const shipWithProps = { shipping_option_code: chosen.code };
  if (chosen.contract && chosen.contract.id != null) shipWithProps.contract_id = chosen.contract.id;

  // 2) Crea e annuncia la spedizione con etichetta (API v3)
  const shipBody = {
    label_details: { mime_type: "application/pdf", dpi: 72 },
    from_address: from,
    to_address: to,
    ship_with: { type: "shipping_option_code", properties: shipWithProps },
    order_number: order.name || String(order.order_number || orderId),
    total_order_price: { currency: order.currency || "EUR", value: String(order.total_price || "0") },
    parcels,
  };
  const scResp = await fetch("https://panel.sendcloud.sc/api/v3/shipments/announce", {
    method: "POST",
    headers: v3Headers,
    body: JSON.stringify(shipBody),
  });
  const scText = await scResp.text();
  let scJson = {};
  try { scJson = JSON.parse(scText); } catch (e) {}
  if (!scResp.ok) {
    let msg = scText.slice(0, 300);
    if (scJson.error) msg = scJson.error.message || scJson.error.detail || msg;
    else if (Array.isArray(scJson.errors) && scJson.errors.length) msg = scJson.errors.map((x) => x.detail || x.message || x.title).filter(Boolean).join("; ");
    return labelJson({ error: "Sendcloud: " + msg }, 400);
  }
  const parcel = (scJson.data && scJson.data.parcels && scJson.data.parcels[0]) || {};
  const tracking = parcel.tracking_number || "";
  const trackingUrl = parcel.tracking_url || "";
  const carrier = (chosen.carrier && chosen.carrier.code) || "";

  // 3) Scarica il PDF dell'etichetta
  let labelB64 = "";
  const labelDoc = (parcel.documents || []).find((d) => d.type === "label") || (parcel.documents || [])[0];
  if (labelDoc && labelDoc.link) {
    const lResp = await fetch(labelDoc.link, { headers: { Authorization: auth, Accept: "application/pdf" } });
    if (lResp.ok) labelB64 = abToBase64(await lResp.arrayBuffer());
  }

  // 3) Crea la fulfillment su Shopify col tracking (così il cliente lo vede + mail)
  let fulfilled = false, fulfillError = "";
  if (tracking) {
    try {
      const foResp = await fetch(`${base}/orders/${orderId}/fulfillment_orders.json`, { headers: shHeaders });
      const foBody = await foResp.json().catch(() => ({}));
      if (!foResp.ok) {
        // Non lasciare fulfillError vuoto: senza questo, un errore di
        // Shopify (permessi, rate limit) sparisce in silenzio e sembra
        // solo "non evaso", senza dire perche'.
        throw new Error(typeof foBody.errors === "string" ? foBody.errors : JSON.stringify(foBody.errors || foBody));
      }
      const { fulfillment_orders } = foBody;
      const open = (fulfillment_orders || []).filter((f) => f.status === "open" || f.status === "in_progress");
      const use = open.length ? open : (fulfillment_orders || []);
      if (use.length) {
        const fResp = await fetch(`${base}/fulfillments.json`, {
          method: "POST",
          headers: shHeaders,
          body: JSON.stringify({
            fulfillment: {
              line_items_by_fulfillment_order: use.map((f) => ({ fulfillment_order_id: f.id })),
              tracking_info: { number: tracking, url: trackingUrl, company: carrier || "Sendcloud" },
              notify_customer: true,
            },
          }),
        });
        fulfilled = fResp.ok;
        if (!fResp.ok) fulfillError = (await fResp.text()).slice(0, 200);
      }
    } catch (e) {
      fulfillError = String(e).slice(0, 200);
    }
  }

  return labelJson({
    success: true,
    tracking_number: tracking,
    tracking_url: trackingUrl,
    carrier,
    label_pdf: labelB64,
    fulfilled,
    fulfill_error: fulfillError,
  });
}

async function handleBarbieri(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const { nome, cognome, email, telefono, citta, nome_salone, messaggio } = body;

  if (!email || !nome) {
    return new Response(JSON.stringify({ error: "Dati mancanti" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const resp = await fetch(
    "https://shock-male-grooming.myshopify.com/admin/api/2024-01/customers.json",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
      },
      body: JSON.stringify({
        customer: {
          first_name: nome,
          last_name: cognome || "",
          email,
          phone: telefono || "",
          tags: "barbiere, collaborazione",
          note: `Salone: ${nome_salone || "n.d."}\nCittà: ${citta || "n.d."}\nMessaggio: ${messaggio || ""}`,
        },
      }),
    }
  );

  const ok = resp.status === 201 || resp.status === 422;
  return new Response(JSON.stringify({ success: ok }), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handlePunti(request, env) {
  const base = "https://shock-male-grooming.myshopify.com";
  const adminHeaders = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
  };

  // Resolve customer ID from Storefront access token
  async function getCustomerIdFromToken(token) {
    const res = await fetch(`${base}/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": "0a215f25881fcbcbd0a0a7d8405b7ff6",
      },
      body: JSON.stringify({
        query: `query { customer(customerAccessToken: "${token}") { id } }`,
      }),
    });
    const data = await res.json();
    const gid = data?.data?.customer?.id;
    if (!gid) return null;
    return gid.replace("gid://shopify/Customer/", "");
  }

  // Read a metafield value for a customer
  async function getMeta(customerId, key) {
    const res = await fetch(
      `${base}/admin/api/2024-01/customers/${customerId}/metafields.json?namespace=loyalty`,
      { headers: adminHeaders }
    );
    const data = await res.json();
    return (data.metafields || []).find(m => m.key === key) || null;
  }

  // Upsert a metafield
  async function setMeta(customerId, key, value, type, existingId) {
    if (existingId) {
      await fetch(`${base}/admin/api/2024-01/metafields/${existingId}.json`, {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({ metafield: { id: existingId, value: String(value), type } }),
      });
    } else {
      const res = await fetch(
        `${base}/admin/api/2024-01/customers/${customerId}/metafields.json`,
        {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({ metafield: { namespace: "loyalty", key, value: String(value), type } }),
        }
      );
      return (await res.json()).metafield?.id;
    }
  }

  // Check which stored codes are still unused via Admin API
  async function filterActiveCodes(codes) {
    const active = [];
    for (const c of codes) {
      try {
        if (!c.price_rule_id) { active.push(c); continue; }
        const r = await fetch(
          `${base}/admin/api/2024-01/price_rules/${c.price_rule_id}/discount_codes.json`,
          { headers: adminHeaders }
        );
        const d = await r.json();
        const dc = (d.discount_codes || []).find(x => x.code === c.code);
        if (!dc || dc.usage_count === 0) active.push(c);
      } catch { active.push(c); }
    }
    return active;
  }

  if (request.method === "GET") {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response(JSON.stringify({ error: "Token mancante" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });

    const customerId = await getCustomerIdFromToken(token);
    if (!customerId) return new Response(JSON.stringify({ error: "Token non valido" }), { status: 401, headers: { "Content-Type": "application/json", ...CORS } });

    const [ptsMeta, codesMeta] = await Promise.all([
      getMeta(customerId, "points"),
      getMeta(customerId, "codes"),
    ]);

    const points = ptsMeta ? parseInt(ptsMeta.value) || 0 : 0;
    let codes = [];
    if (codesMeta) {
      try { codes = JSON.parse(codesMeta.value) || []; } catch {}
    }
    codes = await filterActiveCodes(codes);
    // Update codes metafield if some were removed
    if (codesMeta && codes.length < (JSON.parse(codesMeta.value || "[]").length)) {
      await setMeta(customerId, "codes", JSON.stringify(codes), "json", codesMeta.id);
    }

    return new Response(JSON.stringify({ points, codes }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  if (request.method === "POST") {
    const { token, points: ptsToRedeem, amount } = await request.json().catch(() => ({}));
    if (!token || !ptsToRedeem || !amount) {
      return new Response(JSON.stringify({ error: "Parametri mancanti" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
    }

    // Il client mandava punti/importo a piacere e il server si fidava:
    // chiunque poteva chiedere uno sconto enorme per pochi punti aprendo
    // i tool sviluppatore. La combinazione deve corrispondere ESATTAMENTE
    // a una soglia reale, verificata qui, non solo mostrata nell'interfaccia.
    const validTier = PUNTI_TIERS.some(([p, e]) => p === ptsToRedeem && e === amount);
    if (!validTier) {
      return new Response(JSON.stringify({ error: "Combinazione punti/sconto non valida" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
    }

    const customerId = await getCustomerIdFromToken(token);
    if (!customerId) return new Response(JSON.stringify({ error: "Token non valido" }), { status: 401, headers: { "Content-Type": "application/json", ...CORS } });

    const [ptsMeta, codesMeta] = await Promise.all([
      getMeta(customerId, "points"),
      getMeta(customerId, "codes"),
    ]);

    const currentPts = ptsMeta ? parseInt(ptsMeta.value) || 0 : 0;
    if (currentPts < ptsToRedeem) {
      return new Response(JSON.stringify({ error: "Punti insufficienti" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
    }

    // Create Shopify price rule + discount code
    const code = "SHOCK" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const prRes = await fetch(`${base}/admin/api/2024-01/price_rules.json`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        price_rule: {
          title: code,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "fixed_amount",
          value: String(-amount),
          customer_selection: "all",
          once_per_customer: true,
          usage_limit: 1,
          starts_at: new Date().toISOString(),
        },
      }),
    });
    const prData = await prRes.json();
    const priceRuleId = prData.price_rule?.id;

    if (!priceRuleId) {
      return new Response(JSON.stringify({ error: "Errore creazione sconto" }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
    }

    await fetch(`${base}/admin/api/2024-01/price_rules/${priceRuleId}/discount_codes.json`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ discount_code: { code } }),
    });

    // Deduct points
    const newPts = currentPts - ptsToRedeem;
    await setMeta(customerId, "points", String(newPts), "number_integer", ptsMeta?.id);

    // Add code to stored codes
    let codes = [];
    if (codesMeta) { try { codes = JSON.parse(codesMeta.value) || []; } catch {} }
    codes.push({ code, amount, price_rule_id: priceRuleId, created_at: new Date().toISOString() });
    await setMeta(customerId, "codes", JSON.stringify(codes), "json", codesMeta?.id);

    return new Response(JSON.stringify({ points: newPts, codes, newCode: code }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  return new Response("Method not allowed", { status: 405, headers: CORS });
}

/* ═══════════════════════════════════════════════════════════════════
   PROGRAMMA AMBASSADOR
   Ogni Ambassador e' un cliente Shopify vero, creato solo dall'admin
   (nessuna registrazione pubblica), con tag "ambassador" + un metafield
   JSON (namespace "ambassador", key "profile") che contiene tutto il
   resto: codice personale, regione, dati per il contratto, stato,
   coupon fornitura successiva gia' emessi. I codici sconto sono veri
   price_rule/discount_code Shopify (stessa API gia' usata dal programma
   punti), quindi funzionano su qualsiasi piano Shopify, non solo Plus.
   ═══════════════════════════════════════════════════════════════════ */

const KV_AMBASSADOR_SETTINGS = "config:ambassador";
const AMBASSADOR_SETTINGS_DEFAULT = {
  pricing_mode: "percent", // "percent" | "fixed" — "fixed" richiede un listino prodotto per prodotto, non ancora implementato
  store_discount_pct: 20, // Art. 2.3: sconto "prezzo da negozio" per i CLIENTI dell'Ambassador (= Listino Negozio, -20% sul prezzo online)
  supply_discount_pct: 50, // Art. 2.1: sconto sul "listino riservato" con cui l'AMBASSADOR STESSO si rifornisce (= Listino Fornitura, -50% sul prezzo online)
  next_supply_pct: 15, // [X%] dell'Art. 2.3: coupon sulla fornitura successiva
  first_order_mode: "amount", // "kit" | "amount"
  first_order_kit_desc: "",
  first_order_max_amount: 300,
  foro_competente: "Terni",
};

// I 6 prodotti del "pacchetto Ambassador" (kit primo ordine, -60%). Il
// codice sconto del primo ordine viene ristretto SOLO a questi prodotti,
// cosi' non puo' essere usato su altro anche se qualcuno lo scopre.
const AMBASSADOR_KIT_PRODUCT_TITLES = ["Curl Design", "Beard Oil", "Sea Salt Spray", "Matt Paste", "Shine Wax", "Extra Matt"];

async function getAmbassadorKitProductIds(env) {
  const r = await shopifyAdminFetch(env, "products.json?limit=250&fields=id,title");
  const d = await r.json().catch(() => ({}));
  const byTitle = new Map((d.products || []).map((p) => [p.title.trim().toLowerCase(), p.id]));
  return AMBASSADOR_KIT_PRODUCT_TITLES.map((t) => byTitle.get(t.toLowerCase())).filter(Boolean);
}

async function getAmbassadorSettings(env) {
  const store = kv(env);
  let cfg = AMBASSADOR_SETTINGS_DEFAULT;
  if (store) {
    const v = await store.get(KV_AMBASSADOR_SETTINGS);
    if (v) {
      try {
        cfg = { ...AMBASSADOR_SETTINGS_DEFAULT, ...JSON.parse(v) };
      } catch (_) {}
    }
  }
  return cfg;
}

async function handleAmbassadorSettings(request, env) {
  if (request.method === "GET") {
    return jsonRes(await getAmbassadorSettings(env));
  }
  if (request.method === "POST") {
    const pwd = request.headers.get("X-Admin-Password") || "";
    if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) return jsonRes({ error: "Non autorizzato" }, 401);
    const store = kv(env);
    if (!store) return jsonRes({ error: "Memoria KV non collegata: le impostazioni non possono essere salvate" }, 501);
    let body = {};
    try {
      body = await request.json();
    } catch (_) {}
    const cfg = {
      pricing_mode: body.pricing_mode === "fixed" ? "fixed" : "percent",
      store_discount_pct: Math.max(0, Math.min(90, parseFloat(body.store_discount_pct) || 0)),
      supply_discount_pct: Math.max(0, Math.min(90, parseFloat(body.supply_discount_pct) || 0)),
      next_supply_pct: Math.max(0, Math.min(90, parseFloat(body.next_supply_pct) || 0)),
      first_order_mode: body.first_order_mode === "kit" ? "kit" : "amount",
      first_order_kit_desc: String(body.first_order_kit_desc || "").slice(0, 500),
      first_order_max_amount: Math.max(0, parseFloat(body.first_order_max_amount) || 0),
      foro_competente: String(body.foro_competente || "").slice(0, 100),
    };
    await store.put(KV_AMBASSADOR_SETTINGS, JSON.stringify(cfg));
    return jsonRes({ ok: true, ...cfg });
  }
  return jsonRes({ error: "Metodo non consentito" }, 405);
}

function shopifyAdminBase() {
  return "https://shock-male-grooming.myshopify.com/admin/api/2024-01";
}

async function shopifyAdminFetch(env, path, opts = {}) {
  return fetch(`${shopifyAdminBase()}/${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
      ...(opts.headers || {}),
    },
  });
}

// Diagnostica temporanea: chiede a Shopify quali scope ha davvero il token in
// uso in questo momento, senza dover navigare nessuna dashboard Shopify.
async function handleDebugScopes(request, env) {
  const pwd = request.headers.get("X-Admin-Password") || "";
  if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) return jsonRes({ error: "Non autorizzato" }, 401);
  try {
    const r = await fetch("https://shock-male-grooming.myshopify.com/admin/oauth/access_scopes.json", {
      headers: { "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN },
    });
    const d = await r.json().catch(() => ({}));
    return jsonRes({ status: r.status, scopes: (d.access_scopes || []).map((s) => s.handle) });
  } catch (e) {
    return jsonRes({ error: String(e && e.message ? e.message : e) }, 400);
  }
}

// Diagnostica temporanea: completa lo scambio OAuth "codice -> token" per
// l'app Shopify che stiamo reinstallando, usando client_id/client_secret
// passati nell'URL di reindirizzamento stesso (Shopify li conserva assieme
// al vero "code" che aggiunge lui). Il token risultante va copiato a mano su
// Cloudflare — non viene salvato da nessuna parte qui. Da rimuovere a lavoro
// finito.
async function handleOauthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state") || "";
  const [clientId, clientSecret] = state.split(":");
  if (!code || !shop || !clientId || !clientSecret) {
    return new Response("Mancano parametri (code/shop/state). URL ricevuto: " + request.url, { status: 400 });
  }
  try {
    const r = await fetch(`https://${shop}/admin/oauth/access_token.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const text = await r.text();
    return new Response(`Status Shopify: ${r.status}\n\n${text}`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    return new Response("Errore: " + String(e && e.message ? e.message : e), { status: 500 });
  }
}

// Il portafoglio Ambassador usa le gift card Shopify, che si creano e si
// accreditano solo via GraphQL Admin API: la REST API può creare una gift
// card ma non ha nessun modo di aggiungere saldo a una già esistente.
async function shopifyAdminGraphQL(env, query, variables) {
  const res = await fetch(`${shopifyAdminBase()}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors) {
    throw new Error("GraphQL: " + JSON.stringify(data.errors || data).slice(0, 300));
  }
  return data;
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ambassadorCodeParts(shopName, discountPct) {
  const base = String(shopName || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 14) || "AMB";
  const rand = Math.floor(100 + Math.random() * 900); // 3 cifre casuali, non indovinabili a colpo sicuro
  const prefix = Number.isFinite(discountPct) && discountPct > 0 ? Math.round(discountPct) + "OFF-" : "SHOCK-";
  return { base, rand, code: prefix + base + rand };
}

async function getAmbassadorProfileMeta(env, customerId) {
  const mr = await shopifyAdminFetch(env, `customers/${customerId}/metafields.json?namespace=ambassador`);
  const md = await mr.json().catch(() => ({}));
  return (md.metafields || []).find((m) => m.key === "profile") || null;
}

async function handleAmbassadorList(request, env) {
  const pwd = request.headers.get("X-Admin-Password") || "";
  if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) return jsonRes({ error: "Non autorizzato" }, 401);
  try {
    return await handleAmbassadorListInner(env);
  } catch (e) {
    return jsonRes({ error: "Errore interno (elenco Ambassador): " + String(e && e.message ? e.message : e).slice(0, 300) }, 500);
  }
}

async function handleAmbassadorListInner(env) {
  const r = await shopifyAdminFetch(env, "customers/search.json?query=tag:ambassador&limit=250");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return jsonRes({ error: "Shopify: " + JSON.stringify(d).slice(0, 200) }, 400);
  const out = [];
  for (const c of d.customers || []) {
    const meta = await getAmbassadorProfileMeta(env, c.id);
    let profile = {};
    if (meta) {
      try {
        profile = JSON.parse(meta.value) || {};
      } catch (_) {}
    }
    out.push({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      created_at: c.created_at,
      profile,
    });
  }
  return jsonRes({ ambassadors: out });
}

async function handleAmbassadorCreate(request, env) {
  const pwd = request.headers.get("X-Admin-Password") || "";
  if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) return jsonRes({ error: "Non autorizzato" }, 401);
  try {
    return await handleAmbassadorCreateInner(request, env);
  } catch (e) {
    return jsonRes({ error: "Errore interno (creazione Ambassador): " + String(e && e.message ? e.message : e).slice(0, 300) }, 500);
  }
}

async function handleAmbassadorCreateInner(request, env) {
  const body = await request.json().catch(() => ({}));
  const { first_name, last_name, email, phone, region, piva, indirizzo, cap_citta, nome_negozio } = body;
  if (!first_name || !last_name || !email || !region || !nome_negozio) {
    return jsonRes({ error: "Nome, cognome, email, regione e nome negozio sono obbligatori" }, 400);
  }
  if (!env.SHOPIFY_ADMIN_TOKEN) {
    return jsonRes({ error: "SHOPIFY_ADMIN_TOKEN non configurato su Cloudflare: impossibile parlare con l'Admin API di Shopify" }, 500);
  }

  const regionSlug = slug(region);
  const existingR = await shopifyAdminFetch(env, `customers/search.json?query=tag:ambassador-regione-${regionSlug}&limit=10`);
  const existingD = await existingR.json().catch(() => ({}));
  const existingActive = (existingD.customers || []).filter((c) => {
    const tags = (c.tags || "").split(",").map((t) => t.trim());
    return tags.includes("ambassador") && !tags.includes("ambassador-sospeso");
  });
  if (existingActive.length >= 2) {
    return jsonRes({ error: `Ci sono già ${existingActive.length} Ambassador attivi per "${region}" (limite: 2 per regione)` }, 400);
  }

  const settings = await getAmbassadorSettings(env);

  const tags = ["ambassador", `ambassador-regione-${regionSlug}`];

  // Se esiste già un cliente con questa email (es. ha già comprato come
  // cliente normale), lo trasformiamo in Ambassador invece di fallire con
  // "email already taken".
  const emailSearchR = await shopifyAdminFetch(env, `customers/search.json?query=${encodeURIComponent("email:" + email)}&limit=1`);
  const emailSearchD = await emailSearchR.json().catch(() => ({}));
  const existingByEmail = (emailSearchD.customers || [])[0];

  let customerId;
  let customerState;
  if (existingByEmail) {
    const existingTags = (existingByEmail.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
    if (existingTags.includes("ambassador")) {
      return jsonRes({ error: "Questo cliente è già registrato come Ambassador" }, 400);
    }
    const mergedTags = Array.from(new Set([...existingTags, ...tags])).join(", ");
    const updRes = await shopifyAdminFetch(env, `customers/${existingByEmail.id}.json`, {
      method: "PUT",
      body: JSON.stringify({ customer: { id: existingByEmail.id, tags: mergedTags } }),
    });
    const updData = await updRes.json().catch(() => ({}));
    if (!updRes.ok || !updData.customer) {
      const msg = updData.errors ? JSON.stringify(updData.errors) : "errore sconosciuto";
      return jsonRes({ error: "Shopify (aggiornamento cliente esistente): " + msg.slice(0, 300) }, 400);
    }
    customerId = updData.customer.id;
    customerState = updData.customer.state;
  } else {
    const custRes = await shopifyAdminFetch(env, "customers.json", {
      method: "POST",
      body: JSON.stringify({ customer: { first_name, last_name, email, phone: phone || undefined, tags: tags.join(", "), verified_email: true } }),
    });
    const custData = await custRes.json().catch(() => ({}));
    if (!custRes.ok || !custData.customer) {
      const msg = custData.errors ? JSON.stringify(custData.errors) : "errore sconosciuto";
      return jsonRes({ error: "Shopify (creazione cliente): " + msg.slice(0, 300) }, 400);
    }
    customerId = custData.customer.id;
    customerState = custData.customer.state;
  }
  const { base: codeBase, rand: codeRand, code } = ambassadorCodeParts(nome_negozio, settings.store_discount_pct);
  const walletCodeWanted = codeBase + codeRand + "WALLET";
  const supplyCode = code + "-FORNITURA";
  const firstCode = code + "-PRIMO60";
  const firstOrderTotalPct = 100 - (100 - settings.supply_discount_pct) * 0.4;

  // Le 5 operazioni qui sotto sono indipendenti tra loro (nessuna usa il
  // risultato di un'altra): le lanciamo in parallelo invece che una dopo
  // l'altra. In sequenza erano 9-10 chiamate a Shopify una dietro l'altra,
  // abbastanza da avvicinarsi al limite di tempo di una richiesta e far
  // arrivare un 502 generico invece del vero errore.

  // 1. Invito Shopify: manda una mail al nuovo Ambassador per impostare la
  // password e poter accedere come un cliente normale (senza questo,
  // l'account esiste ma non ha password e non può fare login da nessuna parte).
  const invitePromise = (async () => {
    if (customerState === "enabled") return "already_active";
    try {
      const r = await shopifyAdminFetch(env, `customers/${customerId}/send_invite.json`, {
        method: "POST",
        body: JSON.stringify({ customer_invite: {} }),
      });
      return r.ok;
    } catch (_) {
      return false;
    }
  })();

  // 2. Portafoglio: una gift card Shopify vera, a saldo zero. Ogni volta che
  // un cliente compra col codice personale dell'Ambassador, il suo margine
  // viene accreditato qui (vedi handleAmbassadorSyncSales) — lui la usa al
  // checkout insieme al codice fornitura, e Shopify scala da solo solo la
  // parte di saldo che serve, tenendo il resto per la volta dopo.
  const walletPromise = (async () => {
    try {
      const giftGql = `mutation giftCardCreate($input: GiftCardCreateInput!) {
        giftCardCreate(input: $input) {
          giftCard { id }
          giftCardCode
          userErrors { field message }
        }
      }`;
      const giftData = await shopifyAdminGraphQL(env, giftGql, {
        input: {
          initialValue: "0.01",
          code: walletCodeWanted,
          customerId: `gid://shopify/Customer/${customerId}`,
          note: `Portafoglio Ambassador — ${nome_negozio}`,
        },
      });
      const giftPayload = giftData?.data?.giftCardCreate;
      if (giftPayload?.giftCard?.id && !(giftPayload.userErrors || []).length) {
        return { id: giftPayload.giftCard.id, code: giftPayload.giftCardCode };
      }
    } catch (_) {}
    return { id: null, code: null };
  })();

  // 3. Codice "prezzo da negozio": sconto permanente e riutilizzabile dai clienti dell'Ambassador
  const storeCodePromise = (async () => {
    if (!(settings.pricing_mode === "percent" && settings.store_discount_pct > 0)) return null;
    try {
      const prRes = await shopifyAdminFetch(env, "price_rules.json", {
        method: "POST",
        body: JSON.stringify({
          price_rule: {
            title: code,
            target_type: "line_item",
            target_selection: "all",
            allocation_method: "across",
            value_type: "percentage",
            value: String(-settings.store_discount_pct),
            customer_selection: "all",
            usage_limit: null,
            starts_at: new Date().toISOString(),
          },
        }),
      });
      const prData = await prRes.json().catch(() => ({}));
      const id = prData.price_rule?.id;
      if (!id) return null;
      await shopifyAdminFetch(env, `price_rules/${id}/discount_codes.json`, {
        method: "POST",
        body: JSON.stringify({ discount_code: { code } }),
      });
      return id;
    } catch (_) {
      return null;
    }
  })();

  // 4. Codice "listino fornitura" (Art. 2.1): sconto permanente con cui l'Ambassador
  // STESSO si rifornisce — riservato al suo account, non ai suoi clienti.
  const supplyCodePromise = (async () => {
    if (!(settings.supply_discount_pct > 0)) return null;
    try {
      const prRes = await shopifyAdminFetch(env, "price_rules.json", {
        method: "POST",
        body: JSON.stringify({
          price_rule: {
            title: supplyCode,
            target_type: "line_item",
            target_selection: "all",
            allocation_method: "across",
            value_type: "percentage",
            value: String(-settings.supply_discount_pct),
            customer_selection: "prerequisite",
            prerequisite_customer_ids: [customerId],
            usage_limit: null,
            starts_at: new Date().toISOString(),
          },
        }),
      });
      const prData = await prRes.json().catch(() => ({}));
      const id = prData.price_rule?.id;
      if (!id) return null;
      await shopifyAdminFetch(env, `price_rules/${id}/discount_codes.json`, {
        method: "POST",
        body: JSON.stringify({ discount_code: { code: supplyCode } }),
      });
      return id;
    } catch (_) {
      return null;
    }
  })();

  // 5. Codice primo ordine (Art. 2.2): "ulteriore sconto del 60%, calcolato sul prezzo
  // del listino riservato" — il 60% si applica DOPO il -supply_discount_pct%, non sul
  // prezzo pubblico. Sconto totale equivalente: 1-(1-supply%)*(1-60%). Riservato anche
  // questo al solo account dell'Ambassador.
  const firstOrderCodePromise = (async () => {
    try {
      const kitProductIds = await getAmbassadorKitProductIds(env);
      const priceRule = {
        title: firstCode,
        target_type: "line_item",
        allocation_method: "across",
        value_type: "percentage",
        value: String(-Math.round(firstOrderTotalPct * 100) / 100),
        customer_selection: "prerequisite",
        prerequisite_customer_ids: [customerId],
        once_per_customer: true,
        usage_limit: 1,
        starts_at: new Date().toISOString(),
      };
      if (kitProductIds.length) {
        priceRule.target_selection = "entitled";
        priceRule.entitled_product_ids = kitProductIds;
      } else {
        priceRule.target_selection = "all";
      }
      const prRes = await shopifyAdminFetch(env, "price_rules.json", {
        method: "POST",
        body: JSON.stringify({ price_rule: priceRule }),
      });
      const prData = await prRes.json().catch(() => ({}));
      const id = prData.price_rule?.id;
      if (!id) return null;
      await shopifyAdminFetch(env, `price_rules/${id}/discount_codes.json`, {
        method: "POST",
        body: JSON.stringify({ discount_code: { code: firstCode } }),
      });
      return id;
    } catch (_) {
      return null;
    }
  })();

  const [inviteSent, wallet, storePriceRuleId, supplyPriceRuleId, firstPriceRuleId] = await Promise.all([
    invitePromise,
    walletPromise,
    storeCodePromise,
    supplyCodePromise,
    firstOrderCodePromise,
  ]);
  const walletId = wallet.id,
    walletCode = wallet.code;

  const profile = {
    code,
    region,
    piva: piva || "",
    indirizzo: indirizzo || "",
    cap_citta: cap_citta || "",
    nome_negozio,
    status: "active",
    store_price_rule_id: storePriceRuleId,
    store_discount_pct: settings.store_discount_pct,
    supply_price_rule_id: supplyPriceRuleId,
    supply_code: supplyPriceRuleId ? supplyCode : null,
    supply_discount_pct: settings.supply_discount_pct,
    first_order_price_rule_id: firstPriceRuleId || null,
    first_order_code: firstPriceRuleId ? firstCode : null,
    first_order_total_pct: Math.round(firstOrderTotalPct * 100) / 100,
    first_order_used: false,
    foro_competente: settings.foro_competente || "",
    created_at: new Date().toISOString(),
    next_coupons: [],
    invite_sent: inviteSent,
    wallet_id: walletId,
    wallet_code: walletCode,
    wallet_balance: walletId ? 0.01 : 0,
    ledger: [],
  };
  await shopifyAdminFetch(env, `customers/${customerId}/metafields.json`, {
    method: "POST",
    body: JSON.stringify({ metafield: { namespace: "ambassador", key: "profile", value: JSON.stringify(profile), type: "json" } }),
  });

  return jsonRes({ ok: true, customer_id: customerId, profile });
}

async function handleAmbassadorToggle(request, env) {
  const pwd = request.headers.get("X-Admin-Password") || "";
  if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) return jsonRes({ error: "Non autorizzato" }, 401);
  try {
    return await handleAmbassadorToggleInner(request, env);
  } catch (e) {
    return jsonRes({ error: "Errore interno (sospendi/riattiva): " + String(e && e.message ? e.message : e).slice(0, 300) }, 500);
  }
}

async function handleAmbassadorToggleInner(request, env) {
  const { customer_id, suspend } = await request.json().catch(() => ({}));
  if (!customer_id) return jsonRes({ error: "customer_id mancante" }, 400);

  const custRes = await shopifyAdminFetch(env, `customers/${customer_id}.json?fields=id,tags`);
  const custData = await custRes.json().catch(() => ({}));
  if (!custRes.ok || !custData.customer) return jsonRes({ error: "Cliente non trovato" }, 404);

  let tags = (custData.customer.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  tags = tags.filter((t) => t !== "ambassador-sospeso");
  if (suspend) tags.push("ambassador-sospeso");
  await shopifyAdminFetch(env, `customers/${customer_id}.json`, {
    method: "PUT",
    body: JSON.stringify({ customer: { id: customer_id, tags: tags.join(", ") } }),
  });

  const meta = await getAmbassadorProfileMeta(env, customer_id);
  if (meta) {
    let profile = {};
    try {
      profile = JSON.parse(meta.value) || {};
    } catch (_) {}
    profile.status = suspend ? "suspended" : "active";
    await shopifyAdminFetch(env, `metafields/${meta.id}.json`, {
      method: "PUT",
      body: JSON.stringify({ metafield: { id: meta.id, value: JSON.stringify(profile), type: "json" } }),
    });
  }
  return jsonRes({ ok: true, suspended: !!suspend });
}

// Legge tutti gli ordini recenti, trova quelli fatti coi codici personali
// degli Ambassador (Art. 2.3) e accredita nel loro portafoglio Shopify
// (gift card) la differenza tra prezzo pieno e prezzo di fornitura di ogni
// riga acquistata — cioè il suo margine reale su quella vendita. Va
// richiamata di tanto in tanto (il pannello admin la lancia da sola
// all'apertura della scheda Ambassador): non esiste un webhook automatico
// a ogni ordine, quindi il saldo si aggiorna all'apertura del pannello, non
// nello stesso istante dell'acquisto del cliente.
async function handleAmbassadorSyncSales(request, env) {
  const pwd = request.headers.get("X-Admin-Password") || "";
  if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) return jsonRes({ error: "Non autorizzato" }, 401);
  try {
    return await handleAmbassadorSyncSalesInner(env);
  } catch (e) {
    return jsonRes({ error: "Errore interno (sincronizzazione vendite): " + String(e && e.message ? e.message : e).slice(0, 300) }, 500);
  }
}

async function handleAmbassadorSyncSalesInner(env) {
  const listRes = await handleAmbassadorListInner(env);
  const listData = await listRes.json();
  const ambassadors = (listData.ambassadors || []).filter((a) => a.profile && a.profile.code);
  if (!ambassadors.length) return jsonRes({ ok: true, updated: 0, orders_scanned: 0 });

  const settings = await getAmbassadorSettings(env);
  const ordersRes = await shopifyAdminFetch(env, "orders.json?status=any&limit=250&fields=id,name,discount_codes,line_items,created_at,cancelled_at");
  const ordersData = await ordersRes.json().catch(() => ({}));
  if (!ordersRes.ok) return jsonRes({ error: "Shopify (lettura ordini): " + JSON.stringify(ordersData).slice(0, 200) }, 400);
  const orders = (ordersData.orders || []).filter((o) => !o.cancelled_at);

  let updated = 0;
  const errors = [];
  for (const amb of ambassadors) {
    const meta = await getAmbassadorProfileMeta(env, amb.id);
    if (!meta) continue;
    let profile = {};
    try {
      profile = JSON.parse(meta.value) || {};
    } catch (_) {}
    profile.ledger = profile.ledger || [];
    profile.wallet_balance = profile.wallet_balance || 0;
    const seenIds = new Set(profile.ledger.map((l) => String(l.order_id)));
    const code = (profile.code || "").toLowerCase();
    let orderMarginTotal = 0;
    let changed = false;
    for (const o of orders) {
      if (seenIds.has(String(o.id))) continue;
      const codes = (o.discount_codes || []).map((d) => (d.code || "").toLowerCase());
      if (!codes.includes(code)) continue;
      let orderMargin = 0;
      const items = [];
      for (const li of o.line_items || []) {
        const retail = parseFloat(li.price || 0) * (li.quantity || 1);
        const wholesale = retail * (1 - (settings.supply_discount_pct || 0) / 100);
        const margin = Math.round((retail - wholesale) * 100) / 100;
        orderMargin += margin;
        items.push({ title: li.title, qty: li.quantity, margin });
      }
      orderMargin = Math.round(orderMargin * 100) / 100;
      profile.ledger.push({ order_id: o.id, order_name: o.name, items, margin: orderMargin, date: o.created_at });
      orderMarginTotal += orderMargin;
      changed = true;
      updated++;
    }
    if (profile.first_order_code && !profile.first_order_used) {
      const focode = profile.first_order_code.toLowerCase();
      const usedFirstOrder = orders.some((o) => (o.discount_codes || []).some((d) => (d.code || "").toLowerCase() === focode));
      if (usedFirstOrder) {
        profile.first_order_used = true;
        changed = true;
      }
    }
    if (!changed) continue;
    profile.wallet_balance = Math.round((profile.wallet_balance + orderMarginTotal) * 100) / 100;
    if (profile.wallet_id && orderMarginTotal > 0) {
      try {
        const creditGql = `mutation giftCardCredit($id: ID!, $creditInput: GiftCardCreditInput!) {
          giftCardCredit(id: $id, creditInput: $creditInput) {
            giftCardCreditTransaction { id }
            userErrors { field message }
          }
        }`;
        const creditData = await shopifyAdminGraphQL(env, creditGql, {
          id: profile.wallet_id,
          creditInput: { creditAmount: { amount: String(orderMarginTotal), currencyCode: "EUR" } },
        });
        const errs = creditData?.data?.giftCardCredit?.userErrors || [];
        if (errs.length) errors.push(`${profile.code}: ` + errs.map((e) => e.message).join("; "));
      } catch (e) {
        errors.push(`${profile.code}: ` + String(e && e.message ? e.message : e).slice(0, 150));
      }
    }
    await shopifyAdminFetch(env, `metafields/${meta.id}.json`, {
      method: "PUT",
      body: JSON.stringify({ metafield: { id: meta.id, value: JSON.stringify(profile), type: "json" } }),
    });
  }
  return jsonRes({ ok: true, updated, orders_scanned: orders.length, errors });
}

async function handleAmbassadorNextCoupon(request, env) {
  const pwd = request.headers.get("X-Admin-Password") || "";
  if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) return jsonRes({ error: "Non autorizzato" }, 401);
  try {
    return await handleAmbassadorNextCouponInner(request, env);
  } catch (e) {
    return jsonRes({ error: "Errore interno (coupon fornitura): " + String(e && e.message ? e.message : e).slice(0, 300) }, 500);
  }
}

async function handleAmbassadorNextCouponInner(request, env) {
  const { customer_id, order_id, order_name } = await request.json().catch(() => ({}));
  if (!customer_id) return jsonRes({ error: "customer_id mancante" }, 400);

  const meta = await getAmbassadorProfileMeta(env, customer_id);
  if (!meta) return jsonRes({ error: "Questo cliente non è un Ambassador" }, 404);
  let profile = {};
  try {
    profile = JSON.parse(meta.value) || {};
  } catch (_) {}
  profile.next_coupons = profile.next_coupons || [];
  if (order_id && profile.next_coupons.some((c) => String(c.order_id) === String(order_id))) {
    return jsonRes({ error: "Coupon già generato per questo ordine", existing: profile.next_coupons.find((c) => String(c.order_id) === String(order_id)) }, 400);
  }

  const settings = await getAmbassadorSettings(env);
  const code = (profile.code || "SHOCK") + "-NEXT" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const prRes = await shopifyAdminFetch(env, "price_rules.json", {
    method: "POST",
    body: JSON.stringify({
      price_rule: {
        title: code,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "percentage",
        value: String(-(settings.next_supply_pct || 0)),
        customer_selection: "all",
        once_per_customer: true,
        usage_limit: 1,
        starts_at: new Date().toISOString(),
      },
    }),
  });
  const prData = await prRes.json().catch(() => ({}));
  const priceRuleId = prData.price_rule?.id;
  if (!priceRuleId) return jsonRes({ error: "Errore creazione sconto Shopify" }, 400);
  await shopifyAdminFetch(env, `price_rules/${priceRuleId}/discount_codes.json`, {
    method: "POST",
    body: JSON.stringify({ discount_code: { code } }),
  });

  profile.next_coupons.push({
    code,
    order_id: order_id || null,
    order_name: order_name || null,
    pct: settings.next_supply_pct,
    created_at: new Date().toISOString(),
  });
  await shopifyAdminFetch(env, `metafields/${meta.id}.json`, {
    method: "PUT",
    body: JSON.stringify({ metafield: { id: meta.id, value: JSON.stringify(profile), type: "json" } }),
  });

  return jsonRes({ ok: true, code });
}

function ambassadorAgreementHtml(customer, profile, settings) {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const firstOrderText =
    settings.first_order_mode === "kit"
      ? `composto da ${esc(settings.first_order_kit_desc || "[kit fisso da definire]")}`
      : `di importo fino a €${settings.first_order_max_amount} a prezzi di listino riservato`;
  const legalName = esc(`${customer.first_name || ""} ${customer.last_name || ""}`.trim());
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<title>Accordo Ambassador Shock — ${legalName}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:760px;margin:40px auto;padding:0 20px;font-size:14px;line-height:1.55}
h1{font-size:1.6rem;margin-bottom:4px}
.sub{color:#666;font-size:0.85rem;margin-bottom:24px}
h2{font-size:1rem;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px}
.field{margin:10px 0}
.field b{display:inline-block;width:220px}
.field .line{display:inline-block;border-bottom:1px solid #333;min-width:260px;padding-bottom:2px}
.sign{display:flex;gap:60px;margin-top:30px}
.sign>div{flex:1}
.sign p{border-bottom:1px solid #333;margin:22px 0 4px;padding-bottom:2px;font-size:0.8rem;color:#666}
footer{margin-top:40px;font-size:0.7rem;color:#999;text-align:center}
.btn{position:fixed;top:16px;right:16px;background:#0077A8;color:#fff;border:none;border-radius:100px;padding:10px 20px;font-weight:700;cursor:pointer;font-size:0.85rem}
@media print{body{margin:0}.btn{display:none}}
</style></head><body>
<button class="btn" onclick="window.print()">Stampa / Salva PDF</button>
<h1>Accordo Ambassador Shock</h1>
<p class="sub">Versione 2 · Settembre 2026</p>
<h2>Art. 1 – Parti e oggetto</h2>
<p>L'accordo è tra <b>SHOCK HAIR SRLS</b>, P.IVA 17983531009, con sede in Via Lugnano in Teverina 21, 05020 Lugnano in Teverina (TR) ("Shock"), e:</p>
<div class="field"><b>Nome legale Ambassador:</b> <span class="line">${legalName}</span></div>
<div class="field"><b>P.IVA:</b> <span class="line">${esc(profile.piva)}</span></div>
<div class="field"><b>Sede / Indirizzo:</b> <span class="line">${esc(profile.indirizzo)}</span></div>
<div class="field"><b>CAP e Città:</b> <span class="line">${esc(profile.cap_citta)}</span></div>
<div class="field"><b>Nome del negozio:</b> <span class="line">${esc(profile.nome_negozio)}</span></div>
<p>(di seguito "l'Ambassador")</p>
<p>Shock seleziona un massimo di due barbieri per regione come Ambassador Shock. L'Ambassador riceve condizioni commerciali riservate e visibilità e, in cambio, produce contenuti social secondo l'Art. 3. Il numero limitato di posti non costituisce esclusiva territoriale, salvo diversa indicazione scritta.</p>
<h2>Art. 2 – Cosa offre Shock</h2>
<p><b>1. Listino riservato.</b> Per tutta la durata dell'accordo l'Ambassador acquista da Shock secondo un listino a lui dedicato (-${esc(settings.supply_discount_pct)}% sul prezzo online), per rivendere i prodotti ai propri clienti. Codice per i riordini, riservato all'account dell'Ambassador: <b>${esc(profile.supply_code || "—")}</b>.</p>
<p><b>2. Primo ordine di prova.</b> Sul primo ordine l'Ambassador ha un ulteriore sconto del 60%, calcolato sul prezzo del listino riservato (sconto totale equivalente: -${esc(profile.first_order_total_pct ?? "")}% sul prezzo online). Lo sconto vale per un solo ordine, ${firstOrderText}. Codice: <b>${esc(profile.first_order_code || "—")}</b>.</p>
<p><b>3. Codice personale.</b> Shock assegna all'Ambassador un codice univoco: <b>${esc(profile.code)}</b>. I clienti dell'Ambassador che lo usano su shockmalegrooming.com ordinano al prezzo da negozio, più basso del prezzo al pubblico online. L'Ambassador può pubblicare il codice sui propri canali social. Per ogni ordine fatto con il suo codice, la differenza tra il prezzo online e il prezzo di fornitura riservato viene accreditata automaticamente nel suo portafoglio personale (codice: <b>${esc(profile.wallet_code || "—")}</b>), da usare insieme al codice di riordino sulla fornitura successiva.</p>
<p><b>4. Area riservata.</b> Accesso a una sezione personale del sito per richiedere nuove forniture.</p>
<p><b>5. Visibilità sui contenuti.</b> Shock può ripubblicare i contenuti dell'Ambassador sulla pagina Instagram @shockmalegrooming, che alla data della firma conta più di 50.000 follower.</p>
<h2>Art. 3 – Cosa chiede Shock</h2>
<p>Entro 30 giorni dalla consegna del primo ordine, l'Ambassador pubblica:</p>
<ul><li>2 video verticali, ciascuno come Reel su Instagram e come TikTok, in cui usa o presenta i prodotti Shock nel suo negozio;</li><li>4 story su Instagram.</li></ul>
<p>In ogni contenuto l'Ambassador tagga @shockmalegrooming e, dove la piattaforma lo consente, pubblica in collaborazione con l'account Shock. I video restano online per tutta la durata dell'accordo.</p>
<p><b>Impegni aggiuntivi:</b></p>
<ul><li>tenere i prodotti Shock visibili in negozio;</li><li>inviare un feedback breve sui prodotti ogni 6 mesi.</li></ul>
<h2>Art. 4 – Regole sui contenuti</h2>
<p>1. L'Ambassador non attribuisce ai prodotti effetti medici o terapeutici e descrive solo ciò che ha realmente provato.</p>
<p>2. Non usa musica protetta al di fuori delle librerie commerciali messe a disposizione dalle piattaforme.</p>
<p>3. Se nei video compaiono clienti o collaboratori, garantisce di avere il loro consenso a essere ripresi.</p>
<p>4. Shock può chiedere la modifica o la rimozione di un contenuto lesivo del marchio. L'Ambassador provvede entro 3 giorni dalla richiesta.</p>
<h2>Art. 5 – Diritti sui contenuti</h2>
<p>I contenuti realizzati in collaborazione restano dell'Ambassador. Egli concede a Shock una licenza esclusiva e gratuita, valida per tutta la durata dell'accordo, per utilizzarli sui canali social, sul sito di Shock e in campagne a pagamento. Per tutta la durata dell'accordo l'Ambassador non concede gli stessi contenuti ad altri marchi; resta libero di tenerli sui propri profili. La licenza comprende l'uso del nome, della voce e dell'immagine dell'Ambassador come compaiono nei contenuti.</p>
<h2>Art. 6 – Uso di listino e codice, riservatezza</h2>
<p>1. Il listino riservato è strettamente personale: non può essere ceduto, condiviso o pubblicato.</p>
<p>2. Il codice personale può essere comunicato ai clienti e pubblicato sui canali social e sul sito dell'Ambassador. Non può essere ceduto a terzi né pubblicato su siti di coupon senza consenso scritto di Shock.</p>
<p>3. L'Ambassador può rivendere i prodotti Shock ai propri clienti nel suo negozio. Shock indica un prezzo di vendita consigliato, non vincolante.</p>
<p>4. L'accordo non impone l'esclusiva di marca: l'Ambassador può continuare a usare altri prodotti. Nei contenuti per Shock non compaiono marchi concorrenti.</p>
<h2>Art. 7 – Durata, verifica attività, sospensione e recesso</h2>
<p>1. L'accordo dura 12 mesi dalla firma e si rinnova solo se Shock e l'Ambassador lo confermano per iscritto.</p>
<p>2. Se l'Ambassador non consegna i contenuti dell'Art. 3 nei termini, Shock gli invia un avviso scritto. Trascorsi 7 giorni senza consegna, listino e codice sono sospesi finché i contenuti non sono pubblicati. Le forniture già ordinate e pagate restano dovute.</p>
<p>3. Ciascuna parte può recedere con preavviso di 30 giorni.</p>
<p>4. Shock può revocare subito la qualifica di Ambassador se l'Ambassador danneggia gravemente il marchio. Se l'Ambassador viola l'Art. 4 e non rimedia entro 7 giorni dalla richiesta scritta di Shock, la qualifica può essere revocata con la stessa efficacia.</p>
<h2>Art. 8 – Disposizioni finali e firme</h2>
<p>Ogni modifica va concordata per iscritto. I dati personali dell'Ambassador sono trattati da Shock per gestire l'accordo, secondo l'informativa privacy disponibile su shockmalegrooming.com. L'accordo è regolato dalla legge italiana.</p>
<div class="field"><b>Foro competente (città):</b> <span class="line">${esc(profile.foro_competente)}</span></div>
<div class="field"><b>Luogo e data di firma:</b> <span class="line">&nbsp;</span></div>
<div class="sign">
<div><b>Per SHOCK HAIR SRLS</b><p>Nome e cognome</p><p>Ruolo / Qualifica</p><p>Firma</p><p>Data</p></div>
<div><b>Per l'Ambassador</b><p>Nome e cognome</p><p>Ruolo / Qualifica</p><p>Firma</p><p>Data</p></div>
</div>
<footer>© SHOCK HAIR SRLS – P.IVA 17983531009 – Uso riservato</footer>
</body></html>`;
}

async function handleAmbassadorAgreement(request, env) {
  const url = new URL(request.url);
  const pwd = request.headers.get("X-Admin-Password") || url.searchParams.get("pwd") || "";
  if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) return new Response("Non autorizzato", { status: 401 });
  const customerId = url.searchParams.get("id");
  if (!customerId) return new Response("id mancante", { status: 400 });
  try {
    return await handleAmbassadorAgreementInner(env, customerId);
  } catch (e) {
    return new Response("Errore interno: " + String(e && e.message ? e.message : e).slice(0, 300), { status: 500 });
  }
}

async function handleAmbassadorAgreementInner(env, customerId) {
  const custRes = await shopifyAdminFetch(env, `customers/${customerId}.json?fields=id,first_name,last_name,email`);
  const custData = await custRes.json().catch(() => ({}));
  if (!custRes.ok || !custData.customer) return new Response("Cliente non trovato", { status: 404 });

  const meta = await getAmbassadorProfileMeta(env, customerId);
  let profile = {};
  if (meta) {
    try {
      profile = JSON.parse(meta.value) || {};
    } catch (_) {}
  }
  const settings = await getAmbassadorSettings(env);
  const html = ambassadorAgreementHtml(custData.customer, profile, settings);
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function getCustomerIdFromStorefrontToken(token) {
  const res = await fetch("https://shock-male-grooming.myshopify.com/api/2024-01/graphql.json", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": "0a215f25881fcbcbd0a0a7d8405b7ff6" },
    body: JSON.stringify({ query: `query { customer(customerAccessToken: "${token}") { id } }` }),
  });
  const data = await res.json().catch(() => ({}));
  const gid = data?.data?.customer?.id;
  if (!gid) return null;
  return gid.replace("gid://shopify/Customer/", "");
}

async function handleAmbassadorMe(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return jsonRes({ error: "Token mancante" }, 400);
  try {
    return await handleAmbassadorMeInner(env, token);
  } catch (e) {
    return jsonRes({ error: "Errore interno: " + String(e && e.message ? e.message : e).slice(0, 300) }, 500);
  }
}

async function handleAmbassadorMeInner(env, token) {
  const customerId = await getCustomerIdFromStorefrontToken(token);
  if (!customerId) return jsonRes({ error: "Token non valido" }, 401);

  const meta = await getAmbassadorProfileMeta(env, customerId);
  if (!meta) return jsonRes({ error: "Questo account non è un Ambassador Shock" }, 403);
  let profile = {};
  try {
    profile = JSON.parse(meta.value) || {};
  } catch (_) {}
  if (profile.status !== "active") {
    return jsonRes({ error: "Il tuo profilo Ambassador è al momento sospeso. Contatta Shock per riattivarlo." }, 403);
  }
  return jsonRes({ profile });
}

/* ═══════════════════════════════════════════════════════════════════
   BLOCCO PRE-LANCIO + MODALITA' DEV
   Il sito non e' ancora pubblico: chi arriva vede la pagina di attesa.
   Gli admin, dopo l'accesso al pannello, attivano la "modalita' dev"
   che vale per il SINGOLO dispositivo tramite un cookie firmato con la
   password admin: non e' falsificabile e non richiede di riautenticarsi
   a ogni ricaricamento.
   ═══════════════════════════════════════════════════════════════════ */

const DEV_COOKIE = "shock_dev";
const DEV_COOKIE_TTL = 60 * 60 * 24 * 30; // il dispositivo resta "dev" per 30 giorni
const DEV_SESSION_TTL = 60 * 60 * 12;     // "in sessione ora": decade dopo 12h di inattivita'
const KV_BLOCK = "config:block";
const KV_DEV_PREFIX = "dev:";
// Segnaposto: i valori veri si impostano dal pannello admin (richiede KV).
const BLOCK_FALLBACK = { enabled: true, start: null, end: "2026-08-27T18:00:00.000Z" };

// Un namespace KV espone get/put/list; ASSETS (i file statici) no: ha
// get e list ma non put, e comunque lo escludiamo per sicurezza.
function isKV(v) {
  return !!v && typeof v === "object" &&
    typeof v.get === "function" &&
    typeof v.put === "function" &&
    typeof v.list === "function";
}

function kv(env) {
  if (isKV(env.SHOCK_KV)) return env.SHOCK_KV;
  // Tolleranza sul nome: se il namespace e' stato collegato con un nome
  // diverso va bene lo stesso, cosi' un refuso non blocca tutto.
  for (const k in env) {
    if (k === "ASSETS") continue;
    if (isKV(env[k])) return env[k];
  }
  return null;
}

function jsonRes(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...extra },
  });
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const parts = raw.split(";");
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.indexOf(name + "=") === 0) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

function b64urlFromBytes(buf) {
  const a = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToText(s) {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(a);
}

async function hmac(msg, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64urlFromBytes(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

async function devSign(payload, secret) {
  const body = b64urlFromBytes(new TextEncoder().encode(JSON.stringify(payload)));
  return body + "." + (await hmac(body, secret));
}

async function devRead(token, secret) {
  if (!token || token.indexOf(".") < 0) return null;
  const i = token.indexOf(".");
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expect = await hmac(body, secret);
  if (sig.length !== expect.length) return null;
  let diff = 0; // confronto a tempo costante
  for (let k = 0; k < sig.length; k++) diff |= sig.charCodeAt(k) ^ expect.charCodeAt(k);
  if (diff !== 0) return null;
  try {
    return JSON.parse(b64urlToText(body));
  } catch (_) {
    return null;
  }
}

async function devInfo(request, env) {
  if (!env.ADMIN_PASSWORD) return null; // senza segreto non si firma nulla
  const tok = readCookie(request, DEV_COOKIE);
  if (!tok) return null;
  return await devRead(tok, env.ADMIN_PASSWORD);
}

function isAdminArea(pathname) {
  return (
    pathname === "/admin" ||
    pathname === "/admin/" ||
    pathname === "/admin.html" ||
    pathname.indexOf("/admin/") === 0
  );
}

// Sono "pagine" gli indirizzi navigabili; gli asset con estensione
// (immagini, css, js) restano accessibili, servono al pannello admin
// e alla pagina di attesa.
function isPageRequest(pathname) {
  if (pathname.indexOf("/api/") === 0 || pathname.indexOf("/_next/") === 0) return false;
  const last = pathname.split("/").pop() || "";
  if (last.indexOf(".") >= 0 && !/\.html?$/i.test(last)) return false;
  return true;
}

async function touchSession(store, dev) {
  const key = KV_DEV_PREFIX + dev.id;
  let o = { name: dev.name, since: Date.now() };
  const cur = await store.get(key);
  if (cur) {
    try {
      o = JSON.parse(cur);
    } catch (_) {}
  }
  o.name = dev.name;
  o.seen = Date.now();
  await store.put(key, JSON.stringify(o), { expirationTtl: DEV_SESSION_TTL });
}

async function devEnter(request, env) {
  if (request.method !== "POST") return jsonRes({ error: "Metodo non consentito" }, 405);
  let body = {};
  try {
    body = await request.json();
  } catch (_) {}
  const pwd = body.password || request.headers.get("X-Admin-Password") || "";
  if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) {
    return jsonRes({ error: "Password non corretta" }, 401);
  }
  const name = String(body.name || "")
    .replace(/[\u0000-\u001f<>]/g, "") // via caratteri di controllo e angolari
    .trim()
    .slice(0, 40);
  if (!name) return jsonRes({ error: "Scrivi il tuo nome prima di entrare" }, 400);

  const id = crypto.randomUUID();
  const token = await devSign({ id, name, ts: Date.now() }, env.ADMIN_PASSWORD);
  const store = kv(env);
  if (store) {
    await store.put(
      KV_DEV_PREFIX + id,
      JSON.stringify({ name, since: Date.now(), seen: Date.now() }),
      { expirationTtl: DEV_SESSION_TTL }
    );
  }
  return jsonRes({ ok: true, name, kv: !!store }, 200, {
    "Set-Cookie":
      DEV_COOKIE + "=" + encodeURIComponent(token) +
      "; Path=/; Max-Age=" + DEV_COOKIE_TTL + "; HttpOnly; Secure; SameSite=Lax",
  });
}

async function devExit(request, env) {
  const dev = await devInfo(request, env);
  const store = kv(env);
  if (dev && dev.id && store) await store.delete(KV_DEV_PREFIX + dev.id);
  return jsonRes({ ok: true }, 200, {
    "Set-Cookie": DEV_COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
  });
}

async function devState(request, env) {
  const dev = await devInfo(request, env);
  const out = {
    dev: !!dev,
    name: dev ? dev.name : null,
    sessions: [],
    kv: !!kv(env),
  };
  // l'elenco di chi e' in sessione lo vede solo chi ha fatto l'accesso
  const pwd = request.headers.get("X-Admin-Password") || "";
  if (env.ADMIN_PASSWORD && pwd === env.ADMIN_PASSWORD) {
    const store = kv(env);
    if (store) {
      const list = await store.list({ prefix: KV_DEV_PREFIX });
      for (const k of list.keys) {
        const v = await store.get(k.name);
        if (!v) continue;
        try {
          const o = JSON.parse(v);
          out.sessions.push({
            name: o.name,
            since: o.since || null,
            seen: o.seen || null,
            me: !!(dev && KV_DEV_PREFIX + dev.id === k.name),
          });
        } catch (_) {}
      }
      out.sessions.sort((a, b) => (b.seen || 0) - (a.seen || 0));
    }
  }
  return jsonRes(out);
}

// Configurazione del blocco: indipendente dalla modalita' dev. "enabled"
// decide se il sito e' chiuso al pubblico o aperto a tutti; "start" e'
// solo informativo (non cambia cosa vede chi visita); "end" e' il
// traguardo verso cui conta il countdown mostrato sulla pagina di attesa.
async function getBlockConfig(env) {
  const store = kv(env);
  if (store) {
    const v = await store.get(KV_BLOCK);
    if (v) {
      try {
        const o = JSON.parse(v);
        if (o && typeof o === "object" && o.end) {
          return { enabled: o.enabled !== false, start: o.start || null, end: o.end };
        }
      } catch (_) {}
    }
  }
  return BLOCK_FALLBACK;
}

async function configRoute(request, env) {
  if (request.method === "GET") {
    // Diagnostica: nomi dei binding di tipo KV visibili al worker.
    // Solo i nomi, mai i valori: serve a capire se il namespace e'
    // collegato sotto un nome diverso da SHOCK_KV.
    const bindings = [];
    for (const k in env) if (isKV(env[k])) bindings.push(k);
    const cfg = await getBlockConfig(env);
    return jsonRes({ ...cfg, kv: !!kv(env), kvBindings: bindings });
  }
  if (request.method === "POST") {
    const pwd = request.headers.get("X-Admin-Password") || "";
    if (!env.ADMIN_PASSWORD || pwd !== env.ADMIN_PASSWORD) {
      return jsonRes({ error: "Non autorizzato" }, 401);
    }
    const store = kv(env);
    if (!store) {
      return jsonRes({ error: "Memoria KV non collegata: le impostazioni non possono essere salvate" }, 501);
    }
    let body = {};
    try {
      body = await request.json();
    } catch (_) {}
    const end = new Date(body.end);
    if (isNaN(end.getTime())) return jsonRes({ error: "Data di fine non valida" }, 400);
    let start = null;
    if (body.start) {
      const d = new Date(body.start);
      if (isNaN(d.getTime())) return jsonRes({ error: "Data di inizio non valida" }, 400);
      start = d.toISOString();
    }
    const cfg = { enabled: !!body.enabled, start, end: end.toISOString() };
    await store.put(KV_BLOCK, JSON.stringify(cfg));
    return jsonRes({ ok: true, ...cfg });
  }
  return jsonRes({ error: "Metodo non consentito" }, 405);
}

async function comingSoon(env, cfg) {
  const c = cfg || (await getBlockConfig(env));
  return new Response(comingSoonHtml(c.end), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function comingSoonHtml(iso) {
  return `<!DOCTYPE html>
<html lang="it" class="chakra_petch_13432d97-module__uwhhyG__variable plus_jakarta_sans_977d070a-module__D5mM4W__variable">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>It's time to SHOCK — SHOCK Male Grooming</title>
<link rel="stylesheet" href="/_next/static/chunks/157p7ch9xsnj3.css"/>
<link rel="icon" href="/favicon.ico?v=shock2" sizes="any" type="image/x-icon"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=shock2"/>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#0a0908;color:#f0ece5;
 font-family:var(--font-b,system-ui,sans-serif);-webkit-font-smoothing:antialiased;
 display:flex;align-items:center;justify-content:center;text-align:center;padding:34px 20px;
 background-image:radial-gradient(ellipse at 50% -10%,rgba(201,168,76,.13),transparent 62%)}
.box{width:100%;max-width:660px}
img.logo{height:56px;width:auto;display:block;margin:0 auto 18px}
h1{font-family:var(--font-brand,inherit);font-weight:700;text-transform:uppercase;color:#fff;
 font-size:clamp(1.55rem,5.4vw,2.7rem);letter-spacing:.14em;line-height:1.2;margin:0 0 10px}
.sub{font-size:.74rem;letter-spacing:.34em;text-transform:uppercase;color:#c9a84c;margin:0 0 26px}
.cd{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.u{flex:1 1 0;min-width:74px;max-width:132px;background:rgba(255,255,255,.04);
 border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:14px 8px}
.n{font-family:var(--font-brand,inherit);font-weight:700;color:#fff;line-height:1;
 font-size:clamp(1.7rem,6vw,2.6rem);font-variant-numeric:tabular-nums}
.l{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(240,236,229,.42);margin-top:6px}
.done{font-family:var(--font-brand,inherit);font-size:1.1rem;color:#c9a84c;
 letter-spacing:.18em;text-transform:uppercase;margin:0}
</style>
</head>
<body>
<div class="box">
  <img class="logo" src="/logo.png" alt="SHOCK Male Grooming" draggable="false"/>
  <h1>It&#39;s time to SHOCK</h1>
  <p class="sub">Evoluzione in corso</p>
  <div class="cd" id="cd"></div>
</div>
<script>
(function(){
  var target=new Date(${JSON.stringify(iso)}).getTime();
  var el=document.getElementById('cd'), timer=null;
  var U=[['Giorni',86400000],['Ore',3600000],['Minuti',60000],['Secondi',1000]];
  function draw(){
    var d=target-Date.now();
    if(!(d>0)){el.innerHTML='<p class="done">Ci siamo.</p>';if(timer)clearInterval(timer);return;}
    var h='';
    for(var i=0;i<U.length;i++){
      var v=Math.floor(d/U[i][1]); d-=v*U[i][1];
      h+='<div class="u"><div class="n">'+(v<10?'0':'')+v+'</div><div class="l">'+U[i][0]+'</div></div>';
    }
    el.innerHTML=h;
  }
  draw(); timer=setInterval(draw,1000);
})();
</script>
</body>
</html>`;
}
