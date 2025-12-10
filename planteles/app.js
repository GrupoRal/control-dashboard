/* planteles/app.js
   Carga preferente desde planteles/planteles_data.json -> localStorage -> seed
   + exportar JSON (planteles_export.json)
*/

/* Evitar ReferenceError para onclick inline: definir switchView temprano */
window.switchView = window.switchView || function(v){
  try {
    const visualEl = document.getElementById('visualView');
    const configEl = document.getElementById('configView');
    if(visualEl) visualEl.style.display = (v === 'visual') ? 'block' : 'none';
    if(configEl) configEl.style.display = (v === 'config') ? 'block' : 'none';
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    // Intentar llamar a funciones si ya existen
    if(v === 'config' && typeof populateConfigSelects === 'function') {
      try { populateConfigSelects(); } catch(e){ console.error(e); }
    }
    if(v === 'visual' && typeof createConnectors === 'function') {
      try { createConnectors(); } catch(e){ console.error(e); }
    }
  } catch(e){
    console.error('switchView early error', e);
  }
};

/* ============================================
   Persistencia y datos iniciales
============================================ */
const STORAGE_KEY = 'planteles_v3';

/* seed por defecto (mínimo ejemplo) */
const seed = [
  {
    id:'h1',
    title:'Hito 1 - Permiso de Edificación',
    desc:'Trámite y documentación para obtener permiso de edificación.',
    priority:'Alta',
    avance:0,
    subhitos:[
      { id:'h1s1', title:'Documentos Legales', avance:0, docs:[] },
      { id:'h1s2', title:'Documentos y Planos', avance:0, docs:[] },
      { id:'h1s3', title:'Documentos y Certificados Estatales', avance:0, docs:[] }
    ]
  }
];

/* Flag para saber si los datos vinieron del archivo en disco */
let dataFromFile = false;

/* loadData: intenta fetch('./planteles_data.json') y si falla usa localStorage o seed */
async function loadData(){
  // Intento de cargar archivo externo (planteles/planteles_data.json)
  const fileUrl = './planteles_data.json?t=' + Date.now(); // cache-bust
  try {
    const resp = await fetch(fileUrl, { cache: 'no-store' });
    if(resp.ok){
      const parsed = await resp.json();
      // validación mínima: debe ser array
      if(Array.isArray(parsed)){
        dataFromFile = true;
        console.info('Cargando datos desde planteles_data.json');
        return parsed;
      } else {
        console.warn('planteles_data.json cargado pero no es un array. Se usará fallback.');
      }
    } else {
      // 404 u otro: seguir con fallback
      console.debug('planteles_data.json no encontrado (status ' + resp.status + '), usando fallback.');
    }
  } catch (err) {
    console.debug('Error intentando leer planteles_data.json, usando fallback.', err);
  }

  // Fallback localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed;
      // si no es array, eliminar para evitar bucle
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('localStorage inválido -> se limpiará', err);
    localStorage.removeItem(STORAGE_KEY);
  }

  // Si nada, inicializar con seed
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return JSON.parse(JSON.stringify(seed));
}

/* Guardar en localStorage (cuando el usuario decide exportar/importar local) */
function saveDataLocal(d){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch(e){
    console.error('Error guardando en localStorage', e);
  }
}

/* ============================================
   Estado en memoria y utilidades
============================================ */
let data = []; // se inicializa en init
let currentOpen = null;

function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

/* ============================================
   Referencias DOM (se inicializan en DOMContentLoaded)
============================================ */
let wrap, connectorLine, detalleArea, detalleInner, detalleTitulo, configNotice;

/* ============================================
   Render (visual)
============================================ */
function renderHitos(){
  if(!wrap) return;
  wrap.querySelectorAll('.hito-card').forEach(n=>n.remove());
  const frag = document.createDocumentFragment();
  data.forEach(h => {
    const card = document.createElement('div');
    card.className = 'hito-card';
    card.dataset.id = h.id;
    card.onclick = ()=> openHito(h.id, card);
    card.innerHTML = `
      <div class="hito-title">${h.title}</div>
      <div class="hito-desc">${h.desc || ''}</div>
      <div class="hito-meta">
        <div class="badge">Avance ${h.avance || 0}%</div>
        <div class="muted" style="font-size:12px">${h.priority || ''}</div>
      </div>
    `;
    frag.appendChild(card);
  });
  wrap.appendChild(frag);
  // recalcular conectores en el siguiente frame
  window.requestAnimationFrame(()=> { if(typeof createConnectors === 'function') createConnectors(); });
}

function openHito(id, el){
  if(!detalleArea) return;
  document.querySelectorAll('.hito-card').forEach(c=>c.classList.remove('active'));
  if(currentOpen === id){
    detalleArea.style.display='none';
    currentOpen=null;
    return;
  }
  if(el) el.classList.add('active');
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
      const docs = (s.docs||[]).map(d=>`<li>${d}</li>`).join('');
      box.innerHTML = `
        <strong>${s.title}</strong>
        <div class="sub-prog">Avance: ${s.avance || 0}%</div>
        <ul class="docs">${docs}</ul>
      `;
      detalleInner.appendChild(box);
    });
  }
  detalleArea.style.display='block';
  if(el && el.scrollIntoView) el.scrollIntoView({behavior:'smooth',inline:'center'});
}

