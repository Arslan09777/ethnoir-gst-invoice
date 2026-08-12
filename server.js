const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, ''); } }
loadEnv(path.join(root, '.env'));
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function shopifyOrders() {
  const shop = process.env.SHOPIFY_SHOP, token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!shop || !token) throw new Error('Shopify connection is not configured. Add SHOPIFY_SHOP and SHOPIFY_ADMIN_ACCESS_TOKEN to .env.');
  const query = `query { orders(first: 25, query: "financial_status:paid", reverse: true, sortKey: PROCESSED_AT) { nodes { id name processedAt shippingAddress { provinceCode } lineItems(first: 100) { nodes { title sku quantity originalUnitPriceSet { shopMoney { amount } } discountedUnitPriceSet { shopMoney { amount } } } } } } }`;
  const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query }) });
  const payload = await response.json(); if (!response.ok || payload.errors) throw new Error(payload.errors?.[0]?.message || `Shopify request failed (${response.status}).`); return payload.data.orders.nodes;
}
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') return json(res, 200, { configured: Boolean(process.env.SHOPIFY_SHOP && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN), shop: process.env.SHOPIFY_SHOP || null });
  if (url.pathname === '/api/orders') { if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' }); try { return json(res, 200, { orders: await shopifyOrders() }); } catch (error) { return json(res, 400, { error: error.message }); } }
  const safePath = url.pathname === '/' ? '/public/index.html' : url.pathname, file = path.normalize(path.join(root, safePath));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('Ethnoir GST Invoice app: http://localhost:3000'));

