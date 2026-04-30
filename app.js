document.addEventListener("DOMContentLoaded", function () {
  const days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const products = ["20L","20L Bajo Sodio","12L","12L Bajo Sodio","Soda vidrio","Soda plástico","Pago / Saldo","Otro"];
  const todayStr = () => new Date().toLocaleDateString("es-AR");
  const todayISO = () => new Date().toISOString().slice(0,10);
  function arToISO(d){
    if(!d) return "";
    const parts = d.split("/");
    if(parts.length !== 3) return d;
    return `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
  }
  function sameDate(moveDate, isoDate){ return arToISO(moveDate) === isoDate; }
  const money = n => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n||0));
  const el = id => document.getElementById(id);

  const users = {
    "giuli": { pass:"ivess2026", role:"admin", name:"Giuli" },
    "ivan": { pass:"reparto2026", role:"repartidor", name:"Iván" }
  };
  let currentUser = JSON.parse(sessionStorage.getItem("ivessUser") || "null");

  function isAdmin(){ return currentUser && currentUser.role === "admin"; }
  function isRepartidor(){ return currentUser && currentUser.role === "repartidor"; }

  function showLogin(){
    el("loginScreen").classList.remove("hidden");
    el("adminApp").classList.add("hidden");
  }
  function showAdminApp(){
    el("loginScreen").classList.add("hidden");
    el("adminApp").classList.remove("hidden");
  }
  function doLogin(){
    const u = (el("loginUser").value || "").trim().toLowerCase();
    const p = el("loginPass").value || "";
    if(users[u] && users[u].pass === p){
      currentUser = { user:u, role:users[u].role, name:users[u].name };
      sessionStorage.setItem("ivessUser", JSON.stringify(currentUser));
      showAdminApp();
      fillBase();
      renderAll();
      updatePriceHint();
      return;
    }
    el("loginError").textContent = "Usuario o clave incorrectos.";
  }
  function logout(){
    sessionStorage.removeItem("ivessUser");
    currentUser = null;
    showLogin();
  }

  const defaultPriceLists = {
    "1": { name:"Lista 1 - IVESS", prices: {"20L":9000,"20L Bajo Sodio":10000,"12L":6200,"12L Bajo Sodio":7500,"Soda vidrio":1200,"Soda plástico":1400,"Pago / Saldo":0,"Otro":0}},
    "2": { name:"Lista 2 - IVESS frío-calor", prices: {"20L":10000,"20L Bajo Sodio":11000,"12L":6500,"12L Bajo Sodio":7800,"Soda vidrio":1200,"Soda plástico":1400,"Pago / Saldo":0,"Otro":0}},
    "3": { name:"Lista 3 - Pirozi", prices: {"20L":8000,"20L Bajo Sodio":9000,"12L":6200,"12L Bajo Sodio":6800,"Soda vidrio":1200,"Soda plástico":1400,"Pago / Saldo":0,"Otro":0}}
  };

  const demo = {
    priceLists: defaultPriceLists,
    clients:[
      {id:"c1",code:"C001", cooler:"no", coolerDesc:"",name:"Marta Gómez",address:"French 1234",phone:"11-1111-1111",day:"Lunes",order:1,note:"Timbre 2B",priceList:"1"},
      {id:"c2",code:"C002", cooler:"no", coolerDesc:"",name:"Carnicería Los Primos",address:"Alsina 850",phone:"11-2222-2222",day:"Lunes",order:2,note:"Paga por MP",priceList:"1"},
      {id:"c3",code:"C003", cooler:"si", coolerDesc:"Equipo frío/calor blanco, en portería",name:"Edificio Mitre 455",address:"Mitre 455",phone:"11-3333-3333",day:"Miércoles",order:1,note:"Dejar en portería",priceList:"2"},
      {id:"c4",code:"C004", cooler:"no", coolerDesc:"",name:"Claudia Pérez",address:"Maipú 730",phone:"11-4444-4444",day:"Viernes",order:1,note:"20L bajo sodio",priceList:"3"}
    ],
    moves:[
      {id:"m1",clientId:"c1",date:todayStr(),type:"fiado",product:"20L",qty:1,pay:"Fiado",amount:9000,note:"Abona próxima visita"},
      {id:"m2",clientId:"c2",date:todayStr(),type:"venta",product:"Soda plástico",qty:6,pay:"Mercado Pago",amount:8400,note:""},
      {id:"m3",clientId:"c3",date:"29/04/2026",type:"fiado",product:"12L Bajo Sodio",qty:1,pay:"Fiado",amount:7800,note:""}
    ]
  };

  let state = JSON.parse(localStorage.getItem("ivessV3")) || demo;
  state.priceLists = state.priceLists || defaultPriceLists;
  state.clients = state.clients.map(c => ({code:"", priceList:"1", ...c}));
  state.moves = state.moves.map(m => ({qty:1, ...m}));
  const save = () => localStorage.setItem("ivessV3", JSON.stringify(state));

  function balance(id){
    let saldo = 0; // positivo = debe; negativo = saldo a favor
    state.moves.filter(m=>m.clientId===id).forEach(m=>{
      const amount = Number(m.amount || 0);
      if(m.type === "fiado") saldo += amount;
      if(m.type === "pago" || m.type === "venta") saldo -= amount;
    });
    return saldo;
  }
  function debt(c.id){
    return Math.max(0, balance(id));
  }
  function credit(id){
    return Math.max(0, -balance(id));
  }
  function balanceLabel(id){
    const d = debt(c.id);
    const c = credit(id);
    if(c > 0) return `<span class="credit">Saldo a favor: ${money(c)}</span>`;
    if(d > 0) return `<span class="debt">${money(d)}</span>`;
    return `<span class="ok">${money(0)}</span>`;
  }
  function client(id){ return state.clients.find(c=>c.id===id); }
  function findClient(idOrCode){ return state.clients.find(c=>c.id===idOrCode || String(c.code).toLowerCase()===String(idOrCode).toLowerCase()); }
  function priceListName(id){ return state.priceLists[id]?.name || "Lista sin nombre"; }
  function label(t){ return {venta:"Venta cobrada",fiado:"Fiado",pago:"Pago recibido",no_compra:"No compró / no estaba"}[t] || t; }

  function codeNumber(code){
    const match = String(code || "").match(/C(\d+)/i);
    return match ? Number(match[1]) : 0;
  }
  function generateNextCode(){
    const max = state.clients.reduce((m,c)=>Math.max(m, codeNumber(c.code)), 0);
    return "C" + String(max + 1).padStart(3, "0");
  }
  function updateCodePreview(){
    const input = el("clientCodePreview");
    if(input) input.value = generateNextCode();
  }

  function sortClients(arr, mode){
    const list = arr.slice();
    if(mode === "code") return list.sort((a,b)=>(a.code||"").localeCompare(b.code||"", "es", {numeric:true}) || a.name.localeCompare(b.name));
    if(mode === "name") return list.sort((a,b)=>a.name.localeCompare(b.name));
    if(mode === "debt") return list.sort((a,b)=>debt(b.id)-debt(a.id));
    return list.sort((a,b)=>days.indexOf(a.day)-days.indexOf(b.day)||Number(a.order)-Number(b.order));
  }

  function fillBase(){
    ["dashDay","routeDay","clientDay","sheetDay"].forEach(id=> el(id).innerHTML = days.map(d=>`<option>${d}</option>`).join(""));
    ["movProduct"].forEach(id=> el(id).innerHTML = products.map(p=>`<option>${p}</option>`).join(""));
    fillPriceListSelects();
    fillClients();
    el("todayLabel").innerHTML = `${todayStr()} <span class="role-pill">${currentUser ? currentUser.name : ""}</span>`; updateCodePreview();
  }
  function fillPriceListSelects(){
    const opts = Object.entries(state.priceLists).map(([id,l])=>`<option value="${id}">${l.name}</option>`).join("");
    el("clientPriceList").innerHTML = opts;
  }
  function fillClients(){
    const opts = sortClients(state.clients, "code").map(c=>`<option value="${c.id}">${c.code ? c.code+" · " : ""}${c.day} #${c.order} · ${c.name}</option>`).join("");
    ["movClient","portalClient"].forEach(id=> el(id).innerHTML = opts);
    fillInsertAfter();
  }

  function fillInsertAfter(){
    const day = el("clientDay") ? el("clientDay").value : "Lunes";
    const items = state.clients.filter(c=>c.day===day).sort((a,b)=>Number(a.order)-Number(b.order));
    const opts = [`<option value="">Al principio de la ruta</option>`].concat(
      items.map(c=>`<option value="${c.id}">Después de #${c.order} · ${c.code || ""} · ${c.name}</option>`)
    ).join("");
    if(el("clientInsertAfter")) el("clientInsertAfter").innerHTML = opts;
    updateCalculatedOrder();
  }

  function updateCalculatedOrder(){
    if(!el("clientInsertAfter") || !el("clientOrder")) return;
    const afterId = el("clientInsertAfter").value;
    if(!afterId){
      el("clientOrder").value = 1;
      return;
    }
    const prev = client(afterId);
    el("clientOrder").value = prev ? Number(prev.order || 0) + 1 : 1;
  }

  function recalcOrders(day){
    state.clients
      .filter(c=>c.day===day)
      .sort((a,b)=>Number(a.order)-Number(b.order))
      .forEach((c,i)=>c.order=i+1);
  }

  function getUnitPrice(clientId, product){
    const c = client(clientId);
    if(!c) return 0;
    return Number(state.priceLists[c.priceList]?.prices?.[product] || 0);
  }
  function updatePriceHint(){
    const c = client(el("movClient").value);
    const product = el("movProduct").value;
    const qty = Number(el("movQty").value || 1);
    if(!c){ el("priceHint").textContent = "Seleccioná cliente y producto para ver precio."; return; }
    const unit = getUnitPrice(c.id, product);
    const total = unit * qty;
    el("priceHint").textContent = `${c.name} usa ${priceListName(c.priceList)} · ${product}: ${money(unit)} x ${qty} = ${money(total)}`;
    if(el("movType").value === "pago"){
      el("movProduct").value = "Pago / Saldo";
      el("priceHint").textContent = `${c.name} · Pago de deuda: cargá manualmente el importe que te pagó. Deuda actual: ${money(debt(c.id))}${credit(c.id)>0 ? " · Saldo a favor: " + money(credit(c.id)) : ""}`;
      return;
    }
    if(el("movType").value !== "no_compra") el("movAmount").value = total;
  }

  function renderDashboard(){
    const today = todayStr();
    const sales = state.moves.filter(m=>m.date===today && (m.type==="venta"||m.type==="fiado")).reduce((s,m)=>s+Number(m.amount||0),0);
    const paid = state.moves.filter(m=>m.date===today && (m.type==="venta"||m.type==="pago")).reduce((s,m)=>s+Number(m.amount||0),0);
    const totalDebt = state.clients.reduce((s,c)=>s+debt(c.id),0);
    el("kpiSales").textContent = money(sales);
    el("kpiPaid").textContent = money(paid);
    el("kpiDebt").textContent = money(totalDebt);
    el("kpiClients").textContent = state.clients.length;
    renderTodayProducts();
    renderDashRoute();
    el("latestMovements").innerHTML = state.moves.slice().reverse().slice(0,7).map(m=>{
      const c = client(m.clientId) || {};
      return `<div class="move"><div><b>${label(m.type)}</b><small>${c.code ? c.code+" · " : ""}${c.name||"Cliente"} · ${m.date} · ${m.qty || 1} x ${m.product} · ${m.pay}</small></div><b class="${m.type==="fiado"?"debt":m.type==="pago"||m.type==="venta"?"ok":""}">${money(m.amount)}</b></div>`;
    }).join("") || "<p class='muted'>Sin movimientos.</p>";
  }
  function renderTodayProducts(){
    const today = todayStr();
    const map = {};
    state.moves.filter(m=>m.date===today && (m.type==="venta"||m.type==="fiado")).forEach(m=>{
      if(!map[m.product]) map[m.product] = {qty:0,total:0};
      map[m.product].qty += Number(m.qty || 1);
      map[m.product].total += Number(m.amount || 0);
    });
    const rows = Object.entries(map).sort((a,b)=>b[1].qty-a[1].qty);
    el("todayProducts").innerHTML = `<table><thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>${rows.map(([p,v])=>`<tr><td><b>${p}</b></td><td>${v.qty}</td><td>${money(v.total)}</td></tr>`).join("") || "<tr><td colspan='3'>Todavía no cargaste ventas hoy.</td></tr>"}</tbody></table>`;
  }
  function renderDashRoute(){
    const d = el("dashDay").value || "Lunes";
    const list = state.clients.filter(c=>c.day===d).sort((a,b)=>Number(a.order)-Number(b.order)).slice(0,8);
    el("dashRoute").innerHTML = list.map(c=>`<div class="move"><div><b>${c.code ? c.code+" · " : ""}#${c.order} ${c.name}</b><small>${c.address} · ${priceListName(c.priceList)}${c.cooler==="si" ? " · Frío/calor" : ""}</small></div><b>${balanceLabel(c.id)}</b></div>`).join("") || "<p class='muted'>Sin clientes para este día.</p>";
  }

  function renderRoute(){
    const d = el("routeDay").value || "Lunes";
    const q = (el("routeSearch").value || "").toLowerCase();
    const mode = el("routeSort").value;
    let items = state.clients.filter(c=>c.day===d && ((c.code||"")+c.name+c.address+c.phone).toLowerCase().includes(q));
    if(mode === "order") items = items.sort((a,b)=>Number(a.order)-Number(b.order)); else items = sortClients(items, mode);
    el("routeCards").innerHTML = items.map(c=>`<div class="client-card">
      <div class="top"><div><span class="code-badge">${c.code || "Sin código"}</span><span class="price-badge">${priceListName(c.priceList)}</span>${c.cooler==="si" ? `<span class="cooler-badge">Frío/calor</span>` : ""}<h3>#${c.order} ${c.name}</h3><p class="muted">${c.address}<br>${c.phone}</p></div><span class="badge">${c.day}</span></div>
      <p>Cuenta: ${balanceLabel(c.id)}</p>
      <p class="muted">${c.note||""}${c.cooler==="si" && c.coolerDesc ? "<br>Equipo: " + c.coolerDesc : ""}</p>
      <div class="actions"><button data-prefill="${c.id}|venta">Venta</button><button data-prefill="${c.id}|fiado">Fiado</button><button data-prefill="${c.id}|pago">Pago</button></div>
    </div>`).join("") || "<div class='card'>No hay clientes con ese filtro.</div>";
    document.querySelectorAll("[data-prefill]").forEach(btn=>btn.addEventListener("click", function(){ const [id,type]=this.dataset.prefill.split("|"); prefill(id,type); }));
  }

  function clientLink(id){
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("cliente", client(id)?.code || id);
    return url.toString();
  }
  async function copyText(text){
    try { await navigator.clipboard.writeText(text); alert("Link copiado"); }
    catch(e){ prompt("Copiá este link:", text); }
  }

  function renderClients(){
    const q = (el("clientSearch").value || "").toLowerCase();
    const mode = el("clientSort").value;
    const rows = sortClients(state.clients.filter(c=>((c.code||"")+c.name+c.address+c.phone+c.day).toLowerCase().includes(q)), mode);
    el("clientTable").innerHTML = `<table><thead><tr><th>Código</th><th>Día</th><th>Orden</th><th>Cliente</th><th>Lista</th><th>Frío/calor</th><th>Teléfono</th><th>Fiado</th><th>Link</th><th>Acción</th></tr></thead><tbody>${rows.map(c=>`<tr><td><b>${c.code||"-"}</b></td><td>${c.day}</td><td>${c.order}</td><td><b>${c.name}</b><br><small>${c.address}</small></td><td>${priceListName(c.priceList)}</td><td>${c.cooler==="si" ? "Sí" : "No"}${c.coolerDesc ? "<br><small>"+c.coolerDesc+"</small>" : ""}</td><td>${c.phone}</td><td>${balanceLabel(c.id)}</td><td><button class="link-row" data-link="${c.id}">Copiar link</button></td><td><button class="delete-row" data-delete="${c.id}">Eliminar</button></td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("[data-delete]").forEach(btn=>btn.addEventListener("click", function(){ deleteClient(this.dataset.delete); }));
    document.querySelectorAll("[data-link]").forEach(btn=>btn.addEventListener("click", function(){ copyText(clientLink(this.dataset.link)); }));
  }

  function renderDebts(){
    const rows = state.clients.map(c=>({...c,d:debt(c.id)})).filter(c=>c.d>0).sort((a,b)=>b.d-a.d);
    el("debtTotal").textContent = money(rows.reduce((s,c)=>s+c.d,0));
    el("debtCount").textContent = rows.length;
    el("maxDebt").textContent = money(rows[0]?.d || 0);
    el("debtTable").innerHTML = `<table><thead><tr><th>Código</th><th>Cliente</th><th>Día</th><th>Lista</th><th>Teléfono</th><th>Deuda</th></tr></thead><tbody>${rows.map(c=>`<tr><td><b>${c.code||"-"}</b></td><td><b>${c.name}</b></td><td>${c.day}</td><td>${priceListName(c.priceList)}</td><td>${c.cooler==="si" ? "Sí" : "No"}${c.coolerDesc ? "<br><small>"+c.coolerDesc+"</small>" : ""}</td><td>${c.phone}</td><td class="debt">${money(c.d)}</td></tr>`).join("") || "<tr><td colspan='6'>No hay fiados pendientes.</td></tr>"}</tbody></table>`;
  }

  function portalHTML(id, publicMode=false){
    const c = findClient(id);
    if(!c) return "<div class='public-card'><h2>Cliente no encontrado</h2><p>Consultanos por WhatsApp para verificar tu cuenta.</p></div>";
    const d = debt(c.id);
    const moves = state.moves.filter(m=>m.clientId===c.id).slice().reverse();
    const wrapperClass = publicMode ? "public-card" : "";
    return `<div class="${wrapperClass}">
      <div class="${publicMode ? "public-top" : "portal-banner"}">
        <div>
          <span class="code-badge">${c.code || "Sin código"}</span>
          <h2>Hola, ${c.name}</h2>
          <p class="muted">Este es el detalle actualizado de tu cuenta.</p>
          ${credit(c.id)>0 ? `<div class="public-debt credit">Saldo a favor: ${money(credit(c.id))}</div>` : `<div class="public-debt ${d>0?"debt":"ok"}">${d>0 ? "Debe: " + money(d) : money(0)}</div>`}
          <p class="muted">Dirección: ${c.address}</p>${c.cooler==="si" ? `<p class="muted">Equipo frío/calor: ${c.coolerDesc || "Sí"}</p>` : ""}
        </div>
        ${publicMode ? "<div class='public-logo'>IV</div>" : ""}
      </div>
      <div class="public-note">Si ya abonaste y todavía figura deuda, puede demorar hasta que el repartidor actualice el pago.</div>
      <h3>Movimientos</h3>
      ${moves.map(m=>`<div class="move"><div><b>${label(m.type)}</b><small>${m.date} · ${m.qty || 1} x ${m.product} · ${m.pay}${m.note?" · "+m.note:""}</small></div><b class="${m.type==="fiado"?"debt":m.type==="pago"||m.type==="venta"?"ok":""}">${money(m.amount)}</b></div>`).join("") || "<p class='muted'>Sin movimientos.</p>"}
    </div>`;
  }

  function renderPortal(){
    const id = el("portalClient").value;
    el("clientPortal").innerHTML = portalHTML(id, false);
  }

  function renderPrices(){
    const disabled = isAdmin() ? "" : "disabled";
    const note = isAdmin() ? "" : "<div class='locked-note'>Modo repartidor: podés ver las listas de precios, pero no modificarlas.</div>";
    el("priceLists").innerHTML = `${note}<div class="price-list-grid">${Object.entries(state.priceLists).map(([listId,list])=>`
      <div class="price-list">
        <h3>${list.name}</h3>
        ${products.map(p=>`<div class="price-row"><span>${p}</span><input type="number" value="${list.prices[p] || 0}" data-price-list="${listId}" data-product="${p}" ${disabled}></div>`).join("")}
      </div>`).join("")}</div>`;
    el("savePricesBtn").disabled = !isAdmin();
    el("savePricesBtn").textContent = isAdmin() ? "Guardar precios" : "Solo Giuli puede modificar precios";
  }
  function savePrices(){
    if(!isAdmin()){
      alert("Solo el usuario admin puede modificar listas de precios.");
      return;
    }
    document.querySelectorAll("[data-price-list]").forEach(inp=>{
      const listId = inp.dataset.priceList;
      const product = inp.dataset.product;
      state.priceLists[listId].prices[product] = Number(inp.value || 0);
    });
    save();
    renderAll();
    updatePriceHint();
    alert("Precios guardados");
  }

  function addMovement(){
    state.moves.push({
      id:"m"+Date.now(),
      clientId:el("movClient").value,
      date:todayStr(),
      type:el("movType").value,
      product:el("movProduct").value,
      qty:Number(el("movQty").value || 1),
      pay:el("movPay").value,
      amount:Number(el("movAmount").value || 0),
      note:el("movNote").value
    });
    save();
    el("movAmount").value = "";
    el("movNote").value = "";
    el("movQty").value = 1;
    renderAll();
    updatePriceHint();
    alert("Movimiento guardado");
  }

  function addClient(){
    if(!isAdmin()){
      alert("Solo Giuli/admin puede agregar clientes.");
      return;
    }
    const selectedDay = el("clientDay").value;
    const afterId = el("clientInsertAfter").value;
    let newOrder = 1;
    if(afterId){
      const prev = client(afterId);
      newOrder = prev ? Number(prev.order || 0) + 1 : 1;
    }
    state.clients
      .filter(c=>c.day===selectedDay && Number(c.order) >= newOrder)
      .forEach(c=>c.order = Number(c.order) + 1);

    state.clients.push({
      id:"c"+Date.now(),
      code:generateNextCode(),
      name:el("clientName").value || "Cliente",
      address:el("clientAddress").value,
      phone:el("clientPhone").value,
      day:selectedDay,
      order:newOrder,
      priceList:el("clientPriceList").value,
      cooler:el("clientCooler").value,
      coolerDesc:el("clientCoolerDesc").value,
      note:el("clientNote").value
    });
    recalcOrders(selectedDay);
    save();
    ["clientName","clientAddress","clientPhone","clientOrder","clientNote","clientCoolerDesc"].forEach(id=>el(id).value=""); el("clientCooler").value="no"; updateCodePreview();
    fillClients();
    fillInsertAfter();
    renderAll();
    alert("Cliente agregado");
  }

  function deleteClient(id){
    const c = client(id);
    if(!confirm(`¿Eliminar a ${c?.name || "este cliente"}? También se borrarán sus movimientos y fiados.`)) return;
    state.clients = state.clients.filter(c=>c.id!==id);
    state.moves = state.moves.filter(m=>m.clientId!==id);
    save(); fillClients(); renderAll();
  }

  function prefill(id,type){
    openView("cargar");
    el("movClient").value = id;
    el("movType").value = type;
    el("movPay").value = "Efectivo";
    if(type === "pago") el("movProduct").value = "Pago / Saldo";
    updatePriceHint();
    el("movAmount").focus();
  }

  function applyRolePermissions(){
    const canCreateClients = isAdmin();
    const fields = ["clientCodePreview","clientName","clientAddress","clientPhone","clientDay","clientOrder","clientPriceList","clientCooler","clientCoolerDesc","clientNote"];
    fields.forEach(id=>{
      const node = el(id);
      if(node) node.disabled = !canCreateClients;
    });
    if(el("saveClientBtn")){
      el("saveClientBtn").disabled = !canCreateClients;
      el("saveClientBtn").textContent = canCreateClients ? "Agregar cliente" : "Solo Giuli puede agregar clientes";
    }
    if(el("clientAdminOnlyNote")){
      el("clientAdminOnlyNote").classList.toggle("hidden", canCreateClients);
    }
    document.querySelectorAll(".admin-only").forEach(node=>node.classList.toggle("hidden", !isAdmin()));
    if(!isAdmin() && document.getElementById("ventas")?.classList.contains("active")){
      openView("dashboard");
    }
  }

  function openView(viewName){
    document.querySelectorAll(".nav,.view").forEach(x=>x.classList.remove("active"));
    document.querySelector(`.nav[data-view="${viewName}"]`).classList.add("active");
    el(viewName).classList.add("active");
    const titles = {
      dashboard:["Panel general","Resumen de ventas, cobros, fiados y productos vendidos."],
      ruta:["Ruta del día","Clientes ordenados por día y atención."],
      hoja:["Hoja de ruta","Vista rápida para celular y reparto."],
      cargar:["Cargar movimiento","El precio se completa según cliente y lista asignada."],
      clientes:["Clientes","Alta, búsqueda, códigos, listas de precio y links individuales."],
      fiados:["Fiados","Deudas pendientes por cliente."],
      ventas:["Venta general","Reporte diario para comparar contra remitos."],
      precios:["Listas de precios","IVESS, IVESS frío-calor y Pirozi."],
      portal:["Vista cliente","Pantalla limpia para compartir deuda e historial."]
    };
    el("viewTitle").textContent = titles[viewName][0];
    el("viewSubtitle").textContent = titles[viewName][1];
    renderAll();
  }

  
  function renderRouteSheet(){
    if(!el("routeSheet")) return;
    const d = el("sheetDay").value || "Lunes";
    const q = (el("sheetSearch").value || "").toLowerCase();
    const items = state.clients
      .filter(c=>c.day===d && ((c.code||"")+c.name+c.address+c.phone).toLowerCase().includes(q))
      .sort((a,b)=>Number(a.order)-Number(b.order));
    el("routeSheet").innerHTML = items.map(c=>`
      <div class="sheet-card">
        <span class="code-badge">${c.code || "Sin código"}</span>
        ${c.cooler==="si" ? `<span class="cooler-badge">Frío/calor</span>` : ""}
        <h3>#${c.order} · ${c.name}</h3>
        <div class="sheet-meta">
          📍 ${c.address || "-"}<br>
          ☎ ${c.phone || "-"}<br>
          💰 ${balanceLabel(c.id)}<br>
          ${c.note ? "📝 " + c.note + "<br>" : ""}
          ${c.cooler==="si" && c.coolerDesc ? "❄️ " + c.coolerDesc : ""}
        </div>
        <div class="sheet-actions">
          <button data-prefill="${c.id}|venta">Venta</button>
          <button data-prefill="${c.id}|fiado">Fiado</button>
          <button data-prefill="${c.id}|pago">Pago</button>
        </div>
      </div>`).join("") || "<div class='card'>No hay clientes para este día.</div>";
    document.querySelectorAll("[data-prefill]").forEach(btn=>btn.addEventListener("click", function(){
      const [id,type]=this.dataset.prefill.split("|");
      prefill(id,type);
    }));
  }

  function renderSales(){
    if(!el("salesDate")) return;
    const iso = el("salesDate").value || todayISO();
    const moves = state.moves.filter(m=>sameDate(m.date, iso));
    const soldMoves = moves.filter(m=>m.type==="venta" || m.type==="fiado");
    const paidMoves = moves.filter(m=>m.type==="venta" || m.type==="pago");
    const debtMoves = moves.filter(m=>m.type==="fiado");
    const totalSold = soldMoves.reduce((s,m)=>s+Number(m.amount||0),0);
    const totalPaid = paidMoves.reduce((s,m)=>s+Number(m.amount||0),0);
    const totalDebt = debtMoves.reduce((s,m)=>s+Number(m.amount||0),0);
    el("salesTotal").textContent = money(totalSold);
    el("salesPaid").textContent = money(totalPaid);
    el("salesDebt").textContent = money(totalDebt);
    el("salesMoves").textContent = moves.length;

    const prodMap = {};
    soldMoves.forEach(m=>{
      if(!prodMap[m.product]) prodMap[m.product] = {qty:0,total:0};
      prodMap[m.product].qty += Number(m.qty || 1);
      prodMap[m.product].total += Number(m.amount || 0);
    });
    const prodRows = Object.entries(prodMap);
    el("salesProducts").innerHTML = `<table><thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>${prodRows.map(([p,v])=>`<tr><td><b>${p}</b></td><td>${v.qty}</td><td>${money(v.total)}</td></tr>`).join("") || "<tr><td colspan='3'>Sin ventas para esta fecha.</td></tr>"}</tbody></table>`;

    const payMap = {};
    moves.forEach(m=>{
      const pay = m.pay || "-";
      if(!payMap[pay]) payMap[pay] = 0;
      if(m.type==="venta" || m.type==="pago") payMap[pay] += Number(m.amount || 0);
    });
    const payRows = Object.entries(payMap);
    el("salesPays").innerHTML = `<table><thead><tr><th>Medio</th><th>Total cobrado</th></tr></thead><tbody>${payRows.map(([p,t])=>`<tr><td><b>${p}</b></td><td>${money(t)}</td></tr>`).join("") || "<tr><td colspan='2'>Sin cobros para esta fecha.</td></tr>"}</tbody></table>`;

    el("salesTable").innerHTML = `<table><thead><tr><th>Hora/fecha</th><th>Cliente</th><th>Tipo</th><th>Producto</th><th>Cant.</th><th>Medio</th><th>Importe</th><th>Nota</th></tr></thead><tbody>${moves.map(m=>{
      const c = client(m.clientId) || {};
      return `<tr><td>${m.date}</td><td><b>${c.code || ""} ${c.name || "Cliente"}</b></td><td>${label(m.type)}</td><td>${m.product}</td><td>${m.qty || 1}</td><td>${m.pay || "-"}</td><td>${money(m.amount)}</td><td>${m.note || ""}</td></tr>`;
    }).join("") || "<tr><td colspan='8'>Sin movimientos para esta fecha.</td></tr>"}</tbody></table>`;
  }

  function renderAll(){ renderDashboard(); renderRoute(); renderRouteSheet(); renderClients(); renderDebts(); renderSales(); renderPortal(); renderPrices(); updateCodePreview(); applyRolePermissions(); }

  function bootPublicIfNeeded(){
    const params = new URLSearchParams(window.location.search);
    const publicClientId = params.get("cliente");
    if(publicClientId){
      el("adminApp").classList.add("hidden");
      el("publicPortal").classList.remove("hidden");
      el("publicPortalContent").innerHTML = portalHTML(publicClientId, true);
      return true;
    }
    return false;
  }

  document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click", function(){ openView(this.dataset.view); }));
  ["dashDay","routeDay","routeSearch","routeSort","sheetDay","sheetSearch","clientSearch","clientSort","portalClient","salesDate","clientDay","clientInsertAfter"].forEach(id=>{
    el(id).addEventListener("input", renderAll);
    el(id).addEventListener("change", renderAll);
  });
  ["movClient","movProduct","movQty","movType"].forEach(id=>{
    el(id).addEventListener("input", updatePriceHint);
    el(id).addEventListener("change", updatePriceHint);
  });

  if(el("salesDate")) el("salesDate").value = todayISO();
  if(el("todaySalesBtn")) el("todaySalesBtn").addEventListener("click", function(){ el("salesDate").value = todayISO(); renderAll(); });
  el("saveMovementBtn").addEventListener("click", addMovement);
  el("saveClientBtn").addEventListener("click", addClient);
  el("savePricesBtn").addEventListener("click", savePrices);
  el("copyPortalLinkBtn").addEventListener("click", ()=> copyText(clientLink(el("portalClient").value)));
  el("resetDemoBtn").addEventListener("click", function(){
    localStorage.removeItem("ivessV3");
    state = JSON.parse(JSON.stringify(demo));
    save();
    fillBase();
    renderAll();
    alert("Demo reiniciada");
  });

  el("loginBtn").addEventListener("click", doLogin);
  el("loginPass").addEventListener("keydown", function(e){ if(e.key === "Enter") doLogin(); });
  el("loginUser").addEventListener("keydown", function(e){ if(e.key === "Enter") doLogin(); });
  el("logoutBtn").addEventListener("click", logout);

  if(bootPublicIfNeeded()){
    return;
  }

  if(currentUser){
    showAdminApp();
    fillBase();
    renderAll();
    updatePriceHint();
  } else {
    showLogin();
  }
});
