console.log("IVESS V9 importador masivo cargado");
const SUPABASE_URL = "https://czvlyqauxidoiykagsza.supabase.co";
const SUPABASE_KEY = "sb_publishable_X1FnC6SX7jG5fZU2EVDDOQ_Uc_GyKp0";
const supabaseDb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

document.addEventListener("DOMContentLoaded", function () {
  const days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const products = ["20L","20L Bajo Sodio","12L","12L Bajo Sodio","Soda vidrio","Soda plástico","Saborizada","PA","Soda descartable","Soda de medio","Pago / Saldo","Otro"];
  const users = {
    giuli:{pass:"ivess2026",role:"admin",name:"Giuli"},
    "160":{pass:"160",role:"repartidor",name:"Iván"}
  };
  const el = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n||0));
  const todayStr = () => new Date().toLocaleDateString("es-AR");
  const todayISO = () => new Date().toISOString().slice(0,10);
  function arToISO(d){ const p=String(d||"").split("/"); return p.length===3 ? `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}` : d; }
  function sameDate(moveDate, iso){ return arToISO(moveDate) === iso; }
  function uid(){ return "m" + Date.now() + Math.random().toString(16).slice(2); }

  const defaultPriceLists = {
    "1":{name:"Lista 1 - IVESS",prices:{"20L":9000,"20L Bajo Sodio":10000,"12L":6200,"12L Bajo Sodio":7500,"Soda vidrio":1200,"Soda plástico":1400,"Saborizada":0,"PA":0,"Soda descartable":0,"Soda de medio":0,"Pago / Saldo":0,"Otro":0}},
    "2":{name:"Lista 2 - IVESS frío-calor",prices:{"20L":10000,"20L Bajo Sodio":11000,"12L":6500,"12L Bajo Sodio":7800,"Soda vidrio":1200,"Soda plástico":1400,"Saborizada":0,"PA":0,"Soda descartable":0,"Soda de medio":0,"Pago / Saldo":0,"Otro":0}},
    "3":{name:"Lista 3 - Pirozi",prices:{"20L":8000,"20L Bajo Sodio":9000,"12L":6200,"12L Bajo Sodio":6800,"Soda vidrio":1200,"Soda plástico":1400,"Saborizada":0,"PA":0,"Soda descartable":0,"Soda de medio":0,"Pago / Saldo":0,"Otro":0}}
  };

  const demo = {
    priceLists: defaultPriceLists,
    clients:[
      {id:"c1",code:"C001",name:"Marta Gómez",address:"French 1234",phone:"11-1111-1111",day:"Lunes",order:1,note:"Timbre 2B",priceList:"1",cooler:"no",coolerDesc:""},
      {id:"c2",code:"C002",name:"Carnicería Los Primos",address:"Alsina 850",phone:"11-2222-2222",day:"Lunes",order:2,note:"Paga por MP",priceList:"1",cooler:"no",coolerDesc:""},
      {id:"c3",code:"C003",name:"Edificio Mitre 455",address:"Mitre 455",phone:"11-3333-3333",day:"Miércoles",order:1,note:"Portería",priceList:"2",cooler:"si",coolerDesc:"Equipo blanco en portería"}
    ],
    moves:[
      {id:"m1",clientId:"c1",date:todayStr(),type:"fiado",product:"20L",qty:1,pay:"Efectivo",amount:9000,note:"Fiado demo"}
    ]
  };

  let state = JSON.parse(localStorage.getItem("ivessStableV5") || "null") || demo;
  state.priceLists = state.priceLists || defaultPriceLists;
  state.clients = (state.clients||[]).map(c=>({code:"",city:"",priceList:"1",cooler:"no",coolerDesc:"",note:"",...c}));
  state.moves = (state.moves||[]).map(m=>({qty:1,pay:"Efectivo",note:"",...m}));
  const SESSION_MS = 2 * 60 * 60 * 1000; // 2 horas de inactividad
  function loadSession(){
    const raw = localStorage.getItem("ivessUserSession");
    if(!raw) return null;
    try{
      const s = JSON.parse(raw);
      if(Date.now() - Number(s.lastActivity || 0) > SESSION_MS){
        localStorage.removeItem("ivessUserSession");
        return null;
      }
      s.lastActivity = Date.now();
      localStorage.setItem("ivessUserSession", JSON.stringify(s));
      return s.user;
    }catch(e){
      localStorage.removeItem("ivessUserSession");
      return null;
    }
  }
  function saveSession(user){
    localStorage.setItem("ivessUserSession", JSON.stringify({user, lastActivity: Date.now()}));
  }
  function touchSession(){
    if(!currentUser) return;
    saveSession(currentUser);
  }
  let currentUser = loadSession();
  let routeModeIndex = Number(localStorage.getItem("ivessRouteModeIndex") || 0);
  let routeCart = JSON.parse(localStorage.getItem("ivessRouteCart") || "[]");
  let routePayments = JSON.parse(localStorage.getItem("ivessRoutePayments") || '[{"pay":"Efectivo","mode":"total","amount":0}]');
  routePayments = routePayments.map(p=>({pay:"Efectivo",mode:"otro",amount:0,...p}));
  const save = () => localStorage.setItem("ivessStableV5", JSON.stringify(state));

  function dbClientRowToState(row){
    return {
      id: row.id,
      code: row.code || "",
      name: row.name || "Cliente",
      address: row.address || "",
      city: row.city || row.ciudad || "",
      phone: row.phone || "",
      day: row.day || "Lunes",
      order: Number(row.order || 1),
      priceList: row.pricelist || row.priceList || "1",
      cooler: row.cooler || "no",
      coolerDesc: row.coolerdesc || "",
      note: row.note || ""
    };
  }
  function dbMoveRowToState(row){
    return {
      id: row.id,
      clientId: row.client_id,
      date: row.date || todayStr(),
      type: row.type || "venta",
      product: row.product || "Otro",
      qty: Number(row.qty || 1),
      pay: row.pay || "Efectivo",
      amount: Number(row.amount || 0),
      saleValue: Number(row.salevalue || row.saleValue || row.amount || 0),
      note: row.note || ""
    };
  }
  function clientToDbRow(c){
    return {
      code:c.code, name:c.name, address:c.address, city:c.city || "", phone:c.phone, day:c.day,
      order:Number(c.order||1), pricelist:c.priceList || "1", cooler:c.cooler || "no"
    };
  }
  function moveToDbRow(m){
    return {
      client_id:Number(m.clientId), date:m.date, type:m.type, product:m.product,
      qty:Number(m.qty||1), pay:m.pay || "", amount:Number(m.amount||0),
      salevalue:Number(m.saleValue ?? m.salevalue ?? m.amount ?? 0), note:m.note || ""
    };
  }
  async function cloudLoadData(){
    if(!supabaseDb) return false;
    try{
      let {data: clients, error: cErr} = await supabaseDb.from("clients").select("*").order("order", {ascending:true});
      if(cErr){ console.error("Supabase clients error", cErr); console.error("No pude leer clients en Supabase. Revisá RLS/permisos."); return false; }
      if(!clients || clients.length===0){
        const rows = demo.clients.map(clientToDbRow);
        const inserted = await supabaseDb.from("clients").insert(rows).select();
        if(inserted.error){ console.error("Supabase seed clients error", inserted.error); console.error("No pude crear clientes iniciales en Supabase."); return false; }
        clients = inserted.data || [];
      }
      state.clients = (clients || []).map(dbClientRowToState);
      let {data: moves, error: mErr} = await supabaseDb.from("moves").select("*").order("id", {ascending:true});
      if(mErr){ console.error("Supabase moves error", mErr); console.error("No pude leer moves en Supabase. Revisá RLS/permisos."); return false; }
      state.moves = (moves || []).map(dbMoveRowToState);
      save();
      return true;
    }catch(e){
      console.error("Supabase load exception", e);
      alert("Error conectando con Supabase.");
      return false;
    }
  }
  async function cloudInsertMove(m){
    if(!supabaseDb) return null;
    const row = moveToDbRow(m);
    const {data, error} = await supabaseDb.from("moves").insert([row]).select().single();
    if(error){ console.error("Supabase insert move error", error); alert("Se guardó local, pero NO en Supabase: " + error.message); return null; }
    return dbMoveRowToState(data);
  }
  async function cloudInsertClient(c){
    if(!supabaseDb) return null;
    const {data, error} = await supabaseDb.from("clients").insert([clientToDbRow(c)]).select().single();
    if(error){ console.error("Supabase insert client error", error); alert("No pude guardar cliente en Supabase: " + error.message); return null; }
    return dbClientRowToState(data);
  }
  async function cloudDeleteMove(id){
    if(!supabaseDb) return;
    const {error} = await supabaseDb.from("moves").delete().eq("id", Number(id));
    if(error){ console.error("Supabase delete move error", error); alert("No pude borrar en Supabase: " + error.message); }
  }
  async function cloudDeleteClient(id){
    if(!supabaseDb) return;
    await supabaseDb.from("moves").delete().eq("client_id", Number(id));
    const {error} = await supabaseDb.from("clients").delete().eq("id", Number(id));
    if(error){ console.error("Supabase delete client error", error); alert("No pude borrar cliente en Supabase: " + error.message); }
  }
  function isAdmin(){ return currentUser && currentUser.role==="admin"; }
  function isIvan(){ return currentUser && currentUser.role==="repartidor"; }
  function client(id){ return state.clients.find(c=>c.id===id); }
  function findClient(x){ return state.clients.find(c=>c.id===x || String(c.code).toLowerCase()===String(x).toLowerCase()); }
  function priceListName(id){ return state.priceLists[id]?.name || "Lista"; }
  function label(t){ return {venta:"Venta cobrada",fiado:"Fiado",pago:"Pago recibido",pago_info:"Detalle de pago",no_compra:"No compró / no estaba"}[t] || t; }
  function moveSaleValue(m){
    if(m.type==="venta" || m.type==="fiado"){
      return Number(m.saleValue ?? m.amount ?? 0);
    }
    return 0;
  }
  function balance(id){
    return state.moves.filter(m=>m.clientId===id).reduce((s,m)=>{
      const amount = Number(m.amount || 0);
      if(m.type==="fiado") return s + Number(m.saleValue ?? amount);
      if(m.type==="pago") return s - amount;
      if(m.type==="venta"){
        const saleValue = Number(m.saleValue ?? amount);
        const overpay = Math.max(0, amount - saleValue);
        return s - overpay;
      }
      return s;
    },0);
  }
  function debt(id){ return Math.max(0,balance(id)); }
  function credit(id){ return Math.max(0,-balance(id)); }
  function balanceLabel(id){ if(credit(id)>0) return `<span class="credit">Saldo a favor: ${money(credit(id))}</span>`; if(debt(id)>0) return `<span class="debt">${money(debt(id))}</span>`; return `<span class="ok">${money(0)}</span>`; }
  function canDeleteMove(m){ return isAdmin() || (isIvan() && m.date===todayStr()); }
  function codeNumber(code){ const m=String(code||"").match(/C(\d+)/i); return m?Number(m[1]):0; }
  function generateNextCode(){ const max=state.clients.reduce((n,c)=>Math.max(n,codeNumber(c.code)),0); return "C"+String(max+1).padStart(3,"0"); }

  function sortClients(arr, mode){
    const list=arr.slice();
    if(mode==="code") return list.sort((a,b)=>(a.code||"").localeCompare(b.code||"","es",{numeric:true}));
    if(mode==="name") return list.sort((a,b)=>a.name.localeCompare(b.name));
    if(mode==="debt") return list.sort((a,b)=>debt(b.id)-debt(a.id));
    return list.sort((a,b)=>days.indexOf(a.day)-days.indexOf(b.day)||Number(a.order)-Number(b.order));
  }

  function showLogin(){ el("loginScreen").classList.remove("hidden"); el("adminApp").classList.add("hidden"); }
  function showApp(){ el("loginScreen").classList.add("hidden"); el("adminApp").classList.remove("hidden"); }
  function login(){
    const u=(el("loginUser").value||"").trim().toLowerCase(), p=el("loginPass").value||"";
    if(users[u] && users[u].pass===p){ currentUser={user:u,...users[u]}; saveSession(currentUser); showApp(); initAdmin(); return; }
    el("loginError").textContent="Usuario o clave incorrectos.";
  }
  function logout(){ localStorage.removeItem("ivessUserSession"); currentUser=null; showLogin(); }

  function fillBase(){
    ["routeDay","sheetDay","clientDay"].forEach(id=>{ el(id).innerHTML=days.map(d=>`<option>${d}</option>`).join(""); });
    el("movProduct").innerHTML=products.map(p=>`<option>${p}</option>`).join("");
    el("clientPriceList").innerHTML=Object.entries(state.priceLists).map(([id,l])=>`<option value="${id}">${l.name}</option>`).join("");
    fillClients();
    el("salesDate").value=todayISO();
    el("todayLabel").innerHTML=`${todayStr()} <span class="role-pill">${currentUser?.name||""}</span>`;
    el("roleLabel").textContent = currentUser ? `${currentUser.name} · ${currentUser.role}` : "Sesión";
  }
  function fillClients(){
    const opts=sortClients(state.clients,"code").map(c=>`<option value="${c.id}">${c.code} · ${c.name}</option>`).join("");
    ["movClient","portalClient"].forEach(id=>el(id).innerHTML=opts);
    fillInsertAfter();
  }
  function fillInsertAfter(){
    const afterEl = el("clientInsertAfter");
    const dayEl = el("clientDay");
    if(!afterEl || !dayEl) return;

    const d = dayEl.value || "Lunes";
    const current = afterEl.value || "";

    const opts = state.clients
      .filter(c => c.day === d && String(c.id) !== String(editingClientId || ""))
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

    afterEl.innerHTML =
      `<option value="">Al principio de ${d}</option>` +
      opts.map(c=>`<option value="${c.id}">${c.order || ""} - ${c.code} - ${c.name}</option>`).join("");

    if([...afterEl.options].some(o=>o.value===current)){
      afterEl.value = current;
    }
  }
  function updateCalculatedOrder(){
    const id=el("clientInsertAfter").value;
    if(!id){ el("clientOrder").value=1; return; }
    const c=client(id); el("clientOrder").value = c ? Number(c.order)+1 : 1;
  }
  function recalcOrders(day){ state.clients.filter(c=>c.day===day).sort((a,b)=>Number(a.order)-Number(b.order)).forEach((c,i)=>c.order=i+1); }
  function updateCodePreview(){ el("clientCodePreview").value=generateNextCode(); }
  function getUnitPrice(clientId, product){ const c=client(clientId); return Number(state.priceLists[c?.priceList]?.prices?.[product] || 0); }
  function updatePriceHint(){
    const c=client(el("movClient").value), product=el("movProduct").value, qty=Number(el("movQty").value||1);
    if(!c) return;
    if(el("movType").value==="pago"){ el("movProduct").value="Pago / Saldo"; el("priceHint").textContent=`${c.name} · Pago de deuda manual. Deuda actual: ${money(debt(c.id))}${credit(c.id)>0 ? " · Saldo a favor: "+money(credit(c.id)) : ""}`; return; }
    const total=getUnitPrice(c.id,product)*qty;
    el("priceHint").textContent=`${c.name} · ${priceListName(c.priceList)} · ${product}: ${money(getUnitPrice(c.id,product))} x ${qty} = ${money(total)}. Si es venta cobrada, cargá lo que pagó; si paga exacto no genera saldo a favor.`;
    if(el("movType").value!=="no_compra") el("movAmount").value=total;
  }

  function renderDashboard(){
    const today=todayStr();
    const todayMoves=state.moves.filter(m=>m.date===today);
    el("kpiSales").textContent=money(todayMoves.filter(m=>(m.type==="venta"||m.type==="fiado") && m.product!=="Saldo pendiente").reduce((s,m)=>s+Number(m.saleValue ?? m.amount ?? 0),0));
    el("kpiPaid").textContent=money(todayMoves.filter(m=>m.type==="venta"||m.type==="pago").reduce((s,m)=>s+Number(m.amount||0),0));
    el("kpiDebt").textContent=money(state.clients.reduce((s,c)=>s+debt(c.id),0));
    el("kpiCredit").textContent=money(state.clients.reduce((s,c)=>s+credit(c.id),0));
    const prod={}; todayMoves.filter(m=>(m.type==="venta"||m.type==="fiado") && m.product!=="Saldo pendiente").forEach(m=>{prod[m.product]=prod[m.product]||{qty:0,total:0};prod[m.product].qty+=Number(m.qty||1);prod[m.product].total+=Number(m.saleValue ?? m.amount ?? 0);});
    el("todayProducts").innerHTML=table(["Producto","Cantidad","Total"],Object.entries(prod).map(([p,v])=>[p,v.qty,money(v.total)]),"Todavía no cargaste ventas hoy.");
    el("latestMovements").innerHTML=state.moves.slice().reverse().slice(0,8).map(moveRow).join("")||"<p class='muted'>Sin movimientos.</p>";
  }
  function renderRoute(){
    const d=el("routeDay").value||"Lunes", q=(el("routeSearch").value||"").toLowerCase(), mode=el("routeSort").value;
    let items=state.clients.filter(c=>c.day===d && (c.code+c.name+c.address+c.phone).toLowerCase().includes(q));
    items = mode==="order" ? items.sort((a,b)=>Number(a.order)-Number(b.order)) : sortClients(items,mode);
    el("routeCards").innerHTML=items.map(c=>clientCard(c)).join("")||"<div class='card'>Sin clientes.</div>";
    bindPrefill();
  }
  function clientCard(c){ return `<div class="client-card"><div class="top"><div><span class="code-badge">${c.code}</span><span class="price-badge">${priceListName(c.priceList)}</span>${c.cooler==="si"?`<span class="cooler-badge">Frío/calor</span>`:""}<h3>#${c.order} ${c.name}</h3><p class="muted">${c.address}<br>${c.phone}</p></div><span class="badge">${c.day}</span></div><p>Cuenta: ${balanceLabel(c.id)}</p><p class="muted">${c.note||""}${c.cooler==="si"&&c.coolerDesc?"<br>Equipo: "+c.coolerDesc:""}</p><div class="actions"><button data-prefill="${c.id}|venta">Venta</button><button data-prefill="${c.id}|fiado">Fiado</button><button data-prefill="${c.id}|pago">Pago</button></div></div>`; }
  
  function getRouteModeClients(){
    const d = el("sheetDay").value || "Lunes";
    const q = (el("sheetSearch").value || "").toLowerCase();
    return state.clients
      .filter(c=>c.day===d && (c.code+c.name+c.address+c.phone).toLowerCase().includes(q))
      .sort((a,b)=>Number(a.order)-Number(b.order));
  }
  function saveRouteModeState(){
    localStorage.setItem("ivessRouteModeIndex", String(routeModeIndex));
    localStorage.setItem("ivessRouteCart", JSON.stringify(routeCart));
    localStorage.setItem("ivessRoutePayments", JSON.stringify(routePayments));
  }
  function addQuickProduct(product){
    const c = getRouteModeClients()[routeModeIndex];
    if(!c) return;
    const existing = routeCart.find(i=>i.product===product);
    const unit = getUnitPrice(c.id, product);
    if(existing){
      existing.qty += 1;
      existing.total = existing.qty * unit;
    } else {
      routeCart.push({product, qty:1, unit, total:unit});
    }
    saveRouteModeState();
    renderRouteMode();
  }
  function removeCartItem(idx){
    routeCart.splice(idx,1);
    saveRouteModeState();
    renderRouteMode();
  }
  function updateCartQty(idx, qty){
    qty = Math.max(1, Number(qty || 1));
    if(!routeCart[idx]) return;
    routeCart[idx].qty = qty;
    routeCart[idx].total = qty * Number(routeCart[idx].unit || 0);
    saveRouteModeState();
    renderRouteMode();
  }
  function routeCartTotal(){
    return routeCart.reduce((s,i)=>s+Number(i.total||0),0);
  }
  function resolvedRoutePayments(){
    const total = routeCartTotal();
    let remaining = total;
    return routePayments.map((p,idx)=>{
      let amount = 0;
      if(p.mode === "total"){
        amount = Math.max(0, remaining);
      } else {
        amount = Number(p.amount || 0);
      }
      remaining = Math.max(0, remaining - amount);
      return {...p, amount};
    });
  }
  function routePaidTotal(){
    return resolvedRoutePayments().reduce((s,p)=>s+Number(p.amount||0),0);
  }
  function addRoutePayment(){
    routePayments.push({pay:"Efectivo", mode:"otro", amount:0});
    saveRouteModeState();
    renderRouteMode();
  }
  function removeRoutePayment(idx){
    if(routePayments.length <= 1) return;
    routePayments.splice(idx,1);
    saveRouteModeState();
    renderRouteMode();
  }
  function updateRoutePayment(idx, field, value){
    if(!routePayments[idx]) return;
    routePayments[idx][field] = field === "amount" ? Number(value || 0) : value;
    saveRouteModeState();
    renderRouteMode();
  }
  async function saveRouteCurrentIfNeeded(){
    const c = getRouteModeClients()[routeModeIndex];
    if(!c) return;
    const note = el("routeModeNote") ? el("routeModeNote").value : "";
    const total = routeCartTotal();
    const payments = resolvedRoutePayments().filter(p=>Number(p.amount||0)>0);
    const paid = payments.reduce((s,p)=>s+Number(p.amount||0),0);
    const newMovesToSync = [];
    function pushRouteMove(m){ state.moves.push(m); newMovesToSync.push(m); }

    if(el("routeModeNoCompra") && el("routeModeNoCompra").checked){
      pushRouteMove({id:uid(),clientId:c.id,date:todayStr(),type:"no_compra",product:"-",qty:0,pay:"-",amount:0,saleValue:0,note:note || "No compró / no estaba"});
    } else if(total > 0 || paid > 0){
      // Guarda productos vendidos. amount = cuánto se cobró aplicado a cada producto.
      let remainingPaidForItems = Math.min(paid, total);
      routeCart.forEach(item=>{
        const itemValue = Number(item.total||0);
        const paidApplied = Math.min(itemValue, remainingPaidForItems);
        remainingPaidForItems -= paidApplied;
        pushRouteMove({
          id:uid(),
          clientId:c.id,
          date:todayStr(),
          type:"venta",
          product:item.product,
          qty:Number(item.qty||1),
          pay: payments.length === 1 ? payments[0].pay : "Mixto",
          amount:paidApplied,
          saleValue:itemValue,
          note:note || "Venta modo reparto"
        });
      });

      // Si pagó menos que el total vendido, registra la diferencia como fiado.
      if(paid < total){
        pushRouteMove({
          id:uid(),
          clientId:c.id,
          date:todayStr(),
          type:"fiado",
          product:"Saldo pendiente",
          qty:1,
          pay:"-",
          amount:total-paid,
          saleValue:total-paid,
          note:note || "Diferencia fiada modo reparto"
        });
      }

      // Si pagó de más, registra el excedente como pago/saldo a favor.
      if(paid > total){
        const extra = paid - total;
        pushRouteMove({
          id:uid(),
          clientId:c.id,
          date:todayStr(),
          type:"pago",
          product:"Pago / Saldo",
          qty:1,
          pay: payments.length === 1 ? payments[0].pay : "Mixto",
          amount:extra,
          saleValue:0,
          note:note || "Saldo a favor modo reparto"
        });
      }

      // Guarda detalle de pagos si hay más de un medio o si querés ver cómo cobró.
      if(payments.length > 1){
        payments.forEach(p=>{
          state.moves.push({
            id:uid(),
            clientId:c.id,
            date:todayStr(),
            type:"pago_info",
            product:"Detalle de pago",
            qty:1,
            pay:p.pay,
            amount:Number(p.amount||0),
            saleValue:0,
            note:"Detalle informativo de cobro mixto"
          });
        });
      }
    }

    for(const m of newMovesToSync){ await cloudInsertMove(m); }
    save();
    routeCart = [];
    routePayments = [{pay:"Efectivo", mode:"total", amount:0}];
    if(el("routeModeNote")) el("routeModeNote").value = "";
    saveRouteModeState();
  }
  async function routeNext(){
    await saveRouteCurrentIfNeeded();
    const list = getRouteModeClients();
    routeModeIndex = Math.min(routeModeIndex + 1, Math.max(0, list.length - 1));
    saveRouteModeState();
    renderAll();
  }
  function routePrev(){
    routeModeIndex = Math.max(0, routeModeIndex - 1);
    saveRouteModeState();
    renderAll();
  }
  function renderRouteMode(){
    const list = getRouteModeClients();
    if(routeModeIndex >= list.length) routeModeIndex = Math.max(0, list.length - 1);
    saveRouteModeState();
    const c = list[routeModeIndex];
    if(!c){
      el("routeModeClient").innerHTML = "<div class='muted'>No hay clientes para esta hoja de ruta.</div>";
      return;
    }
    const quick = ["20L","20L Bajo Sodio","12L","12L Bajo Sodio","Soda vidrio","Soda plástico","Saborizada","PA","Soda descartable","Soda de medio"];
    const cartHtml = routeCart.length ? routeCart.map((i,idx)=>`
      <div class="cart-item">
        <b>${i.product}</b>
        <input type="number" min="1" value="${i.qty}" data-cart-qty="${idx}">
        <span>${money(i.total)}</span>
        <button data-cart-del="${idx}">×</button>
      </div>`).join("") : "<p class='muted'>Carrito vacío. Agregá productos con los botones rápidos.</p>";
    el("routeModeClient").innerHTML = `
      <div class="route-mode-card">
        <div class="route-mode-client">
          <span class="code-badge">${c.code}</span><span class="price-badge">${priceListName(c.priceList)}</span>${c.cooler==="si" ? `<span class="cooler-badge">Frío/calor</span>` : ""}
          <h2>#${c.order} · ${c.name}</h2>
          <p class="muted">📍 ${c.address || "-"}<br>☎ ${c.phone || "-"}<br>💰 ${balanceLabel(c.id)}</p>
        </div>
        <div class="quick-buttons">
          ${quick.map(p=>`<button data-quick-product="${p}">+ ${p}<br><small>${money(getUnitPrice(c.id,p))}</small></button>`).join("")}
        </div>
        <div class="cart-box">
          <h3>Carrito</h3>
          ${cartHtml}
          <div class="route-mode-total">Total: ${money(routeCartTotal())}</div>
        </div>
        <div class="payment-list">
          <h3>Pagos recibidos</h3>
          ${routePayments.map((p,idx)=>`
            <div class="payment-mode">
              <button data-pay-mode="${idx}|total" class="${p.mode==="total"?"active":""}">Pago total</button>
              <button data-pay-mode="${idx}|otro" class="${p.mode!=="total"?"active":""}">Otro importe</button>
            </div>
            <div class="payment-row">
              <select data-pay-method="${idx}">
                <option ${p.pay==="Efectivo"?"selected":""}>Efectivo</option>
                <option ${p.pay==="Mercado Pago"?"selected":""}>Mercado Pago</option>
                <option ${p.pay==="Transferencia"?"selected":""}>Transferencia</option>
              </select>
              <input type="number" value="${p.mode==="total" ? "" : (p.amount || "")}" placeholder="${p.mode==="total" ? "Total automático" : "Monto"}" data-pay-amount="${idx}" ${p.mode==="total" ? "disabled" : ""}>
              <button class="remove-pay" data-pay-remove="${idx}">×</button>
            </div>`).join("")}
          <button class="add-pay-btn" id="addPayBtn">+ Agregar otro medio</button>
          <div class="payment-help">Usá “Pago total” cuando paga todo con ese medio. Usá “Otro importe” para pagos parciales o mixtos.</div>
        </div>
        <div class="route-calc">
          Total vendido: <b>${money(routeCartTotal())}</b><br>
          Total cobrado: <b>${money(routePaidTotal())}</b><br>
          ${routeCartTotal() > routePaidTotal() ? `Queda fiado: <span class="debt">${money(routeCartTotal()-routePaidTotal())}</span>` : ""}
          ${routePaidTotal() > routeCartTotal() ? `Saldo a favor: <span class="credit">${money(routePaidTotal()-routeCartTotal())}</span>` : ""}
          ${routePaidTotal() === routeCartTotal() ? `<span class="ok">Cuenta en cero</span>` : ""}
        </div>
        <div class="route-mode-grid">
          <label class="wide">Nota
            <input id="routeModeNote" placeholder="Observación">
          </label>
          <label>No compró / no estaba
            <input id="routeModeNoCompra" type="checkbox">
          </label>
        </div>
        <div class="small-note">Al tocar “Siguiente” se guarda automáticamente: productos vendidos + pagos recibidos. La diferencia queda como fiado o saldo a favor.</div>
        <div class="route-nav">
          <button class="prev" id="routePrevBtn">← Anterior</button>
          <button class="next" id="routeNextBtn">Siguiente →</button>
        </div>
      </div>`;
    document.querySelectorAll("[data-quick-product]").forEach(b=>b.onclick=()=>addQuickProduct(b.dataset.quickProduct));
    document.querySelectorAll("[data-cart-del]").forEach(b=>b.onclick=()=>removeCartItem(Number(b.dataset.cartDel)));
    document.querySelectorAll("[data-cart-qty]").forEach(inp=>inp.onchange=()=>updateCartQty(Number(inp.dataset.cartQty), inp.value));
    document.querySelectorAll("[data-pay-mode]").forEach(btn=>btn.onclick=()=>{
      const [idx,mode] = btn.dataset.payMode.split("|");
      updateRoutePayment(Number(idx), "mode", mode);
    });
    document.querySelectorAll("[data-pay-method]").forEach(sel=>sel.onchange=()=>updateRoutePayment(Number(sel.dataset.payMethod), "pay", sel.value));
    document.querySelectorAll("[data-pay-amount]").forEach(inp=>{
      inp.onchange=()=>updateRoutePayment(Number(inp.dataset.payAmount), "amount", inp.value);
      inp.onblur=()=>updateRoutePayment(Number(inp.dataset.payAmount), "amount", inp.value);
    });
    document.querySelectorAll("[data-pay-remove]").forEach(btn=>btn.onclick=()=>removeRoutePayment(Number(btn.dataset.payRemove)));
    el("addPayBtn").onclick = addRoutePayment;
    el("routePrevBtn").onclick = routePrev;
    el("routeNextBtn").onclick = routeNext;
  }

  function renderRouteSheet(){
    const d=el("sheetDay").value||"Lunes", q=(el("sheetSearch").value||"").toLowerCase();
    const items=state.clients.filter(c=>c.day===d && (c.code+c.name+c.address+c.phone).toLowerCase().includes(q)).sort((a,b)=>Number(a.order)-Number(b.order));
    el("routeSheet").innerHTML=items.map(c=>`<div class="sheet-card"><span class="code-badge">${c.code}</span>${c.cooler==="si"?`<span class="cooler-badge">Frío/calor</span>`:""}<h3>#${c.order} · ${c.name}</h3><div class="sheet-meta">📍 ${c.address||"-"}${c.city?" - "+c.city:""}<br>☎ ${c.phone||"-"}<br>💰 ${balanceLabel(c.id)}${c.note?"<br>📝 "+c.note:""}${c.cooler==="si"&&c.coolerDesc?"<br>❄️ "+c.coolerDesc:""}</div><div class="sheet-actions"><button data-prefill="${c.id}|venta">Venta</button><button data-prefill="${c.id}|fiado">Fiado</button><button data-prefill="${c.id}|pago">Pago</button></div></div>`).join("")||"<div class='card'>Sin clientes.</div>";
    bindPrefill();
  }
  
  function cleanWhatsappPhone(phone){
    let p = String(phone || "").replace(/\D/g, "");
    if(!p) return "";
    // Argentina: si viene como 11..., agregamos 54. Para WhatsApp suele funcionar 549 + móvil.
    if(p.startsWith("0")) p = p.slice(1);
    if(p.startsWith("15") && p.length >= 10) p = "11" + p.slice(2);
    if(!p.startsWith("54")){
      if(p.startsWith("11") || p.length === 10){
        p = "549" + p;
      } else {
        p = "54" + p;
      }
    }
    return p;
  }

  function whatsappClientMessage(clientId){
    const c = client(clientId);
    if(!c) return "";
    const link = clientLink(c.id);
    const saldo = debt(c.id) > 0 ? `Actualmente figura una deuda de ${money(debt(c.id))}.` : (credit(c.id) > 0 ? `Actualmente tenés saldo a favor de ${money(credit(c.id))}.` : "Actualmente tu cuenta figura en $0.");
    return `Hola ${c.name}! Te compartimos tu link para consultar tu cuenta de IVESS:\\n\\n${link}\\n\\n${saldo}\\n\\nCualquier duda nos escribís por este medio.`;
  }

  
  function openWhatsappClient(clientId){
    let raw = String(clientId || "").trim();
    const codeFromLabel = raw.includes(" - ") ? raw.split(" - ")[0].trim() : raw;

    let c =
      client(raw) ||
      state.clients.find(x => String(x.id) === raw) ||
      state.clients.find(x => String(x.code) === raw) ||
      state.clients.find(x => String(x.code) === codeFromLabel);

    if(!c) return alert("Cliente no encontrado.");

    const phone = cleanWhatsappPhone(c.phone);
    if(!phone) return alert("Este cliente no tiene teléfono cargado.");

    const link = clientLink(c.id);

    const msg1 = encodeURIComponent(`Hola ${c.name}! 👋 Te compartimos tu link para que puedas ver tu cuenta, saldo y movimientos de IVESS.

Cualquier duda nos escribís por acá.`);
    const msg2 = encodeURIComponent(link);

    const url = `https://wa.me/${phone}?text=${msg1}`;

    // abre primer mensaje
    window.open(url, "_blank");

    // pequeño delay para abrir segundo mensaje
    setTimeout(()=>{
      window.open(`https://wa.me/${phone}?text=${msg2}`, "_blank");
    }, 800);
  }



