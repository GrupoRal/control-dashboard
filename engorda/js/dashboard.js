// ----------- 1. CARGA Y PARSEO DEL CSV ------------
let datosOriginales = [];
let chartCategoria = null;

fetch('data/Rengo.csv')
  .then(res => res.text())
  .then(texto => {
    const filas = texto.trim().split(/\r?\n/);
    if (filas.length <= 1) {
      const err = document.getElementById('msg-error');
      if (err) err.textContent = 'Rengo.csv no tiene datos.';
      return;
    }

    // Detectar separador ; o ,
    const sep = filas[0].includes(';') ? ';' : ',';
    const headers = filas[0].split(sep).map(h => h.trim());

    const idx = nombre => headers.indexOf(nombre);

    const iAnio       = idx('Año');
    const iMes        = idx('MES');
    const iSemana     = idx('Semana');
    const iSourceName = idx('Source.Name');
    const iSector     = idx('Sector');
    const iPabellon   = idx('Pabellon');
    const iPesoVivo   = idx(' Peso Vivo ') !== -1 ? idx(' Peso Vivo ') : idx('Peso Vivo');
    const iEdad       = idx('Edad');
    const iGanancia   = idx('Ganancia');
    const iViajes     = idx('Viajes');
    const iAgrupa     = idx('Agrupacion CAT LIQ');

    if (iPesoVivo === -1) {
      const err = document.getElementById('msg-error');
      if (err) err.textContent = 'No se encontró la columna "Peso Vivo" en Rengo.csv.';
      return;
    }

    datosOriginales = filas
      .slice(1)
      .filter(l => l.trim().length > 0)
      .map(linea => {
        const cols = linea.split(sep);

        const num = v => {
          if (v === undefined || v === null) return NaN;
          return parseFloat(String(v).replace(',', '.'));
        };

        const edad     = iEdad     === -1 ? NaN : num(cols[iEdad]);
        const ganancia = iGanancia === -1 ? NaN : num(cols[iGanancia]);

        return {
          anio:      iAnio       === -1 ? '' : (cols[iAnio]       || '').trim(),
          mes:       iMes        === -1 ? '' : (cols[iMes]        || '').trim(),
          semana:    iSemana     === -1 ? '' : (cols[iSemana]     || '').trim(),
          sector:    iSector     === -1 ? '' : (cols[iSector]     || '').trim(),
          pabellon:  iPabellon   === -1 ? '' : (cols[iPabellon]   || '').trim(),
          diaLote:   iSourceName === -1 ? '' : (cols[iSourceName] || '').trim(),

          pesoVivo:  num(cols[iPesoVivo]),
          edad:      edad,
          ganancia:  ganancia, // asumimos que ya es kg/día

          viajes:    iViajes === -1 ? NaN : num(cols[iViajes]),
          categoria: iAgrupa === -1 ? 'Sin dato' : (cols[iAgrupa] || '').trim()
        };
      })
      .filter(r => !isNaN(r.pesoVivo)); // solo filas con peso vivo

    poblarFiltrosDinamicos(datosOriginales);
    aplicarFiltrosYActualizar();
  })
  .catch(err => {
    console.error(err);
    const e = document.getElementById('msg-error');
    if (e) e.textContent = 'Error al leer Rengo.csv.';
  });


// ----------- 2. FILTROS ------------------

const selAnio     = document.getElementById('f-anio');
const selMes      = document.getElementById('f-mes');
const selSemana   = document.getElementById('f-semana');
const selDiaLote  = document.getElementById('f-dia-lote');
const selSector   = document.getElementById('f-sector');
const selPabellon = document.getElementById('f-pabellon');
const btnClear    = document.getElementById('btn-clear');

function repoblarSelect(select, valores, textoTodos) {
  if (!select) return;

  const valorAnterior = select.value;

  // limpiar opciones
  select.innerHTML = '';

  // opción "Todos"
  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = textoTodos;
  select.appendChild(optAll);

  // valores únicos ordenados
  const unicos = Array.from(new Set(valores.filter(v => v && v !== ''))).sort();
  unicos.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });

  // si el valor anterior sigue existiendo → lo dejamos
  const existe = unicos.includes(valorAnterior);
  if (existe) {
    select.value = valorAnterior;
  } else {
    select.value = 'all';
  }
}

