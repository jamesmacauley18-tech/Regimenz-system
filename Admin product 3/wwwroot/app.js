const $ = (q)=>document.querySelector(q); const $$=(q)=>Array.from(document.querySelectorAll(q));
$$('.tab-btn').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(t=>t.classList.remove('active'));$('#'+b.dataset.tab).classList.add('active');}));

const fxEl = $('#fx_rate');
let cart = {}; // sku -> qty
let products = [];

async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function postJSON(url, body){ const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function postCSV(url, file){ const text = await file.text(); const r = await fetch(url, {method:'POST', body: text}); if(!r.ok) throw new Error(await r.text()); return r.json(); }

async function loadProducts(){
  products = await getJSON('/api/products');
  renderProducts();
  refreshLowStock();
}

function renderProducts(){
  const tb = $('#products_table tbody'); tb.innerHTML='';
  products.forEach(p=>{
    const qty = cart[p.sku]||0;
    const lineRev = qty * (p.priceUsd||0);
    const lineCogs = qty * (p.costUsd||0);
    const lineProfit = lineRev - lineCogs;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.sku}</td>
      <td>${p.name}</td>
      <td>${p.qtyOnHand}</td>
      <td>${p.costCny.toFixed(2)}</td>
      <td>${p.costUsd.toFixed(2)}</td>
      <td><input type="number" step="0.01" class="price_usd" data-sku="${p.sku}" value="${(p.priceUsd||0).toFixed(2)}"/></td>
      <td>${(p.priceLeone||0).toFixed(2)}</td>
      <td class="qty">
        <button class="minus" data-sku="${p.sku}">–</button>
        <span>${qty}</span>
        <button class="plus" data-sku="${p.sku}">+</button>
      </td>
      <td>${lineProfit.toFixed(2)} USD</td>
    `;
    tb.appendChild(tr);
  });
  bindRowEvents();
  recalcTotals();
}

function bindRowEvents(){
  $$('#products_table .minus').forEach(btn=>btn.addEventListener('click',()=>{
    const sku = btn.dataset.sku;
    cart[sku] = Math.max(0,(cart[sku]||0)-1); renderProducts();
  }));
  $$('#products_table .plus').forEach(btn=>btn.addEventListener('click',()=>{
    const sku = btn.dataset.sku;
    cart[sku] = (cart[sku]||0)+1; renderProducts();
  }));
  $$('#products_table .price_usd').forEach(inp=>inp.addEventListener('change', async ()=>{
    const sku = inp.dataset.sku;
    const p = products.find(x=>x.sku===sku);
    p.priceUsd = parseFloat(inp.value||'0');
    // update server copy
    await postJSON('/api/products', p);
    await loadProducts();
  }));
}

function recalcTotals(){
  let rev=0,cogs=0;
  for(const sku in cart){
    const qty = cart[sku];
    const p = products.find(x=>x.sku===sku);
    rev += qty * (p.priceUsd||0);
    cogs += qty * (p.costUsd||0);
  }
  const profit = rev - cogs;
  const fx = parseFloat(fxEl.value||'0');
  $('#rev_usd').textContent = rev.toFixed(2);
  $('#cogs_usd').textContent = cogs.toFixed(2);
  $('#profit_usd').textContent = profit.toFixed(2);
  $('#profit_leone').textContent = (profit*fx).toFixed(2);
}

fxEl.addEventListener('change', recalcTotals);

$('#save_sale').addEventListener('click', async ()=>{
  // build sale lines
  const lines = [];
  for(const sku in cart){
    const qty = cart[sku];
    const p = products.find(x=>x.sku===sku);
    lines.push({
      productId: p.id, sku: p.sku, name: p.name, qty,
      unitPriceUsd: p.priceUsd||0, unitPriceLeone: (p.priceLeone||0),
      costUsdAtSale: p.costUsd||0
    });
  }
  const sale = await postJSON('/api/sales', {
    id:"", date:new Date().toISOString(), cashierId:"EMP-001",
    totalUsd:0,totalLeone:0, fxUsdToNLe: parseFloat(fxEl.value||'0'), lines
  });
  const advice = sale.verdict;
  const li = document.createElement('li');
  li.textContent = `Sale: Profit ${advice.profitUsd.toFixed(2)} USD, Margin ${advice.marginPct}% — ${advice.message}`;
  $('#advisor_list').prepend(li);

  cart = {};
  await loadProducts();
});

// Attendance
$('#clockForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const staffId = $('#att_staff_id').value.trim();
  const pin = $('#att_pin').value.trim();
  const action = $('#att_action').value;
  await getJSON(`/api/attendance/clock?staffId=${encodeURIComponent(staffId)}&pin=${encodeURIComponent(pin)}&action=${encodeURIComponent(action)}&workstationId=POS-1`);
  const list = await getJSON('/api/attendance/today');
  const ul = $('#attendance_list'); ul.innerHTML='';
  list.forEach(a=>{
    const li = document.createElement('li');
    li.innerHTML = `<span class="badge">${a.action==='clock_in'?'Clocked IN':'Clocked OUT'}</span> — ${a.staffId} at ${new Date(a.time).toLocaleTimeString()}`;
    ul.appendChild(li);
  });
  $('#att_pin').value='';
});

// Low stock
async function refreshLowStock(){
  const alerts = await getJSON('/api/alerts/low-stock');
  const ul = $('#low_stock_list'); ul.innerHTML='';
  alerts.forEach(x=>{
    const li = document.createElement('li');
    li.textContent = `${x.sku} — ${x.name}: ${x.qtyOnHand} left (reorder ≤ ${x.reorderThreshold})`;
    ul.appendChild(li);
  });
}

// CSV upload
$('#upload_csv').addEventListener('click', async ()=>{
  const f = $('#csv_file').files[0]; if(!f) { alert('Choose a CSV first'); return; }
  await postCSV('/api/products/import-csv', f);
  await loadProducts();
});

// init
loadProducts();

// ===== Live Monitor Logic =====
const liveFeed = document.getElementById('live_feed');
const liveProductsTable = document.getElementById('live_products_table')?.getElementsByTagName('tbody')[0];
let liveProducts = [];
let liveSales = [];

async function loadLiveMonitor() {
  // Fetch latest sales and product activity
  try {
    const [sales, prods] = await Promise.all([
      getJSON('/api/sales/live'),
      getJSON('/api/products')
    ]);
    liveSales = sales;
    liveProducts = prods;
    renderLiveFeed();
    renderLiveProducts();
  } catch (e) {
    if(liveFeed) liveFeed.innerHTML = '<li style="color:#c00;">Live data unavailable.</li>';
    if(liveProductsTable) liveProductsTable.innerHTML = '';
  }
}

function renderLiveFeed() {
  if(!liveFeed) return;
  liveFeed.innerHTML = '';
  (liveSales||[]).slice(-30).reverse().forEach(sale => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="badge">${sale.cashierId||'User'}</span> sold <b>${sale.lines.map(l=>l.qty+ '× '+l.name).join(', ')}</b> for <span style='color:#7D3AC1;'>${sale.totalLeone||0} NLe</span> <small style='color:#888;'>@ ${new Date(sale.date).toLocaleTimeString()}</small>`;
    liveFeed.appendChild(li);
  });
}

