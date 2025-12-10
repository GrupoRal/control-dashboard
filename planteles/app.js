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

/* ============================================
   Carga de datos: ahora intentamos leer primero un archivo JSON en disco
   llamado planteles_data.json en la misma carpeta (planteles/planteles_data.json).
   Si existe y es válido, se usa ese archivo. Si no, se cae a localStorage,
   y finalmente al seed embebido.

   Flujo:
   - Si en el servidor /planteles/planteles_data.json existe: lo usamos.
   - Si no existe o falla, usamos localStorage (si hay datos).
   - Si no hay nada, guardamos el seed en localStorage y lo usamos.
============================================ */

/* Indicador si venimos desde archivo externo */
let dataFromExternalFile = false;

/* Cargar: intento de fetch del archivo externo y fallback a localStorage/seed */
async function loadData(){
  // Intentar cargar archivo JSON desde el mismo directorio (planteles/planteles_data.json)
  // Añadimos cache-bust param para evitar que el navegador devuelva una versión cacheada al probar nuevas cargas.
  try {
    const res = await fetch('./planteles_data.json?t=' + Date.now(), {cache: 'no-store'});
    if(res.ok){
      const parsed = await res.json();
      // Validación mínima: debe ser un array de hitos
      if(Array.isArray(parsed)){
        dataFromExternalFile = true;
        // NOTA: no escribimos automáticamente en localStorage para respetar el archivo en disco
        return parsed;
      }
    }
  } catch(err){
    // fallo al buscar el archivo (normal en entornos donde no existe); seguiremos con localStorage
    console.debug('No se encontró planteles_data.json o fallo al parsear, usando localStorage/seed', err);
  }

  // Fallback: localStorage
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try {
      return JSON.parse(raw);
    } catch(e){
      console.warn('localStorage contiene JSON inválido, se restaurará seed', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Si nada: guardar seed en localStorage y devolver una copia
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return JSON.parse(JSON.stringify(seed));
}

/* Guardar en localStorage */
function saveDataLocal(dataToSave){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch(e){
    console.error('Error guardando en localStorage', e);
  }
}

/* ============================================
   Estado en memoria y auxiliares
============================================ */
let data = []; // será inicializado en initApp()
let currentOpen = null;
let currentView = 'visual';

/* UID simple */
function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

/* ============================================
   Referencias DOM globales (algunas pueden no existir según HTML actual)
============================================ */
const wrap = document.getElementById('hitosWrap'); // vista visual
const connectorLine = document.getElementById('connectorLine');
const detalleArea = document.getElementById('detalleArea');
const detalleInner = document.getElementById('detalleInner');
const detalleTitulo = document.getElementById('detalleTitulo');

const configWrap = document.getElementById('hitosConfigWrap');
const configNotice = document.getElementById('configNotice');

/* ============================================
   Renders y lógica (se mantienen igual que previamente)
   He conservado las funciones principales (renderHitos, renderHitosConfig, createConnectors, etc.)
   Solo que ahora la inicialización es asíncrona y depende de loadData().
============================================ */

/* Render de hitos (Visualización) - optimized with fragment */
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

  window.requestAnimationFrame(createConnectors);
}

/* Abrir hito en Visualización */
function openHito(id, el){
  if(!detalleArea) return;
  document.querySelectorAll('.hito-card').forEach(c=>c.classList.remove('active'));

  if(currentOpen === id){
    detalleArea.style.display='none';
    currentOpen=null;
    return;
  }

  el.classList.add('active');
  currentOpen = id;
  const h = data.find(x=>x.id===id);

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
  el.scrollIntoView({behavior:'smooth',inline:'center'});
}

/* createConnectors optimized */
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
    let centerX;
    if(typeof card.offsetLeft === 'number' && typeof card.offsetWidth === 'number'){
      centerX = card.offsetLeft + (card.offsetWidth / 2) - wrap.scrollLeft;
    } else {
      const rect = card.getBoundingClientRect();
      centerX = (rect.left + rect.right)/2 - wrapRect.left + wrap.scrollLeft;
    }

    const dot = document.createElement('div');
    dot.className = 'connector-dot';
    dot.style.left = `${centerX}px`;
    dot.style.top = `${lineTop}px`;
    frag.appendChild(dot);
  });

  wrap.appendChild(frag);
}

/* ============================================
   Funciones de configuración visual (CRUD inline y reorder)
   (Conservadas de la versión previa; no las repito aquí para brevedad
    salvo si necesitas más cambios.)
============================================ */

