const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
};

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
  const { fulfillment_orders } = await foResp.json();
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
    return labelJson({ error: "Shopify: " + msg }, 502);
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
    return labelJson({
      ok: true,
      addresses,
      methods_total: methods.length,
      methods_it_home: itHome.length,
      sample: itHome.slice(0, 3).map((m) => m.name),
    });
  } catch (e) {
    return labelJson({ ok: false, error: String(e).slice(0, 200) });
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
  if (!oResp.ok) return labelJson({ error: "Ordine non trovato su Shopify" }, 502);
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
    return labelJson({ error: "Nessun indirizzo mittente configurato su Sendcloud. Aggiungi una sede di partenza nel pannello Sendcloud." }, 502);
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
    return labelJson({ error: "Sendcloud (opzioni): " + msg }, 502);
  }
  const options = soJson.data || [];
  const home = options.filter((o) => o.functionalities && o.functionalities.last_mile === "home_delivery");
  const chosen = home[0] || options[0];
  if (!chosen) {
    return labelJson({ error: "Nessun metodo di spedizione a domicilio disponibile su Sendcloud per questa destinazione. Attiva un corriere (es. Poste/BRT) con consegna a domicilio." }, 502);
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
    return labelJson({ error: "Sendcloud: " + msg }, 502);
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
      const { fulfillment_orders } = await foResp.json();
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
