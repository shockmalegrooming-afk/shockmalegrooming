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
