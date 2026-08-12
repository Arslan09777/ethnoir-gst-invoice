const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, ''); } }
loadEnv(path.join(root, '.env'));
let oauthAccessToken = null;
let oauthShop = null;
const appUrl = (process.env.APP_URL || 'https://ethnoir-gst-invoice.onrender.com').replace(/\/$/, '');
const redirectUri = process.env.SHOPIFY_REDIRECT_URI || `${appUrl}/auth/callback`;
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function shopifyOrders() {
  const shop = oauthShop || process.env.SHOPIFY_SHOP, token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || oauthAccessToken;
  if (!shop || !token) throw new Error('Shopify connection is not configured. Open /auth to connect your Shopify store.');
  const query = `query { orders(first: 25, query: "financial_status:paid", reverse: true, sortKey: PROCESSED_AT) { nodes { id name processedAt shippingAddress { name phone address1 address2 city province provinceCode zip country } lineItems(first: 100) { nodes { title sku quantity variant { inventoryItem { harmonizedSystemCode } } originalUnitPriceSet { shopMoney { amount } } discountedUnitPriceSet { shopMoney { amount } } } } } } }`;
  const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query }) });
  const payload = await response.json(); if (!response.ok || payload.errors) throw new Error(payload.errors?.[0]?.message || `Shopify request failed (${response.status}).`); return payload.data.orders.nodes;
}
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/auth') {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const shop = process.env.SHOPIFY_SHOP;
    if (!apiKey || !shop) return json(res, 500, { error: 'SHOPIFY_API_KEY and SHOPIFY_SHOP are missing in Render Environment Variables.' });
    const state = crypto.randomBytes(24).toString('hex');
    res.writeHead(302, { 'Set-Cookie': `shopify_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`, Location: `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(apiKey)}&scope=${encodeURIComponent(process.env.SHOPIFY_SCOPES || 'read_orders,read_products')}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}` });
    return res.end();
  }
  if (url.pathname === '/auth/callback') {
    const params = url.searchParams;
    const callbackShop = params.get('shop');
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')));
    if (!params.get('code') || !params.get('state') || params.get('state') !== cookies.shopify_oauth_state) return json(res, 400, { error: 'Shopify authorization state is invalid or expired.' });
    if (!callbackShop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(callbackShop)) return json(res, 400, { error: 'Shopify shop domain is invalid.' });
    try {
      const response = await fetch(`https://${callbackShop}/admin/oauth/access_tokens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.SHOPIFY_API_KEY, client_secret: process.env.SHOPIFY_API_SECRET, code: params.get('code') }) });
      const responseText = await response.text();
      let payload; try { payload = JSON.parse(responseText); } catch { throw new Error(`Shopify token exchange returned an unexpected response (${response.status}).`); }
      if (!response.ok || !payload.access_token) throw new Error(payload.errors || `Token exchange failed (${response.status}).`);
      oauthAccessToken = payload.access_token;
      oauthShop = callbackShop;
      res.writeHead(302, { 'Set-Cookie': 'shopify_oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/', Location: '/?shopify=connected' });
      return res.end();
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (url.pathname === '/api/health') return json(res, 200, { configured: Boolean((oauthShop || process.env.SHOPIFY_SHOP) && (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || oauthAccessToken)), shop: oauthShop || process.env.SHOPIFY_SHOP || null });
  if (url.pathname === '/api/orders') { if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' }); try { return json(res, 200, { orders: await shopifyOrders() }); } catch (error) { return json(res, 400, { error: error.message }); } }
  const safePath = url.pathname === '/' ? '/public/index.html' : url.pathname, file = path.normalize(path.join(root, safePath));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('Ethnoir GST Invoice app: http://localhost:3000'));