function renderClients(){
    const q=(el("clientSearch").value||"").toLowerCase(), mode=el("clientSort").value;
    const rows=sortClients(
      state.clients.filter(c=>(c.code+c.name+c.address+(c.city||"")+c.phone+c.day).toLowerCase().includes(q)),
      mode
    );

    el("clientTable").innerHTML=table(
      ["Código","Día","Ciudad","Cliente","Lista","Frío/calor","Teléfono","Cuenta","Link","Acción"],
      rows.map(c=>[
        c.code,
        c.day,
        c.city || "",
        `<b>${c.name}</b><br><small>${c.address}</small>`,
        priceListName(c.priceList),
        `${c.cooler==="si"?"Sí":"No"}${c.coolerDesc?`<br><small>${c.coolerDesc}</small>`:""}`,
        c.phone,
        balanceLabel(c.id),
        `<button class="link-row" data-link="${c.id}">Copiar link</button><button class="wa-row" data-wa="${c.id}">WhatsApp</button>`,
        isAdmin()?`
          <button class="edit-row" data-edit="${c.id}">Editar</button>
          <button class="delete-row" data-delete="${c.id}">Eliminar</button>
        `:""
      ]),
      "Sin clientes."
    );

    document.querySelectorAll("[data-link]").forEach(b=>b.onclick=()=>copyText(clientLink(b.dataset.link)));
    document.querySelectorAll("[data-wa]").forEach(b=>b.onclick=()=>openWhatsappClient(b.dataset.wa));
    document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteClient(b.dataset.delete));
    document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>startEditClient(b.dataset.edit));
    fillInsertAfter();
  }
  function renderDebts(){
    const totalDebt=state.clients.reduce((s,c)=>s+debt(c.id),0), totalCredit=state.clients.reduce((s,c)=>s+credit(c.id),0);
    el("debtTotal").textContent=money(totalDebt); el("creditTotal").textContent=money(totalCredit); el("debtCount").textContent=state.clients.filter(c=>debt(c.id)>0).length;
    const clients=state.clients.filter(c=>debt(c.id)>0 || credit(c.id)>0).sort((a,b)=>debt(b.id)-debt(a.id));
    el("debtDetails").innerHTML=clients.map(c=>debtCard(c)).join("")||"<div class='card'>No hay fiados pendientes ni saldos a favor.</div>";
    bindDeleteMoves();
  }
  function debtCard(c){
    const ms=state.moves.filter(m=>m.clientId===c.id && (m.type==="fiado"||m.type==="pago"||m.type==="venta")).slice().reverse();
    const byDate={}; ms.forEach(m=>{byDate[m.date]=byDate[m.date]||[];byDate[m.date].push(m);});
    return `<div class="debt-card"><h3>${c.code} · ${c.name}</h3><p>Cuenta: ${balanceLabel(c.id)}</p>${Object.entries(byDate).map(([date,moves])=>`<div class="debt-sub"><h4>${date}</h4>${moves.map(moveRow).join("")}</div>`).join("")}</div>`;
  }
  function renderSales(){
    const iso=el("salesDate").value||todayISO(), ms=state.moves.filter(m=>sameDate(m.date,iso)), sold=ms.filter(m=>(m.type==="venta"||m.type==="fiado") && m.product!=="Saldo pendiente"), paid=ms.filter(m=>m.type==="venta"||m.type==="pago");
    el("salesTotal").textContent=money(sold.reduce((s,m)=>s+Number(m.saleValue ?? m.amount ?? 0),0));
    el("salesPaid").textContent=money(paid.reduce((s,m)=>s+Number(m.amount||0),0));
    el("salesDebt").textContent=money(ms.filter(m=>m.type==="fiado").reduce((s,m)=>s+Number(m.saleValue ?? m.amount ?? 0),0));
    el("salesMoves").textContent=ms.length;
    const prod={}, pays={}; sold.forEach(m=>{prod[m.product]=prod[m.product]||{qty:0,total:0};prod[m.product].qty+=Number(m.qty||1);prod[m.product].total+=Number(m.saleValue ?? m.amount ?? 0);}); paid.forEach(m=>{pays[m.pay]=Number(pays[m.pay]||0)+Number(m.amount||0);});
    el("salesProducts").innerHTML=table(["Producto","Cantidad","Total"],Object.entries(prod).map(([p,v])=>[p,v.qty,money(v.total)]),"Sin ventas para esta fecha.");
    el("salesPays").innerHTML=table(["Medio","Total cobrado"],Object.entries(pays).map(([p,t])=>[p,money(t)]),"Sin cobros para esta fecha.");
    el("salesTable").innerHTML=table(["Fecha","Cliente","Tipo","Producto","Cant.","Medio","Importe","Nota","Acción"],ms.map(m=>{const c=client(m.clientId)||{};return [m.date,`${c.code||""} ${c.name||""}`,label(m.type),m.product,m.qty||1,m.pay||"-",money(m.amount),m.note||"",canDeleteMove(m)?`<button class="move-delete" data-delmove="${m.id}">Eliminar</button>`:""]}),"Sin movimientos.");
    bindDeleteMoves();
  }
  function renderPrices(){
    const disabled=isAdmin()?"":"disabled";
    el("priceLists").innerHTML=`${isAdmin()?"":"<div class='locked-note'>Modo repartidor: podés ver precios, pero no modificarlos.</div>"}<div class="price-list-grid">${Object.entries(state.priceLists).map(([id,l])=>`<div class="price-list"><h3>${l.name}</h3>${products.map(p=>`<div class="price-row"><span>${p}</span><input type="number" value="${l.prices[p]||0}" data-price-list="${id}" data-product="${p}" ${disabled}></div>`).join("")}</div>`).join("")}</div>`;
    el("savePricesBtn").disabled=!isAdmin(); el("savePricesBtn").textContent=isAdmin()?"Guardar precios":"Solo Giuli puede modificar precios";
  }
  function renderPortal(){ el("clientPortal").innerHTML=portalHTML(el("portalClient").value,false); bindDeleteMoves(); }

  function moveRow(m){
    const c=client(m.clientId)||{};
    const can=canDeleteMove(m);
    const saleInfo = (m.type==="venta" && Number(m.amount||0) !== Number(m.saleValue ?? m.amount ?? 0)) ? ` · venta ${money(m.saleValue ?? 0)} / pagó ${money(m.amount)}` : "";
    return `<div class="move"><div><b>${label(m.type)}</b><small>${c.code?c.code+" · ":""}${c.name||""} · ${m.date} · ${m.qty||1} x ${m.product} · ${m.pay||"-"}${saleInfo}${m.note?" · "+m.note:""}</small></div><div><b class="${m.type==="fiado"?"debt":(m.type==="pago"||m.type==="venta"?"credit":"")}">${money(m.amount)}</b>${can?`<button class="move-delete" data-delmove="${m.id}">Eliminar</button>`:""}</div></div>`;
  }
  function table(headers, rows, empty){
    return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}">${empty}</td></tr>`}</tbody></table>`;
  }
  function portalHTML(id, publicMode){
    const c = state.clients.find(x => String(x.id) === String(id) || String(x.code) === String(id)); if(!c) return "<div class='public-card'><h2>Cliente no encontrado</h2><p>Consultanos por WhatsApp.</p></div>";
    const d=debt(c.id), cr=credit(c.id), ms=state.moves.filter(m=>m.clientId===c.id).slice().reverse();
    return `<div class="${publicMode?"public-card":""}"><div class="${publicMode?"public-top":"portal-banner"}"><div><span class="code-badge">${c.code}</span><h2>Hola, ${c.name}</h2><p class="muted">Este es el detalle actualizado de tu cuenta.</p>${cr>0?`<div class="public-debt credit">Saldo a favor: ${money(cr)}</div>`:`<div class="public-debt ${d>0?"debt":"ok"}">${d>0?"Debe: "+money(d):money(0)}</div>`}<p class="muted">Dirección: ${c.address}${c.city?" - "+c.city:""}</p>${c.cooler==="si"?`<p class="muted">Equipo frío/calor: ${c.coolerDesc||"Sí"}</p>`:""}</div>${publicMode?"<div class='public-logo'>IV</div>":""}</div><div class="public-note">Si ya abonaste y todavía figura deuda, puede demorar hasta que el repartidor actualice el pago.</div><h3>Movimientos</h3>${ms.map(moveRow).join("")||"<p class='muted'>Sin movimientos.</p>"}</div>`;
  }

  async function addMovement(){
    const movType = el("movType").value;
    const movClientId = el("movClient").value;
    const movProduct = el("movProduct").value;
    const movQty = Number(el("movQty").value||1);
    const enteredAmount = Number(el("movAmount").value||0);
    const calculatedSaleValue = (movType==="venta" || movType==="fiado") ? getUnitPrice(movClientId, movProduct) * movQty : 0;
    const newMove = {
      id:uid(),
      clientId:movClientId,
      date:todayStr(),
      type:movType,
      product:movProduct,
      qty:movQty,
      pay:el("movPay").value,
      amount:enteredAmount,
      saleValue: calculatedSaleValue || enteredAmount,
      note:el("movNote").value
    };
    const cloudMove = await cloudInsertMove(newMove);
    state.moves.push(cloudMove || newMove);
    save(); el("movAmount").value=""; el("movNote").value=""; el("movQty").value=1; renderAll(); updatePriceHint(); alert("Movimiento guardado");
  }
