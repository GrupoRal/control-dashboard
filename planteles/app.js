/* ============================================
    CONSTANTE DE RUTA DE ARCHIVO
============================================ */
const CONFIG_FILE_PATH = './configuracion_linea_avance.json'; 

// Seed inicial (datos por defecto, solo como fallback si el archivo no existe)
const seed = [
  { id:'h1', title:'Hito 1 — Documentación Base', desc:'Actas, diagnósticos y recopilación inicial.', priority:'Alta', avance:0, // Avance inicial 0, se calcula en loadData
    subhitos:[
      { id:'h1s1', title:'Revisión de antecedentes', avance:0, docs:['Acta de comité técnico [aprobado]','Informe diagnóstico [aprobado]','Plano actualizado [pendiente]'] },
      { id:'h1s2', title:'Solicitud de documentos externos', avance:0, docs:['Certificado DOM [pendiente]','Certificado SAG [aprobado]'] }
    ]
  },
  { id:'h2', title:'Hito 2 — Permisos Municipales', desc:'Requisitos y presentación al municipio.', priority:'Media', avance:0,
    subhitos:[
      { id:'h2s1', title:'Revisión de normas', avance:0, docs:['Certificación sanitaria [pendiente]','Plan regulador [pendiente]'] },
      { id:'h2s2', title:'Presentación preliminar', avance:0, docs:['Carta de inicio [pendiente]','Presentación técnica [pendiente]'] }
    ]
  },
  { id:'h3', title:'Hito 3 — Regularización Ambiental', desc:'Estudios, mitigaciones y certificados.', priority:'Baja', avance:0,
    subhitos:[
      { id:'h3s1', title:'Estudios de impacto', avance:0, docs:['Estudio preliminar [pendiente]'] }
    ]
  }
];

/* ============================================
    Estado en memoria y Utilidades
============================================ */
let data = []; 
let currentOpen = null;
let currentView = 'visual';

/* UID simple */
function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

/* UTIL: forzar un número entre 0 y 100 */
function clampAvance(value){
    let num = parseInt(value, 10) || 0;
    if (num < 0) return 0;
    if (num > 100) return 100;
    return num;
}

/* Mostrar mensajes breves en UI */
function showNotice(msg, timeout=2500){
  if(!configNotice) { console.log('NOTICE:', msg); return; }
  configNotice.textContent = msg;
  configNotice.style.display = 'block';
  setTimeout(()=>{ configNotice.style.display='none'; configNotice.textContent=''; }, timeout);
}

/* Util: escapar HTML (pequeña protección al inyectar valores) */
function escapeHtml(str){
  if(!str) return '';
  return String(str).replace(/[&<>"'`=\/]/g, function(s) {
    return ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
    })[s];
}

/* ============================================
    LÓGICA DE PERSISTENCIA (SIN localStorage)
============================================ */

/* Carga de Datos (Leyendo el archivo JSON estático) */
async function loadData(){
  try {
    const response = await fetch(CONFIG_FILE_PATH);
    if (!response.ok) {
        console.warn(`Archivo de configuración no encontrado (${CONFIG_FILE_PATH}). Usando datos iniciales.`);
        // Aseguramos que el seed se calcule antes de devolverlo
        seed.forEach(h => recalcHitoAvance(h)); 
        return JSON.parse(JSON.stringify(seed)); 
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
         console.warn("El archivo de configuración está vacío o es inválido. Usando datos iniciales.");
         seed.forEach(h => recalcHitoAvance(h)); 
         return JSON.parse(JSON.stringify(seed));
    }
    
    // Aseguramos que el avance de los datos cargados esté bien calculado.
    data.forEach(h => recalcHitoAvance(h)); 
    return data;
  } catch (error) {
    console.error("Error al cargar o parsear la configuración. Usando datos iniciales.", error);
    seed.forEach(h => recalcHitoAvance(h)); 
    return JSON.parse(JSON.stringify(seed));
  }
}

