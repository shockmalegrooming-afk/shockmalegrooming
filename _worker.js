const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
};

export default {
  async fetch(request, env) {
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

  // Scegli automaticamente un metodo di spedizione a domicilio per il paese di destinazione
  const pkgWeight = parseFloat(weight || "1") || 1;
  const dest = (sa.country_code || "IT").toUpperCase();
  const smResp = await fetch("https://panel.sendcloud.sc/api/v2/shipping_methods", { headers: { Authorization: auth } });
  const smJson = await smResp.json().catch(() => ({}));
  const methods = smJson.shipping_methods || [];
  const home = methods.filter((mm) =>
    (mm.service_point_input === "none" || !mm.service_point_input) &&
    (mm.countries || []).some((c) => (c.iso_2 || "").toUpperCase() === dest)
  );
  const fit = home.find((mm) => pkgWeight >= parseFloat(mm.min_weight || "0") && pkgWeight <= parseFloat(mm.max_weight || "1000"));
  const chosen = fit || home[0] || methods[0];
  if (!chosen) {
    return labelJson({ error: "Nessun metodo di spedizione disponibile su Sendcloud. Attiva un corriere (es. Poste) con consegna a domicilio." }, 502);
  }

  const parcelBody = {
    parcel: {
      name: `${sa.first_name || ""} ${sa.last_name || ""}`.trim() || order.email,
      company_name: sa.company || "",
      address: address || sa.address1 || "",
      house_number: house,
      address_2: sa.address2 || "",
      city: sa.city || "",
      postal_code: sa.zip || "",
      country: sa.country_code || "IT",
      telephone: sa.phone || order.phone || "",
      email: order.email || "",
      weight: String(weight || "1"),
      length: String(length || ""),
      width: String(width || ""),
      height: String(height || ""),
      order_number: order.name || String(order.order_number || orderId),
      request_label: true,
      shipment: { id: chosen.id },
      sender_address: senderAddressId ? Number(senderAddressId) : undefined,
      total_order_value: order.total_price,
      total_order_value_currency: order.currency,
    },
  };

  const scResp = await fetch("https://panel.sendcloud.sc/api/v2/parcels", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify(parcelBody),
  });
  const scText = await scResp.text();
  let scJson = {};
  try { scJson = JSON.parse(scText); } catch (e) {}
  if (!scResp.ok) {
    const msg = (scJson.error && scJson.error.message) || scText.slice(0, 300) || "Errore Sendcloud";
    return labelJson({ error: "Sendcloud: " + msg }, 502);
  }
  const parcel = scJson.parcel || {};
  const tracking = parcel.tracking_number || "";
  const trackingUrl = parcel.tracking_url || "";
  const carrier = (parcel.carrier && parcel.carrier.code) || "";

  // 2) Scarica il PDF dell'etichetta
  let labelB64 = "";
  const labelUrl = parcel.label && ((parcel.label.normal_printer && parcel.label.normal_printer[0]) || parcel.label.label_printer);
  if (labelUrl) {
    const lResp = await fetch(labelUrl, { headers: { Authorization: auth } });
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