function refreshInsertAfterOptions(){
    const dayEl = el("clientDay");
    const afterEl = el("clientInsertAfter");
    if(!dayEl || !afterEl) return;
    const d = dayEl.value || "Lunes";
    const current = afterEl.value;
    const opts = state.clients
      .filter(c => c.day === d && String(c.id) !== String(editingClientId || ""))
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));
    afterEl.innerHTML = `<option value="">Al principio de ${d}</option>` + opts.map(c=>`<option value="${c.id}">${c.order}. ${c.code} - ${c.name}</option>`).join("");
    if([...afterEl.options].some(o=>o.value===current)) afterEl.value = current;
  }

  
  let editingClientId = null;

  function startEditClient(id){
    const c = state.clients.find(x=>String(x.id)===String(id));
    if(!c) return alert("Cliente no encontrado");

    editingClientId = String(c.id);

    if(el("clientName")) el("clientName").value = c.name || "";
    if(el("clientAddress")) el("clientAddress").value = c.address || "";
    if(el("clientCity")) el("clientCity").value = c.city || "";
    if(el("clientPhone")) el("clientPhone").value = c.phone || "";
    if(el("clientDay")) el("clientDay").value = c.day || "Lunes";
    if(el("clientPriceList")) el("clientPriceList").value = c.priceList || "1";
    if(el("clientCooler")) el("clientCooler").value = c.cooler || "no";
    if(el("clientCoolerDesc")) el("clientCoolerDesc").value = c.coolerDesc || "";
    if(el("clientNote")) el("clientNote").value = c.note || "";

    if(el("clientInsertAfter")){
      fillInsertAfter();
      el("clientInsertAfter").value = "";
    }

    if(el("saveClientBtn")) el("saveClientBtn").textContent = "Guardar cambios";
    alert("Editando cliente: " + c.name);
  }

  async function updateClientInCloud(c){
    if(typeof supabaseDb === "undefined" || !supabaseDb) return true;
    const payload = {
      code:c.code,
      name:c.name,
      address:c.address,
      city:c.city || "",
      phone:c.phone,
      day:c.day,
      order:Number(c.order||1),
      pricelist:c.priceList || "1",
      cooler:c.cooler || "no"
    };
    const { error } = await supabaseDb.from("clients").update(payload).eq("id", Number(c.id));
    if(error){
      console.error(error);
      alert("No pude actualizar el cliente en Supabase: " + error.message);
      return false;
    }
    return true;
  }


  async function updateRouteClientsInCloud(daysToUpdate){
    if(typeof supabaseDb === "undefined" || !supabaseDb) return true;
    const days = Array.from(new Set(daysToUpdate.filter(Boolean)));
    const clientsToUpdate = state.clients.filter(c=>days.includes(c.day));
    for(const c of clientsToUpdate){
      const { error } = await supabaseDb.from("clients").update({
        day: c.day,
        order: Number(c.order || 1),
        name: c.name,
        address: c.address,
        city: c.city || "",
        phone: c.phone,
        pricelist: c.priceList || "1",
        cooler: c.cooler || "no"
      }).eq("id", Number(c.id));
      if(error){
        console.error(error);
        alert("No pude actualizar el orden en Supabase.");
        return false;
      }
    }
    return true;
  }

  function placeClientAfter(clientToMove, targetDay, afterId){
    const oldDay = clientToMove.day;

    // Saca temporalmente al cliente de su lugar anterior para cerrar huecos.
    clientToMove.order = 999999;
    recalcOrders(oldDay);

    clientToMove.day = targetDay;

    let targetOrder = 1;
    if(afterId){
      const previous = state.clients.find(x=>String(x.id)===String(afterId));
      if(previous && previous.day === targetDay){
        targetOrder = Number(previous.order || 0) + 1;
      }
    }

    state.clients
      .filter(x=>x.day===targetDay && String(x.id)!==String(clientToMove.id) && Number(x.order||0)>=targetOrder)
      .forEach(x=>x.order = Number(x.order||0) + 1);

    clientToMove.order = targetOrder;
    recalcOrders(targetDay);

    return [oldDay, targetDay];
  }

