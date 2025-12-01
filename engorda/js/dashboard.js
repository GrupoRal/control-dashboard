// ----------- 1. CARGA Y PARSEO DEL CSV ------------
let datosOriginales = [];
let chartCategoria = null;

fetch('data/Rengo.csv')
  .then(res => res.text())
  .then(texto => {
    const filas = texto.trim().split(/\r?\n/);
    if (filas.length <= 1) {
      document.getElementById('msg-error').textContent = 'Rengo.csv no tiene datos.';
      return;
    }

    // Detectar separador
    const sep = filas[0].includes(';') ? ';' : ',';
    const headers = filas[0].split(sep).map(h => h.trim());

    const idx = nombre => headers.indexOf(nombre);

    const iAnio      = idx('Año');
    const iMes       = idx('MES');
    const iSemana    = idx('Semana');
    const iSourceName= idx('Source.Name');
    const iSector    = idx('Sector');
    const iPabellon  = idx('Pabellon');
    const iPesoVivo  = idx(' Peso Vivo ') !== -1 ? idx(' Peso Vivo ') : idx('Peso Vivo');
    const iEdad      = idx('Edad');
    const iGanancia  = idx('Ganancia');
    const iViajes    = idx('Viajes');
    const iAgrupa    = idx('Agrupacion CAT LIQ');

    if (iPesoVivo === -1) {
      document.getElementById('msg-error').textContent =
        'No se encontró la columna "Peso Vivo" en Rengo.csv.';
      return;
    }

    datosOriginales = filas
      .slice(1)
      .filter(l => l.trim().length > 0)
      .map(linea => {
        const cols = linea.split(sep);

        const num = v => {
          if (!v) return NaN;
          return parseFloat(String(v).replace(',', '.'));
        };

        const edad     = iEdad === -1 ? NaN : num(cols[iEdad]);
        const ganancia = iGanancia === -1 ? NaN : num(cols[iGanancia]);

        const gananciaDiaria =
          (!isNaN(edad) && edad > 0 && !isNaN(ganancia)) ? (ganancia / edad) : NaN;

        return {
          anio:     iAnio      === -1 ? '' : cols[iAnio].trim(),
          mes:      iMes       === -1 ? '' : cols[iMes].trim(),
          semana:   iSemana    === -1 ? '' : cols[iSemana].trim(),
          sector:   iSector    === -1 ? '' : cols[iSector].trim(),
          pabellon: iPabellon  === -1 ? '' : cols[iPabellon].trim(),
          diaLote:  iSourceName=== -1 ? '' : cols[iSourceName].trim(),

          pesoVivo: num(cols[iPesoVivo]),
          edad:     edad,
          ganancia: ganancia,

          viajes:   iViajes === -1 ? NaN : num(cols[iViajes]),
          categoria: iAgrupa === -1 ? 'Sin dato' : cols[iAgrupa].trim()
        };
      })
      .filter(r => !isNaN(r.pesoVivo)); // solo filas con peso vivo

    poblarFiltrosDinamicos(datosOriginales);
    aplicarFiltrosYActualizar();
  })
  .catch(err => {
    console.error(err);
    document.getElementById('msg-error').textContent = 'Error al leer Rengo.csv.';
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
    (selAnio.value    === 'all' || r.anio    === selAnio.value) &&
    (selMes.value     === 'all' || r.mes     === selMes.value) &&
    (selSemana.value  === 'all' || r.semana  === selSemana.value) &&
    (selDiaLote.value === 'all' || r.diaLote === selDiaLote.value) &&
    (selSector.value  === 'all' || r.sector  === selSector.value) &&
    (selPabellon.value=== 'all' || r.pabellon=== selPabellon.value)
  );
}

selAnio.onchange =
selMes.onchange =
selSemana.onchange =
selDiaLote.onchange =
selSector.onchange =
selPabellon.onchange = aplicarFiltrosYActualizar;