/* (Se mantienen renderHitosConfig, attachCardHandlers, startEditHito, etc.
   tal como estaban en la versión anterior que copiaste.) */

/* ============================================
   Export / Import (local) y flujo recomendado para usar carpeta Planteles
============================================ */

/*
  Export:
  - Descarga un archivo JSON (planteles_export.json) con los datos actuales.
  - Instrucción para el usuario:
      Después de exportar, copia el archivo descargado en la carpeta planteles/ de tu servidor/servicio estático
      y renómbralo a planteles_data.json (sobrescribiendo el anterior si lo hubiera).
      Cuando el navegador cargue planteles/index.html, la app intentará leer planteles_data.json y
      usar esos datos como fuente principal.
*/
function exportToFile(filename = 'planteles_export.json'){
  try{
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Archivo exportado: ' + filename);
  } catch(err){
    alert('Error al exportar: ' + err.message);
  }
}

/*
  Import (desde archivo cargado por usuario):
  - Esto guarda en localStorage (no en el archivo del servidor).
  - Útil para pruebas locales o sincronizar manualmente entre equipos.
*/
function importFromFileContent(parsed){
  if(!Array.isArray(parsed)) return alert('Formato inválido: se esperaba un array de hitos');
  // confirm overwrite
  if(!confirm('Importar JSON reemplazará los datos actuales en este navegador. ¿Continuar?')) return;
  data = parsed;
  saveDataLocal(data);
  dataFromExternalFile = false;
  renderHitos();
  if(typeof renderHitosConfig === 'function') renderHitosConfig();
  showNotice('Datos importados en localStorage');
}

/* ============================================
   Utilidades UI y mensajes
============================================ */
function showNotice(msg, timeout=3000){
  if(!configNotice) { console.log('NOTICE:', msg); return; }
  configNotice.textContent = msg;
  configNotice.style.display = 'block';
  setTimeout(()=>{ configNotice.style.display='none'; configNotice.textContent=''; }, timeout);
}

/* ============================================
   Inicialización asíncrona
   - Ahora usamos initApp() para cargar datos (intentando planteles_data.json)
   - y luego arrancamos la UI.
============================================ */
async function initApp(){
  data = await loadData();

  // Si data proviene del archivo en la carpeta Planteles, avisamos al usuario
  if(dataFromExternalFile){
    showNotice('Cargando datos desde planteles_data.json (carpeta Planteles)');
  }

  renderHitos();
  // render config view only on demand (switchView will call renderHitosConfig)
  // renderHitosConfig if currently in config view
  if(currentView === 'config' && typeof renderHitosConfig === 'function') renderHitosConfig();

  // listeners optimizados para resize/scroll
  let resizeTimer = null;
  window.addEventListener('resize', ()=>{
    if(resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(()=> {
      createConnectors();
      resizeTimer = null;
    }, 120);
  });

  let ticking = false;
  if(wrap){
    wrap.addEventListener('scroll', ()=>{
      if(!ticking){
        window.requestAnimationFrame(()=>{
          createConnectors();
          ticking = false;
        });
        ticking = true;
      }
    });
  }
}

/* Ejecutar init */
window.addEventListener('load', ()=> {
  initApp();
});

/* ============================================
   Helpers: Exponer las funciones de export/import para conectarlas en el HTML
============================================ */
window.plantelesExportToFile = exportToFile;
window.plantelesImportFromFileContent = importFromFileContent;

/* ============================================
   Nota para el usuario / instrucciones breves:
   - Para que la app lea automáticamente desde la carpeta Planteles:
     1) Exporta tus datos con el botón Exportar (o usando plantelesExportToFile()).
     2) Copia el archivo descargado (por ejemplo planteles_export.json) a la carpeta planteles/
        del servidor donde sirves la app y renómbralo a planteles_data.json.
        (Ruta final: planteles/planteles_data.json)
     3) Recarga planteles/index.html en el navegador. La app intentará leer planteles_data.json
        y, si existe y es válido, usará esos datos como fuente.
   - Si quieres editar desde la UI y mantener esos cambios en el archivo del servidor:
     debes repetir el ciclo: editar → Exportar → sobrescribir planteles_data.json en la carpeta planteles.
   - Si prefieres sincronización automática entre máquinas, coméntamelo y preparo una API / backend sencillo
     (Node/Express) o integración con Firebase/Supabase.
============================================ */