async function addClient(){
    if(!isAdmin()) return alert("Solo Giuli/admin puede agregar clientes.");

    const selectedDay = el("clientDay").value || "Lunes";
    const afterId = el("clientInsertAfter") ? el("clientInsertAfter").value : "";

    if(editingClientId){
      const c = state.clients.find(x=>String(x.id)===String(editingClientId));
      if(!c) return alert("No encontré el cliente a editar");

      c.name = el("clientName").value || "Cliente";
      c.address = el("clientAddress").value || "";
      c.city = el("clientCity") ? el("clientCity").value || "" : "";
      c.phone = el("clientPhone").value || "";
      c.priceList = el("clientPriceList").value || "1";
      c.cooler = el("clientCooler").value || "no";
      c.coolerDesc = el("clientCoolerDesc").value || "";
      c.note = el("clientNote").value || "";

      const changedDays = placeClientAfter(c, selectedDay, afterId);

      const ok = await updateRouteClientsInCloud(changedDays);
      if(!ok) return;

      editingClientId = null;
      if(el("saveClientBtn")) el("saveClientBtn").textContent = "Agregar cliente";

      save();
      fillClients();
      renderAll();
      alert("Cliente actualizado y reubicado");
      return;
    }

    let newOrder = 1;
    if(afterId){
      const previous = state.clients.find(x=>String(x.id)===String(afterId));
      if(previous && previous.day === selectedDay){
        newOrder = Number(previous.order || 0) + 1;
      }
    }

    state.clients
      .filter(c=>c.day===selectedDay && Number(c.order || 0) >= newOrder)
      .forEach(c=>c.order = Number(c.order || 0) + 1);

    const newClient = {
      id:"c"+Date.now(),
      code:generateNextCode(),
      name:el("clientName").value || "Cliente",
      address:el("clientAddress").value,
      city:el("clientCity") ? el("clientCity").value : "",
      phone:el("clientPhone").value,
      day:selectedDay,
      order:newOrder,
      priceList:el("clientPriceList").value,
      cooler:el("clientCooler").value,
      coolerDesc:el("clientCoolerDesc").value,
      note:el("clientNote").value
    };

    const cloudClient = await cloudInsertClient(newClient);
    state.clients.push(cloudClient || newClient);

    recalcOrders(selectedDay);
    await updateRouteClientsInCloud([selectedDay]);

    save();

    ["clientName","clientAddress","clientCity","clientPhone","clientOrder","clientCoolerDesc","clientNote"].forEach(id=>{ if(el(id)) el(id).value=""; });
    if(el("clientCooler")) el("clientCooler").value="no";
    if(el("clientInsertAfter")) el("clientInsertAfter").value="";

    fillClients();
    renderAll();
    alert("Cliente agregado");
  }
  async function deleteClient(id){ const c=client(id); if(!isAdmin()) return; if(confirm(`¿Eliminar a ${c?.name}? También se borrarán sus movimientos.`)){ await cloudDeleteClient(id); state.clients=state.clients.filter(c=>c.id!==id); state.moves=state.moves.filter(m=>m.clientId!==id); save(); fillClients(); renderAll(); } }
  async function deleteMove(id){ const m=state.moves.find(x=>x.id==id); if(!m || !canDeleteMove(m)) return alert("No tenés permiso para borrar este movimiento."); const c=client(m.clientId)||{}; if(confirm(`¿Eliminar ${label(m.type)} de ${c.name} por ${money(m.amount)}?`)){ await cloudDeleteMove(id); state.moves=state.moves.filter(x=>x.id!=id); save(); renderAll(); } }
  function savePrices(){ if(!isAdmin()) return alert("Solo Giuli puede modificar precios."); document.querySelectorAll("[data-price-list]").forEach(inp=>{state.priceLists[inp.dataset.priceList].prices[inp.dataset.product]=Number(inp.value||0);}); save(); renderAll(); alert("Precios guardados"); }
  function prefill(id,type){ openView("cargar"); el("movClient").value=id; el("movType").value=type; el("movPay").value="Efectivo"; if(type==="pago") el("movProduct").value="Pago / Saldo"; updatePriceHint(); el("movAmount").focus(); }
  function bindPrefill(){ document.querySelectorAll("[data-prefill]").forEach(b=>b.onclick=()=>{const [id,type]=b.dataset.prefill.split("|"); prefill(id,type);}); }
  function bindDeleteMoves(){ document.querySelectorAll("[data-delmove]").forEach(b=>b.onclick=()=>deleteMove(b.dataset.delmove)); }
  function clientLink(id){ const c=client(id), u=new URL(window.location.href); u.search=""; u.hash=""; u.searchParams.set("cliente",c?.code||id); return u.toString(); }
  async function copyText(t){ try{ await navigator.clipboard.writeText(t); alert("Link copiado"); } catch(e){ prompt("Copiá este link:",t); } }

  
  function parseCsvText(text){
    const rows = [];
    let row = [], cell = "", inQuotes = false;
    for(let i=0;i<text.length;i++){
      const ch = text[i], next = text[i+1];
      if(ch === '"' && inQuotes && next === '"'){ cell += '"'; i++; continue; }
      if(ch === '"'){ inQuotes = !inQuotes; continue; }
      if(ch === "," && !inQuotes){ row.push(cell); cell = ""; continue; }
      if((ch === "\n" || ch === "\r") && !inQuotes){
        if(ch === "\r" && next === "\n") i++;
        row.push(cell); cell = "";
        if(row.some(v=>String(v).trim()!=="")) rows.push(row);
        row = [];
        continue;
      }
      cell += ch;
    }
    row.push(cell);
    if(row.some(v=>String(v).trim()!=="")) rows.push(row);
    if(!rows.length) return [];
    const headers = rows.shift().map(h=>String(h||"").trim().toLowerCase().replace(/^\ufeff/,""));
    return rows.map(r=>{
      const obj = {};
      headers.forEach((h,i)=>obj[h]=String(r[i]||"").trim());
      return obj;
    });
  }

  function normalizeImportDay(v){
    const x = String(v||"").trim().toUpperCase();
    const map = {LU:"Lunes",MA:"Martes",MI:"Miércoles",JU:"Jueves",VI:"Viernes",SA:"Sábado",DO:"Domingo"};
    if(map[x]) return map[x];
    const found = days.find(d=>d.toUpperCase()===x || d.toUpperCase().startsWith(x));
    return found || "Lunes";
  }

  function importNumber(v){
    const n = Number(String(v||"0").replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""));
    return Number.isFinite(n) ? n : 0;
  }

  async function importClientsCsv(){
    if(!isAdmin()) return alert("Solo Giuli/admin puede importar clientes.");
    const file = el("importCsvFile")?.files?.[0];
    if(!file) return alert("Elegí primero el archivo CSV.");
    if(!supabaseDb) return alert("No hay conexión con Supabase.");

    const replace = el("replaceClientsImport") ? el("replaceClientsImport").checked : true;
    const msg = replace ? "Esto va a BORRAR clientes y movimientos actuales y cargar el CSV. ¿Seguimos?" : "Esto va a AGREGAR clientes del CSV sin borrar los actuales. ¿Seguimos?";
    if(!confirm(msg)) return;

    const status = el("importStatus");
    if(status) status.textContent = "Leyendo archivo...";

    const rawRows = parseCsvText(await file.text());
    if(!rawRows.length) return alert("El CSV está vacío o no se pudo leer.");

    const perDay = {};
    let maxCode = replace ? 0 : state.clients.reduce((n,c)=>Math.max(n,codeNumber(c.code)),0);

    const newClients = rawRows.map((r,idx)=>{
      const day = normalizeImportDay(r.day || r.frec || r.frecuencia);
      perDay[day] = perDay[day] || 0;
      perDay[day]++;
      const code = r.code || r.codigo || ("C" + String(++maxCode).padStart(3,"0"));
      const order = importNumber(r.order || r.orden) || perDay[day];
      return {
        id:"tmp"+idx+"_"+Date.now(),
        code,
        name:r.name || r.nombre || "Sin nombre",
        address:r.address || r.direccion || "",
        city:r.city || r.ciudad || "",
        phone:r.phone || r.telefono || r["teléfono"] || "",
        day,
        order,
        priceList:r.pricelist || r.lista || r.priceList || "1",
        cooler:String(r.cooler || r.frio_calor || r["frío/calor"] || "no").toLowerCase().startsWith("s") ? "si" : "no",
        coolerDesc:r.coolerdesc || "",
        note:r.notes || r.nota || r.observaciones || "",
        initialDebt: importNumber(r.initial_debt || r.fiado || r.deuda),
        initialCredit: importNumber(r.initial_credit || r.saldo || r.credito)
      };
    });

    if(status) status.textContent = "Preparando base...";

    if(replace){
      await supabaseDb.from("moves").delete().neq("id", -1);
      await supabaseDb.from("clients").delete().neq("id", -1);
      state.clients = [];
      state.moves = [];
    }

    for(const d of days){
      newClients.filter(c=>c.day===d).sort((a,b)=>Number(a.order||0)-Number(b.order||0)).forEach((c,i)=>c.order=i+1);
    }

    const inserted = [];
    const chunkSize = 100;
    for(let i=0;i<newClients.length;i+=chunkSize){
      if(status) status.textContent = `Importando clientes ${Math.min(i+chunkSize,newClients.length)} / ${newClients.length}...`;
      const {data, error} = await supabaseDb.from("clients").insert(newClients.slice(i,i+chunkSize).map(clientToDbRow)).select();
      if(error){
        console.error(error);
        alert('No pude importar clientes. Si el error dice que falta "city", agregá una columna city tipo text en Supabase > clients.');
        if(status) status.textContent = "Error importando clientes.";
        return;
      }
      inserted.push(...(data||[]).map(dbClientRowToState));
    }

    const initialMoves = [];
    inserted.forEach((c,idx)=>{
      const original = newClients[idx];
      if(original.initialDebt > 0){
        initialMoves.push({client_id:Number(c.id),date:todayStr(),type:"fiado",product:"Saldo pendiente",qty:1,pay:"Importación",amount:original.initialDebt,salevalue:original.initialDebt,note:"Saldo inicial importado"});
      }
      if(original.initialCredit > 0){
        initialMoves.push({client_id:Number(c.id),date:todayStr(),type:"pago",product:"Pago / Saldo",qty:1,pay:"Importación",amount:original.initialCredit,salevalue:0,note:"Saldo a favor inicial importado"});
      }
    });

    for(let i=0;i<initialMoves.length;i+=chunkSize){
      if(status) status.textContent = `Importando saldos ${Math.min(i+chunkSize,initialMoves.length)} / ${initialMoves.length}...`;
      const {error} = await supabaseDb.from("moves").insert(initialMoves.slice(i,i+chunkSize));
      if(error){
        console.error(error);
        alert("Clientes importados, pero hubo error cargando saldos iniciales.");
        break;
      }
    }

    await cloudLoadData();
    fillBase();
    renderAll();

    if(status) status.textContent = `Listo: ${inserted.length} clientes importados.`;
    alert(`Importación terminada: ${inserted.length} clientes.`);
  }