/* createConnectors (simple) */
function createConnectors(){
  if(!wrap || !connectorLine) return;
  document.querySelectorAll('.connector-dot').forEach(d=>d.remove());
  const cards = Array.from(wrap.querySelectorAll('.hito-card'));
  if(cards.length === 0){
    connectorLine.style.display='none';
    return;
  }
  const wrapRect = wrap.getBoundingClientRect();
  const firstRect = cards[0].getBoundingClientRect();
  const lineTop = (firstRect.top + firstRect.height/2) - wrapRect.top + wrap.scrollTop;
  connectorLine.style.top = `${lineTop}px`;
  connectorLine.style.display='block';
  const frag = document.createDocumentFragment();
  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const centerX = (rect.left + rect.right)/2 - wrapRect.left + wrap.scrollLeft;
    const dot = document.createElement('div');
    dot.className = 'connector-dot';
    dot.style.left = `${centerX}px`;
    dot.style.top = `${lineTop}px`;
    frag.appendChild(dot);
  });
  wrap.appendChild(frag);
}

/* ============================================
   CONFIG: populate selects (si existen)
============================================ */
function populateConfigSelects(){
  const selectH = document.getElementById('selectHitoEdit');
  const selectSub = document.getElementById('selectSubEdit');
  const selectDoc = document.getElementById('selectDocEdit');
  if(!selectH || !selectSub || !selectDoc){
    // selects pueden no existir según html; no es error
    return;
  }
  selectH.innerHTML = '<option value="">-- seleccionar --</option>';
  data.forEach(h=>{
    const o=document.createElement('option');
    o.value=h.id; o.textContent=h.title;
    selectH.appendChild(o);
  });
  selectSub.innerHTML = '<option value="">-- seleccionar sub-hito --</option>';
  selectDoc.innerHTML = '<option value="">-- seleccionar documento --</option>';
}

/* ============================================
   Exportar JSON: descarga el JSON actual (cliente)
============================================ */
function exportToFile(filename = 'planteles_export.json'){
  try{
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotice && showNotice('Archivo exportado: ' + filename);
  } catch(err){
    console.error('export error', err);
    alert('Error al exportar: ' + (err.message || err));
  }
}

/* ============================================
   Util: mostrar mensajes en UI si existe el contenedor
============================================ */
function showNotice(msg, timeout=2500){
  if(!configNotice) { console.log('NOTICE:', msg); return; }
  configNotice.textContent = msg;
  configNotice.style.display = 'block';
  setTimeout(()=>{ configNotice.style.display='none'; configNotice.textContent=''; }, timeout);
}

/* ============================================
   Inicialización asíncrona: carga de datos y enlazado de botones
============================================ */
async function initApp(){
  try {
    data = await loadData();

    // Inicializar referencias DOM
    wrap = document.getElementById('hitosWrap');
    connectorLine = document.getElementById('connectorLine');
    detalleArea = document.getElementById('detalleArea');
    detalleInner = document.getElementById('detalleInner');
    detalleTitulo = document.getElementById('detalleTitulo');
    configNotice = document.getElementById('configNotice');

    if(dataFromFile){
      showNotice('Cargando datos desde planteles_data.json');
    }

    renderHitos();
    // build config selects if present
    populateConfigSelects();

    // Enlazar botones si existen
    document.getElementById('btnExport')?.addEventListener('click', ()=> exportToFile());
    document.getElementById('btnResetSeed')?.addEventListener('click', ()=> {
      if(!confirm('¿Restaurar datos iniciales?')) return;
      data = JSON.parse(JSON.stringify(seed));
      saveDataLocal(data);
      renderHitos();
      populateConfigSelects();
      detalleArea && (detalleArea.style.display='none');
      showNotice('Datos restaurados');
    });

    // ejemplo: si quieres un botón que importe desde file input (no sobrescribe server)
    const fileInput = document.getElementById('fileImportInput');
    if(fileInput){
      fileInput.addEventListener('change', (e)=>{
        const f = e.target.files && e.target.files[0];
        if(!f) return;
        const reader = new FileReader();
        reader.onload = (ev)=>{
          try {
            const parsed = JSON.parse(ev.target.result);
            if(!Array.isArray(parsed)) throw new Error('Formato inválido');
            if(!confirm('Importar JSON reemplazará los datos locales. ¿Continuar?')) return;
            data = parsed;
            saveDataLocal(data);
            renderHitos();
            populateConfigSelects();
            showNotice('Importación completada');
          } catch(err){
            alert('Error importando JSON: ' + err.message);
          }
        };
        reader.readAsText(f);
      });
    }

    // asegurar tabs funcionan (fallback)
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', ()=> window.switchView(t.dataset.view));
    });

    // listeners de layout
    window.addEventListener('resize', ()=> { if(typeof createConnectors==='function') createConnectors(); });
    if(wrap){
      let ticking = false;
      wrap.addEventListener('scroll', ()=>{
        if(!ticking){
          window.requestAnimationFrame(()=> { createConnectors(); ticking = false; });
          ticking = true;
        }
      });
    }

  } catch(err){
    console.error('initApp error', err);
  }
}

/* Ejecutar init cuando el DOM esté listo */
window.addEventListener('DOMContentLoaded', ()=> initApp());

/* Exportar funciones útiles al scope global para debugging / consola */
window.planteles_exportToFile = exportToFile;
window.planteles_saveLocal = saveDataLocal;
