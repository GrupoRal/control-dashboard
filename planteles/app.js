/* ============================================
    Persistencia y datos iniciales
============================================ */
const STORAGE_KEY = 'planteles_v3';

// Seed inicial (datos por defecto)
const seed = [
  { id:'h1', title:'Hito 1 — Documentación Base', desc:'Actas, diagnósticos y recopilación inicial.', priority:'Alta', avance:42,
    subhitos:[
      { id:'h1s1', title:'Revisión de antecedentes', avance:60, docs:['Acta de comité técnico [approved]','Informe diagnóstico [approved]','Plano actualizado [pending]'] },
      { id:'h1s2', title:'Solicitud de documentos externos', avance:25, docs:['Certificado DOM [pending]','Certificado SAG [approved]'] }
    ]
  },
  { id:'h2', title:'Hito 2 — Permisos Municipales', desc:'Requisitos y presentación al municipio.', priority:'Media', avance:10,
    subhitos:[
      { id:'h2s1', title:'Revisión de normas', avance:10, docs:['Certificación sanitaria [pending]','Plan regulador [pending]'] },
      { id:'h2s2', title:'Presentación preliminar', avance:0, docs:['Carta de inicio [pending]','Presentación técnica [pending]'] }
    ]
  },
  { id:'h3', title:'Hito 3 — Regularización Ambiental', desc:'Estudios, mitigaciones y certificados.', priority:'Baja', avance:0,
    subhitos:[
      { id:'h3s1', title:'Estudios de impacto', avance:0, docs:['Estudio preliminar [pending]'] }
    ]
  }
];

// Cargar datos (prioriza localStorage)
function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) return JSON.parse(raw);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return JSON.parse(JSON.stringify(seed)); // Devuelve una copia para no modificar el seed
}

// Guardar datos
function saveData(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ============================================
    Estado en memoria y Utilidades
============================================ */
let data = loadData();
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
  });
}


/* ============================================
    Referencias DOM globales
============================================ */
const wrap = document.getElementById('hitosWrap'); // visual view
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
    // Es buena práctica ocultar el detalle al cambiar de vista, por si acaso
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

      const docs = (s.docs||[]).map(d=>`<li>${escapeHtml(d)}</li>`).join('');

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

/* ============================================
    Conectores entre hitos (línea)
============================================ */
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
    UTIL: recalcular avance del hito (promedio simple)