/* Marcar Cambios (Alerta de que el usuario debe descargar) */
function markChangesAsDirty(dataToSave){
    showNotice('Cambios realizados. ¡No olvides hacer clic en "Guardar Cambios" para generar el nuevo JSON!', 4000);
}

/* Descargar Configuración (Genera el archivo JSON para subir a GitHub) */
function downloadConfig(dataToSave) {
    const dataString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'configuracion_linea_avance.json'; 
    
    a.click();
    
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100); 
    
    showNotice('Archivo JSON generado y descargado. Súbelo a GitHub para aplicar los cambios en línea.');
}


/* ============================================
    CÁLCULO AUTOMÁTICO DE AVANCE
============================================ */

/* UTIL: Calular Avance de Sub-hito (Documentos Aprobados / Total) */
function autoCalcSubHitoAvance(subhito){
    if (!subhito || !subhito.docs || subhito.docs.length === 0) {
        subhito.avance = 0;
        return;
    }

    const totalDocs = subhito.docs.length;
    let approvedDocs = 0;

    subhito.docs.forEach(doc => {
        // Busca el estado '[approved]' o '[aprobado]' (insensible a mayúsculas y minúsculas)
        if (/(approved|aprobado)/i.test(doc)) {
            approvedDocs++;
        }
    });

    const calculatedAvance = Math.round((approvedDocs / totalDocs) * 100);
    subhito.avance = clampAvance(calculatedAvance);
}

/* UTIL: recalcular avance del hito (promedio simple de sub-hitos) */
function recalcHitoAvance(h){
    if(!h || !h.subhitos || h.subhitos.length===0){
        h.avance = 0;
        return;
    }
    
    // 1. Aseguramos que el avance de cada sub-hito esté actualizado
    h.subhitos.forEach(s => autoCalcSubHitoAvance(s));

    // 2. Calculamos el promedio del hito
    const sum = h.subhitos.reduce((acc,s)=> acc + (clampAvance(s.avance)), 0);
    const avg = Math.round(sum / h.subhitos.length);
    h.avance = clampAvance(avg);
}


/* ============================================
    Referencias DOM globales
============================================ */
const wrap = document.getElementById('hitosWrap'); 
const connectorLine = document.getElementById('connectorLine');
const detalleArea = document.getElementById('detalleArea');
const detalleInner = document.getElementById('detalleInner');
const detalleTitulo = document.getElementById('detalleTitulo');

const configWrap = document.getElementById('hitosConfigWrap');
const configNotice = document.getElementById('configNotice');


/* ============================================
    Cambio de pestañas Visualización / Config
============================================ */
function switchView(v){
  currentView = v;

  document.getElementById('visualView').style.display =
    v === 'visual' ? 'block' : 'none';

  document.getElementById('configView').style.display =
    v === 'config' ? 'block' : 'none';

  // tabs visuales
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => {
    if(t.dataset.view === v) t.classList.add('active');
  });

  if(v === 'config'){
    renderHitosConfig();
  } else {
    detalleArea.style.display = 'none';
    currentOpen = null;
    createConnectors();
  }
}

/* ============================================
    Render de hitos (Visualización clásica)
============================================ */
function renderHitos(){
  wrap.querySelectorAll('.hito-card:not(.hito-card.config)').forEach(n=>n.remove());

  data.forEach(h => {
    const card = document.createElement('div');
    card.className = 'hito-card';
    card.dataset.id = h.id;
    card.onclick = ()=> openHito(h.id, card);

    card.innerHTML = `
      <div class="hito-title">${escapeHtml(h.title)}</div>
      <div class="hito-desc">${escapeHtml(h.desc || '')}</div>
      <div class="hito-meta">
        <div class="badge">Avance ${h.avance || 0}%</div>
        <div class="muted" style="font-size:12px">${escapeHtml(h.priority || '')}</div>
      </div>
    `;

    wrap.appendChild(card);
  });

  createConnectors();
}