function poblarFiltrosDinamicos(rows) {
  repoblarSelect(selAnio,     rows.map(r => r.anio),    'Todos');
  repoblarSelect(selMes,      rows.map(r => r.mes),     'Todos');
  repoblarSelect(selSemana,   rows.map(r => r.semana),  'Todas');
  repoblarSelect(selDiaLote,  rows.map(r => r.diaLote), 'Todos');
  repoblarSelect(selSector,   rows.map(r => r.sector),  'Todos');
  repoblarSelect(selPabellon, rows.map(r => r.pabellon),'Todos');
}

function filtrar(rows) {
  return rows.filter(r =>
    (!selAnio    || selAnio.value    === 'all' || r.anio    === selAnio.value) &&
    (!selMes     || selMes.value     === 'all' || r.mes     === selMes.value) &&
    (!selSemana  || selSemana.value  === 'all' || r.semana  === selSemana.value) &&
    (!selDiaLote || selDiaLote.value === 'all' || r.diaLote === selDiaLote.value) &&
    (!selSector  || selSector.value  === 'all' || r.sector  === selSector.value) &&
    (!selPabellon|| selPabellon.value=== 'all' || r.pabellon=== selPabellon.value)
  );
}

if (selAnio) {
  selAnio.onchange =
  selMes.onchange =
  selSemana.onchange =
  selDiaLote.onchange =
  selSector.onchange =
  selPabellon.onchange = aplicarFiltrosYActualizar;
}

if (btnClear) {
  btnClear.onclick = () => {
    if (selAnio)     selAnio.value     = 'all';
    if (selMes)      selMes.value      = 'all';
    if (selSemana)   selSemana.value   = 'all';
    if (selDiaLote)  selDiaLote.value  = 'all';
    if (selSector)   selSector.value   = 'all';
    if (selPabellon) selPabellon.value = 'all';
    aplicarFiltrosYActualizar();
  };
}


// ----------- 3. CÁLCULOS Y GRÁFICOS ------------------

function aplicarFiltrosYActualizar() {
  const filtrados = filtrar(datosOriginales);

  // repoblar filtros según lo que queda
  poblarFiltrosDinamicos(filtrados);

  // actualizar KPIs y vista
  actualizarKPIs(filtrados);
  actualizarCategoria(filtrados);
  actualizarADGPorEdad(filtrados);
}

