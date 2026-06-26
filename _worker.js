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
          priceRange { minVariantPrice { amount } }
          images(first: 1) { edges { node { url } } }
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
  const data = await resp.json();
  const products = (data.data?.products?.edges || []).map(({ node: p }) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description || "",
    productType: p.productType || "",
    price: p.priceRange?.minVariantPrice?.amount || "0",
    image: p.images?.edges?.[0]?.node?.url || null,
  }));
  return new Response(JSON.stringify({ products }), {
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