/* Abrir hito en Visualización clásica */
function openHito(id, el){
  document.querySelectorAll('.hito-card').forEach(c=>c.classList.remove('active'));

  if(currentOpen === id){
    detalleArea.style.display='none';
    currentOpen=null;
    return;
  }

  el.classList.add('active');
  currentOpen = id;
  const h = data.find(x=>x.id===id);
  if(!h) return;

  detalleTitulo.textContent = `Detalle — ${h.title}`;
  detalleInner.innerHTML = '';

  if(!h.subhitos || h.subhitos.length === 0){
    detalleInner.innerHTML = '<div class="subhito">Sin sub-hitos</div>';
  } else {
    h.subhitos.forEach(s=>{
      const box = document.createElement('div');
      box.className = 'subhito';

      // RENDERIZADO CON CLASES DE ESTADO (Visualización)
      const docs = (s.docs||[]).map(d => {
          const match = d.match(/^(.*)\s\[(.*)\]$/i);
          const docName = match ? match[1] : d;
          const status = match ? match[2].toLowerCase() : 'pendiente'; 
          
          return `<li class="doc-status-${status}">${escapeHtml(docName)} <span>[${status.toUpperCase()}]</span></li>`;
      }).join('');

      box.innerHTML = `
        <strong>${escapeHtml(s.title)}</strong>
        <div class="sub-prog">Avance: ${s.avance || 0}%</div>
        <ul class="docs">${docs}</ul>
      `;
      detalleInner.appendChild(box);
    });
  }

  detalleArea.style.display='block';
  el.scrollIntoView({behavior:'smooth',inline:'center'});
}

/* Conectores entre hitos (línea) */
function createConnectors(){
  if(!wrap) return;
  document.querySelectorAll('.connector-dot').forEach(d=>d.remove());
  const cards = Array.from(wrap.querySelectorAll('.hito-card:not(.hito-card.config)'));
  if(cards.length === 0){
    connectorLine.style.display='none';
    return;
  }

  const wrapRect = wrap.getBoundingClientRect();
  if(!cards[0]) return; 
  const firstRect = cards[0].getBoundingClientRect();

  const lineTop = (firstRect.top + firstRect.height/2) - wrapRect.top + wrap.scrollTop;
  connectorLine.style.top = `${lineTop}px`;
  connectorLine.style.display='block';

  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const centerX = (rect.left + rect.right)/2 - wrapRect.left + wrap.scrollLeft;

    const dot = document.createElement('div');
    dot.className = 'connector-dot';
    dot.style.left = `${centerX}px`;
    dot.style.top = `${lineTop}px`;
    wrap.appendChild(dot);
  });
}