btnClear.onclick = () => {
  selAnio.value     = 'all';
  selMes.value      = 'all';
  selSemana.value   = 'all';
  selDiaLote.value  = 'all';
  selSector.value   = 'all';
  selPabellon.value = 'all';
  aplicarFiltrosYActualizar();
};

// ----------- 3. CÁLCULOS Y GRÁFICOS ------------------

function aplicarFiltrosYActualizar() {
  const filtrados = filtrar(datosOriginales);

  // 1) repoblar filtros según los datos que quedan
  poblarFiltrosDinamicos(filtrados);

  // 2) actualizar KPIs y gráficos
  actualizarKPIs(filtrados);
  actualizarCategoria(filtrados);
}

function promedio(arr) {
  if (!arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function actualizarKPIs(rows) {
  const kgTotales = rows.reduce((s, r) => s + r.pesoVivo, 0);
  const viajesTot = rows.reduce((s, r) => s + (isNaN(r.viajes) ? 0 : r.viajes), 0);
  const kgViaje   = viajesTot > 0 ? kgTotales / viajesTot : NaN;

  const pesoProm   = promedio(rows.map(r => r.pesoVivo));
  const edadProm   = promedio(rows.map(r => (isNaN(r.edad) ? 0 : r.edad)));
  const gananciaProm = promedio(rows.map(r => (isNaN(r.ganancia) ? 0 : r.ganancia)));

  const fmtKg = v =>
    isNaN(v) ? 'N/D' : v.toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const fmt = v => (isNaN(v) ? 'N/D' : v.toFixed(2));

  document.getElementById('kpi-kg-totales').textContent = fmtKg(kgTotales);
  document.getElementById('kpi-viajes').textContent =
    isNaN(viajesTot) ? 'N/D' : viajesTot.toFixed(0);
  document.getElementById('kpi-kg-viaje').textContent =
    isNaN(kgViaje) ? 'N/D' : kgViaje.toFixed(0);

  document.getElementById('kpi-peso-prom').textContent = fmt(pesoProm) + ' kg';
  document.getElementById('kpi-edad-prom').textContent =
    isNaN(edadProm) ? 'N/D' : edadProm.toFixed(0) + ' días';
  document.getElementById('kpi-ganancia-prom').textContent =
    isNaN(gananciaProm) ? 'N/D' : gananciaProm.toFixed(2);

  // --- CÁLCULO DE CASTIGOS 8% y 40% ---
  // OJO: ajusta los nombres si en tu CSV las categorías se llaman distinto
  // por ejemplo "CASTIGO 8%" o "DESCUENTO 8", etc.
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

  const elPct = document.getElementById('kpi-pct-castigos');
  const elKg = document.getElementById('kpi-kg-castigos');
  const elDet = document.getElementById('kpi-detalle-castigos');
  const elAlert = document.getElementById('kpi-alerta-castigos');

  if (elPct) {
    elPct.textContent = isNaN(pctCastigos)
      ? 'N/D'
      : pctCastigos.toFixed(1) + ' %';
  }

  if (elKg) {
    elKg.textContent = fmtKg(kgCastigos);
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

function actualizarCategoria(rows) {
  const cont = {};
  let totalKg = 0;

  rows.forEach(r => {
    const cat = r.categoria && r.categoria !== '' ? r.categoria : 'Sin dato';
    if (!cont[cat]) cont[cat] = 0;
    cont[cat] += r.pesoVivo;
    totalKg += r.pesoVivo;
  });

  const categorias = Object.keys(cont).sort();
  const kgPorCat = categorias.map(c => cont[c]);

  // Tabla resumen
  const tbody = document.querySelector('#tabla-categoria tbody');
  tbody.innerHTML = '';
  categorias.forEach(cat => {
    const kg = cont[cat];
    const pct = totalKg > 0 ? (kg * 100 / totalKg) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cat}</td>
      <td style="text-align:right;">${kg.toLocaleString('es-CL', {maximumFractionDigits:0})}</td>
      <td style="text-align:right;">${pct.toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  });

  // Chart
  const ctx = document.getElementById('chart-categoria');
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