============================================ */
function recalcHitoAvance(h){
  if(!h || !h.subhitos || h.subhitos.length===0){
    h.avance = 0;
    return;
  }
  const sum = h.subhitos.reduce((acc,s)=> acc + (clampAvance(s.avance)), 0);
  const avg = Math.round(sum / h.subhitos.length);
  h.avance = clampAvance(avg);
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

    // Generar la lista de documentos
    let subhitosHtml = '';
    if(h.subhitos && h.subhitos.length){
      h.subhitos.forEach(s=>{
        const docs = (s.docs||[]).map((d, i)=>`
            <div data-doc="${i}">
                ${escapeHtml(d)}
                <button class="btn edit-doc tiny" data-doc="${i}" data-subid="${s.id}">Editar</button>
                <button class="btn del-doc tiny red" data-doc="${i}" data-subid="${s.id}">Eliminar</button>
            </div>
        `).join('');

        subhitosHtml += `
            <div class="sub-item" data-sid="${s.id}">
                <div>
                    <span class="sub-title">${escapeHtml(s.title)}</span>
                    <div style="font-size:12px; color:#666;">Av: ${s.avance || 0}%</div>
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

    // Adjuntar drag handlers
    attachDragHandlers(card);
  });

  // Tarjeta para agregar nuevo hito
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
        saveData(data);
        renderHitosConfig();
        renderHitos();
        showNotice('Hito eliminado');
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
            recalcHitoAvance(h);
            saveData(data);
            renderHitosConfig();
            renderHitos();
            showNotice('Sub-hito eliminado');
        } else if (target.classList.contains('add-doc')) {
            openNewDocForm(subItemEl, h, s, card);
        } else if (target.classList.contains('edit-doc')) {
            const di = parseInt(target.dataset.doc, 10);
            startEditDoc(target.closest('.sub-item'), h, s, di, card);
        } else if (target.classList.contains('del-doc')) {
            const di = parseInt(target.dataset.doc, 10);
            if(!confirm('¿Eliminar documento?')) return;
            s.docs.splice(di,1);
            saveData(data);
            renderHitosConfig();
            renderHitos();
            showNotice('Documento eliminado');
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
    <label>Avance (%)</label>
    <input type="number" min="0" max="100" class="small-input edit-avance" value="${h.avance||0}" />
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
    
    const av = clampAvance(tpl.querySelector('.edit-avance').value);
    h.avance = av;

    saveData(data);
    tpl.remove();
    card.classList.remove('editing');
    renderHitosConfig();
    renderHitos();
    showNotice('Hito actualizado');
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
      <div style="display:flex;gap:6px;align-items:center;">
        <label>Avance inicial (%):</label>
        <input class="small-input new-sub-avance" type="number" min="0" max="100" value="0" style="width:60px;"/>
      </div>
      <div style="display:flex;gap:6px;">
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
    const av = clampAvance(form.querySelector('.new-sub-avance').value);

    if(!title) return alert('Título requerido');
    if(!h.subhitos) h.subhitos = [];
    
    const newSub = { id: uid('s'), title, avance: av, docs: [] };
    h.subhitos.push(newSub);
    recalcHitoAvance(h);
    saveData(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Sub-hito creado');
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
      <label>Avance (%)</label>
      <input class="small-input edit-sub-avance" type="number" min="0" max="100" value="${s.avance||0}" />
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
    const av = clampAvance(subItemEl.querySelector('.edit-sub-avance').value);
    
    if(!newTitle) return alert('Título requerido');
    s.title = newTitle;
    s.avance = av;
    
    recalcHitoAvance(h);
    saveData(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Sub-hito actualizado');
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
        <option value="pending">Pendiente</option>
        <option value="approved">Aprobado</option>
        <option value="rejected">Rechazado</option>
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
    saveData(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Documento agregado');
  });
}

/* Inicia edición inline de un documento identificado por índice di */
function startEditDoc(subItemEl, h, s, di, card){
  const docNode = subItemEl.querySelector(`[data-doc="${di}"]`);
  if(!docNode) return;
  
  const text = s.docs[di] || '';
  const match = text.match(/^(.*)\s\[(.*)\]$/);
  const name = match ? match[1] : text;
  const status = match ? match[2] : 'pending';

  const backup = docNode.innerHTML;
  docNode.innerHTML = `
    <div class="editing-doc">
        <input class="small-input edit-doc-name" value="${escapeHtml(name)}" />
        <select class="small-input edit-doc-status">
          <option ${status==='pending'?'selected':''} value="pending">Pendiente</option>
          <option ${status==='approved'?'selected':''} value="approved">Aprobado</option>
          <option ${status==='rejected'?'selected':''} value="rejected">Rechazado</option>
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
    saveData(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Documento actualizado');
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
    
    saveData(data);
    renderHitosConfig();
    renderHitos();
    showNotice('Orden actualizado');
  });
}

// ============================================
// UTILIDADES DE ARCHIVO (Importar/Exportar)
// ============================================

function exportData() {
    // 1. Convertir los datos a texto JSON
    const dataString = JSON.stringify(data, null, 2);
    
    // 2. Crear un Blob (archivo binario)
    const blob = new Blob([dataString], { type: 'application/json' });
    
    // 3. Crear una URL temporal para el Blob
    const url = URL.createObjectURL(blob);
    
    // 4. Crear un enlace de descarga (elemento temporal <a>)
    const a = document.createElement('a');
    a.href = url;
    a.download = 'configuracion_linea_avance.json';
    
    // 5. Simular el clic para iniciar la descarga.
    // Usamos setTimeout(0) para asegurar que el elemento <a> se haya procesado 
    // en el DOM, lo que es crucial para evitar bloqueos del navegador.
    a.click();
    
    // 6. Limpiar: Se recomienda un pequeño retraso para asegurar que la descarga 
    // se inició antes de revocar la URL y mostrar el mensaje.
    setTimeout(() => {
        URL.revokeObjectURL(url);
        showNotice('Configuración exportada exitosamente.');
    }, 100); 
}

async function importData(jsonFile) {
    if (!jsonFile) return;

    try {
        const text = await jsonFile.text();
        const importedData = JSON.parse(text);

        // Validar la estructura básica de los datos
        if (!Array.isArray(importedData) || importedData.length === 0 || !importedData[0].id) {
            alert('Error: El archivo JSON no parece ser un formato de configuración válido. Estructura incorrecta.');
            return;
        }

        // 1. Reemplazar datos
        data = importedData;
        
        // 2. Guardar en localStorage para persistencia
        saveData(data);
        
        // 3. Re-renderizar ambas vistas
        renderHitosConfig();
        renderHitos();
        
        showNotice('Configuración importada y aplicada con éxito.', 4000);

    } catch (e) {
        console.error('Error al importar el archivo:', e);
        alert('Error al procesar el archivo. Asegúrate de que sea un JSON válido.');
    }
}


/* ============================================
    Acciones globales de la vista configuracion
============================================ */
document.getElementById('btnAddHitoVisual')?.addEventListener('click', ()=>{
  const title = document.getElementById('addHitoTitleInput').value.trim();
  const priority = document.getElementById('addHitoPriority').value;
  if(!title) return alert('Ingresa título para el nuevo hito');
  
  const newH = { id: uid('h'), title, desc:'', priority, avance:0, subhitos:[] };
  data.push(newH);
  saveData(data);
  document.getElementById('addHitoTitleInput').value = '';
  renderHitosConfig();
  renderHitos();
  showNotice('Hito agregado');
});

document.getElementById('btnSaveAll')?.addEventListener('click', ()=>{
  saveData(data);
  renderHitos();
  showNotice('Cambios guardados');
});

/* Reset seed */
document.getElementById('btnResetSeed')?.addEventListener('click',()=>{
  if(!confirm('¿Restaurar datos iniciales? Esto eliminará todos los cambios.')) return;
  data = JSON.parse(JSON.stringify(seed)); // Deep copy del seed
  saveData(data);
  renderHitosConfig();
  renderHitos();
  showNotice('Datos restaurados');
});


// LISTENERS DE IMPORTACIÓN/EXPORTACIÓN
document.getElementById('btnExportData')?.addEventListener('click', exportData);

// Listener para Importar (maneja el selector de archivo oculto)
document.getElementById('fileInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if(confirm(`¿Estás seguro de que quieres importar "${file.name}"? Esto reemplazará la configuración actual.`)) {
             importData(file);
        }
    }
});


/* ============================================
    Inicialización
============================================ */
window.addEventListener('load',()=>{
  renderHitos();
  createConnectors();
});

window.addEventListener('resize',()=> createConnectors());
// Re-calcular conectores si hay scroll horizontal en el contenedor de hitos
wrap.addEventListener('scroll',()=> window.requestAnimationFrame(createConnectors()));
