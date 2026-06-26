(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,33525,(e,t,r)=>{"use strict";Object.defineProperty(r,"__esModule",{value:!0}),Object.defineProperty(r,"warnOnce",{enumerable:!0,get:function(){return o}});let o=e=>{}},18967,(e,t,r)=>{"use strict";Object.defineProperty(r,"__esModule",{value:!0});var o={DecodeError:function(){return h},MiddlewareNotFoundError:function(){return b},MissingStaticPage:function(){return P},NormalizeError:function(){return S},PageNotFoundError:function(){return E},SP:function(){return g},ST:function(){return y},WEB_VITALS:function(){return s},execOnce:function(){return a},getDisplayName:function(){return f},getLocationOrigin:function(){return c},getURL:function(){return l},isAbsoluteUrl:function(){return u},isResSent:function(){return d},loadGetInitialProps:function(){return p},normalizeRepeatedSlashes:function(){return m},stringifyError:function(){return C}};for(var n in o)Object.defineProperty(r,n,{enumerable:!0,get:o[n]});let s=["CLS","FCP","FID","INP","LCP","TTFB"];function a(e){let t,r=!1;return(...o)=>(r||(r=!0,t=e(...o)),t)}let i=/^[a-zA-Z][a-zA-Z\d+\-.]*?:/,u=e=>i.test(e);function c(){let{protocol:e,hostname:t,port:r}=window.location;return`${e}//${t}${r?":"+r:""}`}function l(){let{href:e}=window.location,t=c();return e.substring(t.length)}function f(e){return"string"==typeof e?e:e.displayName||e.name||"Unknown"}function d(e){return e.finished||e.headersSent}function m(e){let t=e.split("?");return t[0].replace(/\\/g,"/").replace(/\/\/+/g,"/")+(t[1]?`?${t.slice(1).join("?")}`:"")}async function p(e,t){let r=t.res||t.ctx&&t.ctx.res;if(!e.getInitialProps)return t.ctx&&t.Component?{pageProps:await p(t.Component,t.ctx)}:{};let o=await e.getInitialProps(t);if(r&&d(r))return o;if(!o)throw Object.defineProperty(Error(`"${f(e)}.getInitialProps()" should resolve to an object. But found "${o}" instead.`),"__NEXT_ERROR_CODE",{value:"E1025",enumerable:!1,configurable:!0});return o}let g="u">typeof performance,y=g&&["mark","measure","getEntriesByName"].every(e=>"function"==typeof performance[e]);class h extends Error{}class S extends Error{}class E extends Error{constructor(e){super(),this.code="ENOENT",this.name="PageNotFoundError",this.message=`Cannot find module for page: ${e}`}}class P extends Error{constructor(e,t){super(),this.message=`Failed to load static file for page: ${e} ${t}`}}class b extends Error{constructor(){super(),this.code="ENOENT",this.message="Cannot find the middleware module"}}function C(e){return JSON.stringify({message:e.message,stack:e.stack})}},98183,(e,t,r)=>{"use strict";Object.defineProperty(r,"__esModule",{value:!0});var o={assign:function(){return u},searchParamsToUrlQuery:function(){return s},urlQueryToSearchParams:function(){return i}};for(var n in o)Object.defineProperty(r,n,{enumerable:!0,get:o[n]});function s(e){let t={};for(let[r,o]of e.entries()){let e=t[r];void 0===e?t[r]=o:Array.isArray(e)?e.push(o):t[r]=[e,o]}return t}function a(e){return"string"==typeof e?e:("number"!=typeof e||isNaN(e))&&"boolean"!=typeof e?"":String(e)}function i(e){let t=new URLSearchParams;for(let[r,o]of Object.entries(e))if(Array.isArray(o))for(let e of o)t.append(r,a(e));else t.set(r,a(o));return t}function u(e,...t){for(let r of t){for(let t of r.keys())e.delete(t);for(let[t,o]of r.entries())e.append(t,o)}return e}},80860,e=>{"use strict";var t=e.i(43476),r=e.i(71645);let o="shock-male-grooming.myshopify.com",n="0a215f25881fcbcbd0a0a7d8405b7ff6",s=`https://${o}/api/2024-01/graphql.json`;async function a(e,t){return(await fetch(s,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Storefront-Access-Token":n},body:JSON.stringify({query:e,variables:t})})).json()}async function i(e){let t=await a(`
    query searchProduct($query: String!) {
      products(first: 1, query: $query) {
        edges {
          node {
            variants(first: 1) {
              edges { node { id } }
            }
          }
        }
      }
    }
  `,{query:`title:${e}`}),r=t?.data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node?.id;if(!r)return void alert(`Prodotto "${e}" non ancora disponibile. Torna presto!`);let o=await a(`
    mutation cartCreate($variantId: ID!) {
      cartCreate(input: { lines: [{ quantity: 1, merchandiseId: $variantId }] }) {
        cart { checkoutUrl }
        userErrors { message }
      }
    }
  `,{variantId:r}),n=o?.data?.cartCreate?.cart?.checkoutUrl;n?window.location.href=n:alert("Errore nel checkout. Riprova.")}async function u(e,t){let r=await a(`
    mutation login($email: String!, $password: String!) {
      customerAccessTokenCreate(input: { email: $email, password: $password }) {
        customerAccessToken { accessToken expiresAt }
        customerUserErrors { message }
      }
    }
  `,{email:e,password:t}),o=r?.data?.customerAccessTokenCreate;if(o?.customerUserErrors?.length)throw Error(o.customerUserErrors[0].message);let n=o?.customerAccessToken?.accessToken;return n&&(localStorage.setItem("shopify_token",n),localStorage.setItem("shopify_email",e)),n}async function c(e,t,r,o,n){let s=await a(`
    mutation register($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id email }
        customerUserErrors { message }
      }
    }
  `,{input:{firstName:e,lastName:t,email:r,password:o,phone:n||void 0,acceptsMarketing:!1}}),i=s?.data?.customerCreate;if(i?.customerUserErrors?.length)throw Error(i.customerUserErrors[0].message);await u(r,o)}async function l(e){let t=await a(`
    query getCustomer($token: String!) {
      customer(customerAccessToken: $token) {
        firstName lastName email
        orders(first: 5, sortKey: PROCESSED_AT, reverse: true) {
          edges {
            node {
              name processedAt
              totalPrice { amount currencyCode }
              lineItems(first: 5) {
                edges { node { title quantity } }
              }
            }
          }
        }
      }
    }
  `,{token:e});return t?.data?.customer}function f(){localStorage.removeItem("shopify_token"),localStorage.removeItem("shopify_email")}let d=(0,r.createContext)({token:null,email:null,logout:()=>{},refreshAuth:()=>{}});e.s(["SHOPIFY_DOMAIN",0,o,"STOREFRONT_TOKEN",0,n,"ShopifyProvider",0,function({children:e}){let[o,n]=(0,r.useState)(()=>localStorage.getItem("shopify_token")),[s,a]=(0,r.useState)(()=>localStorage.getItem("shopify_email")),i=(0,r.useCallback)(()=>{n(localStorage.getItem("shopify_token")),a(localStorage.getItem("shopify_email"))},[]),u=(0,r.useCallback)(()=>{f(),n(null),a(null)},[]);return(0,t.jsx)(d.Provider,{value:{token:o,email:s,logout:u,refreshAuth:i},children:e})},"buyProduct",0,i,"customerLogin",0,u,"customerLogout",0,f,"customerRegister",0,c,"fetchCustomer",0,l,"shopifyFetch",0,a,"useShopify",0,()=>(0,r.useContext)(d)])}]);