function renderLiveProducts() {
  if(!liveProductsTable) return;
  liveProductsTable.innerHTML = '';
  (liveProducts||[]).forEach(p => {
    const lastSale = (liveSales||[]).filter(s=>s.lines.some(l=>l.sku===p.sku)).slice(-1)[0];
    const sold = (liveSales||[]).reduce((sum,s)=>sum+s.lines.filter(l=>l.sku===p.sku).reduce((a,b)=>a+b.qty,0),0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.sku}</td><td>${p.name}</td><td>${p.qtyOnHand}</td><td>${sold}</td><td>${lastSale?new Date(lastSale.date).toLocaleTimeString():'—'}</td>`;
    liveProductsTable.appendChild(tr);
  });
}

// Poll every 5 seconds when on monitor tab
setInterval(()=>{
  if(document.querySelector('.tab-btn[data-tab="monitor"]')?.classList.contains('active')){
    loadLiveMonitor();
  }
}, 5000);

// ===== Auth handling =====
function getApiKey(){ return localStorage.getItem('reg_api_key')||''; }
function getRole(){ return localStorage.getItem('reg_role')||'Guest'; }
function setRoleDisplay(){ $('#role_display').textContent = 'Role: ' + getRole(); }
$('#login_btn').addEventListener('click', ()=>{
  const key = $('#api_key').value.trim();
  const role = $('#role_select').value;
  if(!key){ alert('Enter key'); return; }
  localStorage.setItem('reg_api_key', key);
  localStorage.setItem('reg_role', role);
  setRoleDisplay();
  alert('Saved. Refresh products to apply permissions.');
});
setRoleDisplay();

async function getJSONAuth(url){
  const r = await fetch(url, { headers: { 'X-Auth-Key': getApiKey() }});
  if(!r.ok) throw new Error(await r.text()); return r.json();
}
async function postJSONAuth(url, body){
  const r = await fetch(url, { method:'POST', headers: { 'Content-Type':'application/json', 'X-Auth-Key': getApiKey() }, body: JSON.stringify(body) });
  if(!r.ok) throw new Error(await r.text()); return r.json();
}
async function postCSVAuth(url, file){
  const text = await file.text();
  const r = await fetch(url, { method:'POST', headers: { 'X-Auth-Key': getApiKey() }, body: text });
  if(!r.ok) throw new Error(await r.text()); return r.json();
}

// Override previous helpers
getJSON = getJSONAuth;
postJSON = postJSONAuth;
postCSV = postCSVAuth;

// ===== PDF buttons =====
$('#pdf_sales').addEventListener('click', ()=>{
  const d = $('#report_date').value || new Date().toISOString().slice(0,10);
  window.open(`/api/reports/daily-sales.pdf?date=${d}`, '_blank');
});
$('#pdf_att').addEventListener('click', ()=>{
  const d = $('#report_date').value || new Date().toISOString().slice(0,10);
  window.open(`/api/reports/attendance.pdf?date=${d}`, '_blank');
});
$('#pdf_low').addEventListener('click', ()=>{
  window.open(`/api/reports/low-stock.pdf`, '_blank');
});

// ===== Pricing AI =====
$('#run_ai').addEventListener('click', async ()=>{
  const m = parseFloat($('#target_margin').value||'25');
  const items = await getJSON(`/api/pricing/ai?targetMarginPct=${m}`);
  const ul = $('#ai_list'); ul.innerHTML='';
  items.forEach(x=>{
    const li = document.createElement('li');
    li.textContent = `${x.sku} — ${x.name}: Cost ${x.costUsd.toFixed(2)} USD → Suggest ${x.suggestPriceUsd.toFixed(2)} USD / ${x.suggestPriceNLe.toFixed(2)} NLe @ ${x.targetMarginPct}%`;
    ul.appendChild(li);
  });
});

// ===== Username/Password Login -> Token =====
$('#login_pw_btn').addEventListener('click', async ()=>{
  const u = $('#login_user').value.trim();
  const p = $('#login_pass').value.trim();
  if(!u || !p){ alert('Enter username and password'); return; }
  const r = await fetch(`/api/auth/login?username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`, {method:'POST'});
  if(!r.ok){ alert('Login failed'); return; }
  const j = await r.json();
  localStorage.setItem('reg_token', j.token);
  localStorage.setItem('reg_role', j.role);
  $('#role_display').textContent = 'Role: ' + j.role;
  alert('Logged in as ' + j.role);
});

function getToken(){ return localStorage.getItem('reg_token')||''; }

// Override auth helpers to include token if present
async function getJSON(url){
  const hdrs = {};
  const tok = getToken(); if(tok) hdrs['X-Auth-Token']=tok;
  const key = getApiKey(); if(key) hdrs['X-Auth-Key']=key;
  const r = await fetch(url, { headers: hdrs });
  if(!r.ok) throw new Error(await r.text()); return r.json();
}
async function postJSON(url, body){
  const hdrs = {'Content-Type':'application/json'};
  const tok = getToken(); if(tok) hdrs['X-Auth-Token']=tok;
  const key = getApiKey(); if(key) hdrs['X-Auth-Key']=key;
  const r = await fetch(url, { method:'POST', headers: hdrs, body: JSON.stringify(body) });
  if(!r.ok) throw new Error(await r.text()); return r.json();
}
async function postCSV(url, file){
  const hdrs = {};
  const tok = getToken(); if(tok) hdrs['X-Auth-Token']=tok;
  const key = getApiKey(); if(key) hdrs['X-Auth-Key']=key;
  const text = await file.text();
  const r = await fetch(url, { method:'POST', headers: hdrs, body: text });
  if(!r.ok) throw new Error(await r.text()); return r.json();
}

// ===== Barcode quick add (keyboard-wedge scanners or manual entry) =====
$('#add_barcode').addEventListener('click', ()=>{
  const code = $('#barcode_in').value.trim(); if(!code) return;
  const p = products.find(x=>x.barcode===code);
  if(!p){ alert('No product with barcode ' + code); return; }
  cart[p.sku] = (cart[p.sku]||0)+1;
  $('#barcode_in').value='';
  renderProducts();
});
$('#barcode_in').addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){ e.preventDefault(); $('#add_barcode').click(); }
});

// ===== Email low-stock alert =====
$('#send_low_email').addEventListener('click', async ()=>{
  const res = await postJSON('/api/alerts/send-low-stock-email', {});
  alert(res.sent ? ('Email sent. Items: ' + res.count) : res.message);
});
