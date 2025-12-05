console.log('app.js cargado ✔️');


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

// Cargar
function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) return JSON.parse(raw);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return JSON.parse(JSON.stringify(seed));
}

// Guardar
function saveData(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ============================================
   Estado en memoria
============================================ */
let data = loadData();
let currentOpen = null;
let currentView = 'visual';

/* UID simple */
function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

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

  if(v === 'config') populateConfigSelects();
  if(v === 'visual') createConnectors();
}

/* ============================================
   Render de hitos (Visualización)
============================================ */
const wrap = document.getElementById('hitosWrap');
const connectorLine = document.getElementById('connectorLine');
const detalleArea = document.getElementById('detalleArea');
const detalleInner = document.getElementById('detalleInner');
const detalleTitulo = document.getElementById('detalleTitulo');

function renderHitos(){
  wrap.querySelectorAll('.hito-card').forEach(n=>n.remove());

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

    wrap.appendChild(card);
  });

  createConnectors();
}

/* Abrir hito en Visualización */
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

/* ============================================
   Conectores entre hitos
============================================ */
function createConnectors(){
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
   CONFIGURACIÓN — Selects
============================================ */
function populateConfigSelects(){
  const selectH = document.getElementById('selectHitoEdit');
  const selectSub = document.getElementById('selectSubEdit');
  const selectDoc = document.getElementById('selectDocEdit');

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
   CONFIG — Editar Hitos
============================================ */
document.getElementById('selectHitoEdit').addEventListener('change',(e)=>{
  const hid=e.target.value;
  const h = data.find(x=>x.id===hid);

  document.getElementById('editHitoDesc').value = h? (h.desc||'') : '';
  document.getElementById('editHitoAvance').value = h? (h.avance||0) : '';

  const selectSub = document.getElementById('selectSubEdit');
  selectSub.innerHTML='<option value="">-- seleccionar sub-hito --</option>';

  if(h && h.subhitos){
    h.subhitos.forEach(s=>{
      const opt=document.createElement('option');
      opt.value=s.id;
      opt.textContent=s.title;
      selectSub.appendChild(opt);
    });
  }

  document.getElementById('selectDocEdit').innerHTML='<option value="">-- seleccionar documento --</option>';
});

/* Guardar Hito */
document.getElementById('btnSaveHito').addEventListener('click',()=>{
  const hid=document.getElementById('selectHitoEdit').value;
  if(!hid) return alert('Selecciona un hito');

  const h = data.find(x=>x.id===hid);
  h.desc = document.getElementById('editHitoDesc').value.trim();

  const av = parseInt(document.getElementById('editHitoAvance').value||'0',10);
  h.avance = isNaN(av)?0:av;

  saveData(data);
  renderHitos();
  alert('Hito guardado');
});

/* Eliminar Hito */
document.getElementById('btnDeleteHito').addEventListener('click',()=>{
  const hid=document.getElementById('selectHitoEdit').value;
  if(!hid) return alert('Selecciona hito');
  if(!confirm('¿Eliminar hito?')) return;

  data = data.filter(h=>h.id!==hid);
  saveData(data);

  populateConfigSelects();
  renderHitos();
});

/* Agregar Hito */
document.getElementById('btnAddHito').addEventListener('click',()=>{
  const title=document.getElementById('newHitoTitle').value.trim();
  const priority=document.getElementById('newHitoPriority').value;

  if(!title) return alert('Ingresa título');

  const newH={
    id:uid('h'),
    title,
    desc:'',
    priority,
    avance:0,
    subhitos:[]
  };

  data.push(newH);
  saveData(data);

  document.getElementById('newHitoTitle').value='';
  populateConfigSelects();
  renderHitos();
});

/* ============================================
   CONFIG — Editar Sub-Hitos
============================================ */
document.getElementById('selectSubEdit').addEventListener('change',(e)=>{
  const sid=e.target.value;
  const hid=document.getElementById('selectHitoEdit').value;
  const h = data.find(x=>x.id===hid);
  const s = h? h.subhitos.find(x=>x.id===sid) : null;

  document.getElementById('editSubTitle').value = s? s.title : '';
  document.getElementById('editSubAvance').value = s? (s.avance||0) : '';

  // llenar docs
  const selectDoc=document.getElementById('selectDocEdit');
  selectDoc.innerHTML='<option value="">-- seleccionar documento --</option>';

  if(s && s.docs){
    s.docs.forEach((docText,idx)=>{
      const opt=document.createElement('option');
      opt.value=idx;
      opt.textContent=docText;
      selectDoc.appendChild(opt);
    });
  }
});

/* Guardar Sub-Hito */
document.getElementById('btnSaveSub').addEventListener('click',()=>{
  const hid=document.getElementById('selectHitoEdit').value;
  const sid=document.getElementById('selectSubEdit').value;

  if(!hid || !sid) return alert('Selecciona hito y sub-hito');

  const h=data.find(x=>x.id===hid);
  const s=h.subhitos.find(x=>x.id===sid);

  s.title=document.getElementById('editSubTitle').value.trim();
  const av=parseInt(document.getElementById('editSubAvance').value||'0',10);
  s.avance=isNaN(av)?0:av;

  saveData(data);
  populateConfigSelects();
  renderHitos();
  alert('Sub-hito guardado');
});

/* Eliminar Sub-Hito */
document.getElementById('btnDeleteSub').addEventListener('click',()=>{
  const hid=document.getElementById('selectHitoEdit').value;
  const sid=document.getElementById('selectSubEdit').value;

  if(!hid || !sid) return alert('Selecciona sub-hito');
  if(!confirm('¿Eliminar sub-hito?')) return;

  const h=data.find(x=>x.id===hid);
  h.subhitos = h.subhitos.filter(s=>s.id!==sid);

  saveData(data);
  populateConfigSelects();
  renderHitos();
});

/* ============================================
   CONFIG — Documentos
============================================ */
document.getElementById('selectDocEdit').addEventListener('change',(e)=>{
  const docIndex=e.target.value;
  const hid=document.getElementById('selectHitoEdit').value;
  const sid=document.getElementById('selectSubEdit').value;

  if(!hid || !sid || docIndex===''){
    document.getElementById('editDocName').value='';
    return;
  }

  const h=data.find(x=>x.id===hid);
  const s=h.subhitos.find(x=>x.id===sid);
  const docText=s.docs[docIndex];

  const match = docText.match(/^(.*)\s\[(.*)\]$/);

  if(match){
    document.getElementById('editDocName').value = match[1];
    document.getElementById('editDocStatus').value = match[2];
  } else {
    document.getElementById('editDocName').value = docText;
    document.getElementById('editDocStatus').value = 'pending';
  }
});

/* Guardar Documento */
document.getElementById('btnSaveDoc').addEventListener('click',()=>{
  const hid=document.getElementById('selectHitoEdit').value;
  const sid=document.getElementById('selectSubEdit').value;
  const docIndex=document.getElementById('selectDocEdit').value;

  if(!hid || !sid || docIndex==='') return alert('Selecciona documento');

  const h=data.find(x=>x.id===hid);
  const s=h.subhitos.find(x=>x.id===sid);

  const newName=document.getElementById('editDocName').value.trim();
  const newStatus=document.getElementById('editDocStatus').value;

  if(!newName) return alert('Ingresa nombre');

  s.docs[docIndex] = `${newName} [${newStatus}]`;

  saveData(data);
  populateConfigSelects();
  renderHitos();

  alert('Documento guardado');
});

/* Eliminar Documento */
document.getElementById('btnDeleteDoc').addEventListener('click',()=>{
  const hid=document.getElementById('selectHitoEdit').value;
  const sid=document.getElementById('selectSubEdit').value;
  const docIndex=document.getElementById('selectDocEdit').value;

  if(!hid || !sid || docIndex==='') return alert('Selecciona documento');
  if(!confirm('¿Eliminar documento?')) return;

  const h=data.find(x=>x.id===hid);
  const s=h.subhitos.find(x=>x.id===sid);

  s.docs.splice(docIndex,1);

  saveData(data);
  populateConfigSelects();
  renderHitos();

  alert('Documento eliminado');
});

/* ============================================
   Exportar JSON
============================================ */
document.getElementById('btnExport').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);

  const a=document.createElement('a');
  a.href=url;
  a.download='planteles_export.json';
  a.click();

  URL.revokeObjectURL(url);
});

/* Reset a seed */
document.getElementById('btnResetSeed').addEventListener('click',()=>{
  if(!confirm('¿Restaurar datos iniciales?')) return;

  data = JSON.parse(JSON.stringify(seed));
  saveData(data);

  populateConfigSelects();
  renderHitos();

  detalleArea.style.display='none';
});

/* ============================================
   Inicialización
============================================ */
window.addEventListener('load',()=>{
  renderHitos();
  createConnectors();
  populateConfigSelects();
});

window.addEventListener('resize',()=> createConnectors());
wrap.addEventListener('scroll',()=> window.requestAnimationFrame(createConnectors));