/* ============================================
    CONFIGURACIÓN VISUAL: render y handlers
============================================ */
function renderHitosConfig(){
  configWrap.innerHTML = '';

  data.forEach((h, idx) => {
    const card = document.createElement('div');
    card.className = 'hito-card config';
    card.dataset.id = h.id;
    card.draggable = true;

    // Generar la lista de documentos (sin clases de color para no afectar la vista)
    let subhitosHtml = '';
    if(h.subhitos && h.subhitos.length){
      h.subhitos.forEach(s=>{
        const docs = (s.docs||[]).map((d, i) => {
            const match = d.match(/^(.*)\s\[(.*)\]$/i);
            const docName = match ? match[1] : d;
            const status = match ? match[2].toLowerCase() : 'pendiente'; 

            return `
                <div data-doc="${i}" class="doc-item">
                    ${escapeHtml(docName)} <span class="doc-status"> [${status}]</span>
                    <button class="btn edit-doc tiny" data-doc="${i}" data-subid="${s.id}">Editar</button>
                    <button class="btn del-doc tiny red" data-doc="${i}" data-subid="${s.id}">Eliminar</button>
                </div>
            `;
        }).join('');

        subhitosHtml += `
            <div class="sub-item" data-sid="${s.id}">
                <div>
                    <span class="sub-title">${escapeHtml(s.title)}</span>
                    <div style="font-size:12px; color:#666;">Av: ${s.avance || 0}% (Automático)</div>
                    <div class="doc-list">${docs}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <button class="btn edit-sub tiny" data-subid="${s.id}">Editar</button>
                    <button class="btn add-doc tiny" data-subid="${s.id}">+Doc</button>
                    <button class="btn delete-sub tiny red" data-subid="${s.id}">Eliminar</button>
                </div>
            </div>
        `;
      });
    } else {
      subhitosHtml = `<div class="muted">Sin sub‑hitos</div>`;
    }


    card.innerHTML = `
      <div class="drag-handle" title="Arrastrar para reordenar">☰</div>
      <div class="hito-content">
        <div class="hito-title-el">${escapeHtml(h.title)}</div>
        <div class="hito-desc-el muted">${escapeHtml(h.desc||'')}</div>
        <div class="card-meta">Avance: ${h.avance || 0}% • Prioridad: ${escapeHtml(h.priority || '')}</div>

        <div class="card-actions">
          <button class="btn edit-hito small">Editar</button>
          <button class="btn add-sub small">Agregar sub‑hito</button>
          <button class="btn delete-hito small red">Eliminar</button>
        </div>

        <div class="sub-list">
          <strong>Sub‑hitos</strong>
          <div class="subs-container">${subhitosHtml}</div>
        </div>
      </div>
    `;

    configWrap.appendChild(card);
    attachDragHandlers(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'hito-card config';
  addCard.style.cssText = 'display: flex; align-items: center; justify-content: center; cursor: default;';
  addCard.innerHTML = `<button id="btnQuickAddHito" class="btn blue">+ Agregar nuevo hito</button>`;
  configWrap.appendChild(addCard);
  document.getElementById('btnQuickAddHito')?.addEventListener('click', ()=> {
    document.getElementById('addHitoTitleInput').focus();
  });
}

// Delegación de Eventos en Configuración
configWrap.addEventListener('click', (event) => {
    const target = event.target;
    const card = target.closest('.hito-card.config');
    if (!card) return;

    const hitoId = card.dataset.id;
    const h = data.find(x => x.id === hitoId);
    if (!h) return;

    // Hito Actions
    if (target.classList.contains('edit-hito')) {
        startEditHito(card, h);
    } else if (target.classList.contains('add-sub')) {
        openNewSubForm(card, h);
    } else if (target.classList.contains('delete-hito')) {
        if(!confirm(`¿Eliminar hito "${h.title}"?`)) return;
        data = data.filter(x=>x.id!==h.id);
        markChangesAsDirty(data);
        renderHitosConfig();
        renderHitos();
        showNotice('Hito eliminado. No olvides guardar el JSON.');
    }

    // Sub-hito & Document Actions
    const subId = target.dataset.subid;
    const subItemEl = target.closest('.sub-item');
    const s = h.subhitos ? h.subhitos.find(x => x.id === subId) : null;

    if (s) {
        if (target.classList.contains('edit-sub')) {
            startEditSub(subItemEl, h, s, card);
        } else if (target.classList.contains('delete-sub')) {
            if(!confirm(`¿Eliminar sub-hito "${s.title}"?`)) return;
            h.subhitos = h.subhitos.filter(x=>x.id!==s.id);
            recalcHitoAvance(h); // Recálculo
            markChangesAsDirty(data);
            renderHitosConfig();
            renderHitos();
            showNotice('Sub-hito eliminado. No olvides guardar el JSON.');
        } else if (target.classList.contains('add-doc')) {
            openNewDocForm(subItemEl, h, s, card);
        } else if (target.classList.contains('edit-doc')) {
            const di = parseInt(target.dataset.doc, 10);
            startEditDoc(target.closest('.sub-item'), h, s, di, card);
        } else if (target.classList.contains('del-doc')) {
            const di = parseInt(target.dataset.doc, 10);
            if(!confirm('¿Eliminar documento?')) return;
            s.docs.splice(di,1);
            recalcHitoAvance(h); // Recálculo
            markChangesAsDirty(data);
            renderHitosConfig();
            renderHitos();
            showNotice('Documento eliminado. No olvides guardar el JSON.');
        }
    }
});


/* Inicia edición inline de un hito */
function startEditHito(card, h){
  if(card.querySelector('.editing')) return;
  card.classList.add('editing');
  const content = card.querySelector('.hito-content');
  
  const tpl = document.createElement('div');
  tpl.innerHTML = `
    <label>Título</label>
    <input class="small-input edit-title" value="${escapeHtml(h.title)}" />
    <label>Descripción</label>
    <textarea class="small-input edit-desc">${escapeHtml(h.desc||'')}</textarea>
    <label>Prioridad</label>
    <select class="edit-priority small-input">
      <option ${h.priority==='Alta'?'selected':''}>Alta</option>
      <option ${h.priority==='Media'?'selected':''}>Media</option>
      <option ${h.priority==='Baja'?'selected':''}>Baja</option>
    </select>
    <div class="muted" style="margin-top:10px;">El avance se calcula automáticamente.</div>
    <div style="margin-top:8px;">
      <button class="btn save-hito green">Guardar</button>
      <button class="btn cancel-hito">Cancelar</button>
    </div>
  `;
  content.style.display = 'none';
  card.appendChild(tpl);

  tpl.querySelector('.cancel-hito').addEventListener('click', ()=>{
    tpl.remove();
    content.style.display = '';
    card.classList.remove('editing');
  });

  tpl.querySelector('.save-hito').addEventListener('click', ()=>{
    const newTitle = tpl.querySelector('.edit-title').value.trim();
    if(!newTitle) return alert('Título requerido');
    
    h.title = newTitle;
    h.desc = tpl.querySelector('.edit-desc').value.trim();
    h.priority = tpl.querySelector('.edit-priority').value;
    
    // Avance se recalcula automáticamente
    recalcHitoAvance(h);

    markChangesAsDirty(data);
    tpl.remove();
    card.classList.remove('editing');
    renderHitosConfig();
    renderHitos();
    showNotice('Hito actualizado. No olvides guardar el JSON.');
  });
}

/* Abre un formulario inline para crear nuevo sub-hito dentro de la tarjeta */
function openNewSubForm(card, h){
  if(card.querySelector('.form-new-sub')) {
    card.querySelector('.form-new-sub input')?.focus();
    return;
  }
  const container = card.querySelector('.subs-container') || card.querySelector('.sub-list');
  const form = document.createElement('div');
  form.className = 'form-new-sub sub-item';
  form.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;width:100%;">
      <input class="small-input new-sub-title" placeholder="Título sub-hito" />
      <div class="muted" style="font-size:12px;">El avance inicial será 0% (se calcula por documentos).</div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="btn create-sub blue small">Crear</button>
        <button class="btn cancel-sub small">Cancelar</button>
      </div>
    </div>
  `;
  container.prepend(form);
  form.querySelector('.new-sub-title').focus();

  form.querySelector('.cancel-sub').addEventListener('click', ()=> form.remove());
  form.querySelector('.create-sub').addEventListener('click', ()=>{
    const title = form.querySelector('.new-sub-title').value.trim();

    if(!title) return alert('Título requerido');
    if(!h.subhitos) h.subhitos = [];
    
    // Avance se inicializa a 0, luego se recalcula
    const newSub = { id: uid('s'), title, avance: 0, docs: [] };
    h.subhitos.push(newSub);
    recalcHitoAvance(h);
    markChangesAsDirty(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Sub-hito creado. No olvides guardar el JSON.');
  });
}

/* Inicia edición inline de un sub-hito */
function startEditSub(subItemEl, h, s, card){
  if(subItemEl.querySelector('.editing-sub')) return;
  const backupHtml = subItemEl.innerHTML;
  subItemEl.classList.add('editing-sub');

  subItemEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
      <label>Título sub-hito</label>
      <input class="small-input edit-sub-title" value="${escapeHtml(s.title)}" />
      <div class="muted" style="font-size:12px;">El avance se calcula automáticamente por documentos.</div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="btn save-sub green small">Guardar</button>
        <button class="btn cancel-sub small">Cancelar</button>
      </div>
    </div>
  `;
  subItemEl.querySelector('.edit-sub-title').focus();
  
  subItemEl.querySelector('.cancel-sub').addEventListener('click', ()=>{
    subItemEl.classList.remove('editing-sub');
    renderHitosConfig(); 
  });
  subItemEl.querySelector('.save-sub').addEventListener('click', ()=>{
    const newTitle = subItemEl.querySelector('.edit-sub-title').value.trim();
    
    if(!newTitle) return alert('Título requerido');
    s.title = newTitle;
    // Avance no se modifica, lo hará recalcHitoAvance

    recalcHitoAvance(h);
    markChangesAsDirty(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Sub-hito actualizado. No olvides guardar el JSON.');
  });
}

/* Abre formulario inline para agregar documento a un sub-hito */
function openNewDocForm(subItemEl, h, s, card){
  if(subItemEl.querySelector('.form-new-doc')) {
    subItemEl.querySelector('.form-new-doc input')?.focus();
    return;
  }
  const form = document.createElement('div');
  form.className = 'form-new-doc';
  form.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;padding-left:10px; border-left: 2px solid #ddd;">
      <input class="small-input new-doc-name" placeholder="Nombre documento" />
      <select class="small-input new-doc-status">
        <option value="pendiente">Pendiente</option>
        <option value="aprobado">Aprobado</option>
        <option value="rechazado">Rechazado</option>
      </select>
      <div style="display:flex;gap:6px;">
        <button class="btn create-doc blue tiny">Agregar</button>
        <button class="btn cancel-doc tiny">Cancelar</button>
      </div>
    </div>
  `;
  subItemEl.querySelector('.doc-list')?.appendChild(form);
  form.querySelector('.new-doc-name').focus();

  form.querySelector('.cancel-doc').addEventListener('click', ()=> form.remove());
  form.querySelector('.create-doc').addEventListener('click', ()=>{
    const name = form.querySelector('.new-doc-name').value.trim();
    const status = form.querySelector('.new-doc-status').value;
    if(!name) return alert('Nombre requerido');
    if(!s.docs) s.docs = [];
    s.docs.push(`${name} [${status}]`);
    recalcHitoAvance(h);
    markChangesAsDirty(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Documento agregado. No olvides guardar el JSON.');
  });
}

/* Inicia edición inline de un documento identificado por índice di */
function startEditDoc(subItemEl, h, s, di, card){
  const docNode = subItemEl.querySelector(`[data-doc="${di}"]`);
  if(!docNode) return;
  
  const text = s.docs[di] || '';
  const match = text.match(/^(.*)\s\[(.*)\]$/i);
  const name = match ? match[1] : text;
  const status = match ? match[2].toLowerCase() : 'pendiente';

  const backup = docNode.innerHTML;
  docNode.innerHTML = `
    <div class="editing-doc">
        <input class="small-input edit-doc-name" value="${escapeHtml(name)}" />
        <select class="small-input edit-doc-status">
          <option ${status==='pendiente'?'selected':''} value="pendiente">Pendiente</option>
          <option ${status==='aprobado'?'selected':''} value="aprobado">Aprobado</option>
          <option ${status==='rechazado'?'selected':''} value="rechazado">Rechazado</option>
        </select>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button class="btn save-doc green tiny">Guardar</button>
          <button class="btn cancel-doc tiny">Cancelar</button>
        </div>
    </div>
  `;
  docNode.querySelector('.edit-doc-name').focus();

  docNode.querySelector('.cancel-doc').addEventListener('click', ()=>{
    docNode.innerHTML = backup;
    renderHitosConfig(); 
  });
  docNode.querySelector('.save-doc').addEventListener('click', ()=>{
    const newName = docNode.querySelector('.edit-doc-name').value.trim();
    const newStatus = docNode.querySelector('.edit-doc-status').value;
    if(!newName) return alert('Nombre requerido');
    s.docs[di] = `${newName} [${newStatus}]`;
    recalcHitoAvance(h);
    markChangesAsDirty(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Documento actualizado. No olvides guardar el JSON.');
  });
}


/* ============================================
    Drag & Drop: reordenar hitos
============================================ */
let dragSrcId = null;
function attachDragHandlers(card){
  card.addEventListener('dragstart', (e)=>{
    dragSrcId = card.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    card.style.opacity = '0.5';
  });
  card.addEventListener('dragend', ()=>{
    dragSrcId = null;
    card.style.opacity = '';
  });
  card.addEventListener('dragover', (e)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  card.addEventListener('drop', (e)=>{
    e.preventDefault();
    const targetId = card.dataset.id;
    if(!dragSrcId || dragSrcId === targetId) return;
    
    const srcIndex = data.findIndex(x=>x.id===dragSrcId);
    const targetIndex = data.findIndex(x=>x.id===targetId);
    if(srcIndex < 0 || targetIndex < 0) return;
    
    const [moved] = data.splice(srcIndex,1);
    data.splice(targetIndex,0,moved);
    
    markChangesAsDirty(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Orden actualizado. No olvides guardar el JSON.');
  });
}


/* ============================================
    Acciones globales de la vista configuracion
============================================ */
document.getElementById('btnAddHitoVisual')?.addEventListener('click', ()=>{
  const title = document.getElementById('addHitoTitleInput').value.trim();
  const priority = document.getElementById('addHitoPriority').value;
  if(!title) return alert('Ingresa título para el nuevo hito');
  
  // Avance inicial 0, docs vacíos
  const newH = { id: uid('h'), title, desc:'', priority, avance:0, subhitos:[] }; 
  data.push(newH);
  markChangesAsDirty(data);
  document.getElementById('addHitoTitleInput').value = '';
  renderHitosConfig();
  renderHitos();
  showNotice('Hito agregado. No olvides guardar el JSON.');
});

// Listener del botón GUARDAR: ÚNICO QUE DISPARA LA DESCARGA
document.getElementById('btnSaveAll')?.addEventListener('click', ()=>{
  downloadConfig(data);
  renderHitos();
  // La notificación la pone downloadConfig
});

/* Reset seed: genera un nuevo archivo basado en el seed */
document.getElementById('btnResetSeed')?.addEventListener('click',()=>{
  if(!confirm('¿Restaurar datos iniciales? Esto eliminará todos los cambios.')) return;
  
  data = JSON.parse(JSON.stringify(seed)); // Deep copy del seed
  data.forEach(h => recalcHitoAvance(h)); // Aseguramos el cálculo del seed
  
  downloadConfig(data); // LLAMA DIRECTAMENTE A DESCARGAR
  
  renderHitosConfig();
  renderHitos();
  // La notificación la pone downloadConfig
});


/* ============================================
    Inicialización
============================================ */
window.addEventListener('load', async ()=>{
  // 1. Cargar los datos desde el archivo
  data = await loadData(); 
  
  // 2. Renderizar vistas
  renderHitos();
  createConnectors();
});

window.addEventListener('resize',()=> createConnectors());
wrap.addEventListener('scroll',()=> window.requestAnimationFrame(createConnectors()));