function promedio(arr) {
  if (!arr || !arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function actualizarKPIs(rows) {
  const kgTotales = rows.reduce((s, r) => s + (r.pesoVivo || 0), 0);
  const viajesTot = rows.reduce((s, r) => s + (isNaN(r.viajes) ? 0 : r.viajes), 0);
  const kgViaje   = viajesTot > 0 ? kgTotales / viajesTot : NaN;

  const pesoProm     = promedio(rows.map(r => r.pesoVivo || 0));
  const edadProm     = promedio(rows.map(r => (isNaN(r.edad) ? 0 : r.edad)));
  const gananciaProm = promedio(rows.map(r => (isNaN(r.ganancia) ? 0 : r.ganancia)));

  const fmtKg = v =>
    isNaN(v) ? 'N/D' : v.toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const fmt = v => (isNaN(v) ? 'N/D' : v.toFixed(2));

  const elKgTotal  = document.getElementById('kpi-kg-totales');
  const elViajes   = document.getElementById('kpi-viajes');
  const elKgViaje  = document.getElementById('kpi-kg-viaje');
  const elPesoProm = document.getElementById('kpi-peso-prom');
  const elEdadProm = document.getElementById('kpi-edad-prom');
  const elGDP      = document.getElementById('kpi-ganancia-prom');

  if (elKgTotal)  elKgTotal.textContent  = fmtKg(kgTotales);
  if (elViajes)   elViajes.textContent   = isNaN(viajesTot) ? 'N/D' : viajesTot.toFixed(0);
  if (elKgViaje)  elKgViaje.textContent  = isNaN(kgViaje) ? 'N/D' : kgViaje.toFixed(0);
  if (elPesoProm) elPesoProm.textContent = fmt(pesoProm) + ' kg';
  if (elEdadProm) elEdadProm.textContent =
    isNaN(edadProm) ? 'N/D' : edadProm.toFixed(0) + ' días';
  if (elGDP)      elGDP.textContent      =
    isNaN(gananciaProm) ? 'N/D' : gananciaProm.toFixed(3);

  // --- CÁLCULO DE CASTIGOS 8% y 40% ---

  const esCastigo8 = cat => {
    const c = (cat || '').trim().toUpperCase();
    return c === 'CASTIGO 8%';
  };

  const esCastigo40 = cat => {
    const c = (cat || '').trim().toUpperCase();
    return c === 'CASTIGO 40%';
  };

  let kgCastigo8 = 0;
  let kgCastigo40 = 0;

  rows.forEach(r => {
    const cat = r.categoria || '';
    if (esCastigo8(cat)) {
      kgCastigo8 += r.pesoVivo || 0;
    } else if (esCastigo40(cat)) {
      kgCastigo40 += r.pesoVivo || 0;
    }
  });

  const kgCastigos = kgCastigo8 + kgCastigo40;
  const pctCastigos = kgTotales > 0 ? (kgCastigos * 100 / kgTotales) : 0;

  const elPct   = document.getElementById('kpi-pct-castigos');
  const elKgC   = document.getElementById('kpi-kg-castigos');
  const elDet   = document.getElementById('kpi-detalle-castigos');
  const elAlert = document.getElementById('kpi-alerta-castigos');

  if (elPct) {
    elPct.textContent = isNaN(pctCastigos)
      ? 'N/D'
      : pctCastigos.toFixed(1) + ' %';
  }

  if (elKgC) {
    elKgC.textContent = fmtKg(kgCastigos);
  }

  if (elDet) {
    elDet.textContent =
      `8%: ${fmtKg(kgCastigo8)} kg | 40%: ${fmtKg(kgCastigo40)} kg`;
  }

  if (elAlert) {
    if (pctCastigos > 5) {
      elAlert.textContent = '⚠ Sobre meta';
      elAlert.style.color = '#e53935';   // rojo
    } else {
      elAlert.textContent = 'OK';
      elAlert.style.color = '#2e7d32';   // verde
    }
  }
}


// Gráfico por categoría (Agrupacion CAT LIQ)
function actualizarCategoria(rows) {
  const cont = {};
  let totalKg = 0;

  rows.forEach(r => {
    const cat = r.categoria && r.categoria !== '' ? r.categoria : 'Sin dato';
    if (!cont[cat]) cont[cat] = 0;
    cont[cat] += r.pesoVivo || 0;
    totalKg += r.pesoVivo || 0;
  });

  const categorias = Object.keys(cont).sort();
  const kgPorCat = categorias.map(c => cont[c]);

  const ctx = document.getElementById('chart-categoria');
  if (!ctx) return;

  if (chartCategoria) chartCategoria.destroy();

  chartCategoria = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categorias,
      datasets: [{
        label: 'Kg Peso Vivo',
        data: kgPorCat
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(ctx2) {
              const kg = ctx2.raw;
              const pct = totalKg > 0 ? (kg * 100 / totalKg) : 0;
              return `${kg.toLocaleString('es-CL', {maximumFractionDigits:0})} kg (${pct.toFixed(1)}%)`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}


// Tabla: Ganancia diaria por rango de edad
function actualizarADGPorEdad(rows) {
  const tabla = document.querySelector('#tabla-adg-edad tbody');
  if (!tabla) return;

  tabla.innerHTML = '';

  if (!rows || rows.length === 0) return;

  const tramos = [
    { label: '< 150',   min: 0,   max: 149 },
    { label: '150–170', min: 150, max: 170 },
    { label: '171–190', min: 171, max: 190 },
    { label: '> 190',   min: 191, max: Infinity }
  ];

  const totalKg = rows.reduce((s, r) => s + (r.pesoVivo || 0), 0);

  const resumen = tramos.map(t => ({
    label: t.label,
    min: t.min,
    max: t.max,
    count: 0,
    sumADG: 0,
    sumPeso: 0
  }));

  rows.forEach(r => {
    const edad = r.edad;
    const adg  = r.ganancia;  // asumimos ganancia diaria kg/día
    const peso = r.pesoVivo || 0;

    if (isNaN(edad) || edad <= 0 || isNaN(adg)) return;

    const tramo = resumen.find(t => edad >= t.min && edad <= t.max);
    if (!tramo) return;

    tramo.count   += 1;
    tramo.sumADG  += adg;
    tramo.sumPeso += peso;
  });

  resumen.forEach(t => {
    if (t.count === 0) return;

    const adgProm   = t.sumADG / t.count;
    const pesoProm  = t.sumPeso / t.count;
    const pctKg     = totalKg > 0 ? (t.sumPeso * 100 / totalKg) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.label}</td>
      <td style="text-align:right;">${t.count}</td>
      <td style="text-align:right;">${adgProm.toFixed(3)}</td>
      <td style="text-align:right;">${pesoProm.toFixed(0)}</td>
      <td style="text-align:right;">${pctKg.toFixed(1)}%</td>
    `;
    tabla.appendChild(tr);
  });
}