function applyRolePermissions(){
    const admin=isAdmin();
    ["clientCodePreview","clientName","clientAddress","clientCity","clientPhone","clientDay","clientInsertAfter","clientOrder","clientPriceList","clientCooler","clientCoolerDesc","clientNote"].forEach(id=>{ if(el(id)) el(id).disabled=!admin; });
    el("saveClientBtn").disabled=!admin; el("saveClientBtn").textContent=admin?"Agregar cliente":"Solo Giuli puede agregar clientes"; el("clientAdminOnlyNote").classList.toggle("hidden",admin);
    document.querySelectorAll(".admin-only").forEach(n=>n.classList.toggle("hidden",!admin));
  }
  function openView(view){
    if(!isAdmin() && view==="ventas") view="dashboard";
    document.querySelectorAll(".nav,.view").forEach(x=>x.classList.remove("active"));
    document.querySelector(`.nav[data-view="${view}"]`)?.classList.add("active");
    el(view).classList.add("active");
    const t={dashboard:["Panel general","Resumen de ventas, cobros y fiados."],ruta:["Ruta del día","Clientes ordenados por día."],hoja:["Hoja de ruta","Vista rápida para celular."],clientes:["Clientes","Alta, códigos, frío/calor y links."],fiados:["Fiados","Detalle por cliente y por día."],ventas:["Venta general","Reporte diario para comparar remitos."],precios:["Listas de precios","IVESS, frío/calor y Pirozi."],portal:["Vista cliente","Pantalla pública del cliente."]};
    el("viewTitle").textContent=t[view][0]; el("viewSubtitle").textContent=t[view][1]; renderAll();
  }
  function renderAll(){ renderDashboard(); renderRoute(); renderRouteMode(); renderRouteSheet(); renderClients(); renderDebts(); renderSales(); renderPrices(); renderPortal(); updateCodePreview(); applyRolePermissions(); }
  async function initAdmin(){ await cloudLoadData(); fillBase(); renderAll(); updatePriceHint(); }

  async function bootPublic(){
    const code=new URLSearchParams(location.search).get("cliente");
    if(!code) return false;
    await cloudLoadData();
    el("adminApp").classList.add("hidden"); el("loginScreen").classList.add("hidden"); el("publicPortal").classList.remove("hidden"); el("publicPortalContent").innerHTML=portalHTML(code,true); return true;
  }

  
  ["click","keydown","input","change","touchstart"].forEach(evt=>{
    document.addEventListener(evt, touchSession, {passive:true});
  });

  document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>openView(b.dataset.view));
  ["routeDay","routeSort","routeSearch","clientSearch","clientSort","salesDate","portalClient"].forEach(id=>el(id).addEventListener("input",renderAll));
  ["sheetDay","sheetSearch"].forEach(id=>el(id).addEventListener("input",()=>{ routeCart=[]; routePayments=[{pay:"Efectivo",mode:"total",amount:0}]; saveRouteModeState(); renderAll(); }));
  ["clientDay","clientInsertAfter"].forEach(id=>el(id).addEventListener("change",()=>{fillInsertAfter();renderAll();}));
  ["movClient","movProduct","movQty","movType"].forEach(id=>el(id).addEventListener("input",updatePriceHint));
  el("loginBtn").onclick=login; el("loginPass").addEventListener("keydown",e=>{if(e.key==="Enter")login();}); el("logoutBtn").onclick=logout;
  el("saveMovementBtn").onclick=addMovement; el("saveClientBtn").onclick=addClient; if(el("clientDay")) el("clientDay").addEventListener("change", fillInsertAfter); el("savePricesBtn").onclick=savePrices; el("copyPortalLinkBtn").onclick=()=>copyText(clientLink(el("portalClient").value)); if(el("sendPortalWhatsappBtn")) el("sendPortalWhatsappBtn").onclick=()=>{
      const val = el("portalClient").value;
      openWhatsappClient(val);
    };
  el("todaySalesBtn").onclick=()=>{el("salesDate").value=todayISO();renderAll();}; if(el("importCsvBtn")) el("importCsvBtn").onclick=importClientsCsv;
  el("startRouteModeBtn").onclick=()=>{ routeCart=[]; routePayments=[{pay:"Efectivo",mode:"total",amount:0}]; saveRouteModeState(); renderAll(); };
  el("resetDemoBtn").onclick=()=>{ if(confirm("¿Reiniciar demo? Se borran datos locales.")){ localStorage.removeItem("ivessStableV5"); state=JSON.parse(JSON.stringify(demo)); save(); initAdmin(); } };

  save();
  (async function startApp(){
    if(!(await bootPublic())){ currentUser ? (showApp(),initAdmin()) : showLogin(); }
  })();
});
