// Configuración de estados
const PRODUCTIVE_STATES = ["S", "L", "W"];  // Servidas, Lactantes, Destetadas
const PROBLEM_STATES   = ["H", "N", "A"];  // Celo no servido, Fallas, Abortadas

const ESTADO_DESCRIPCION = {
  "S": "Servida",
  "L": "Lactante",
  "W": "Destetada",
  "N": "No preñada (falla servicio)",
  "A": "Abortada",
  "H": "Celo no servido"
};

let estadoChart = null;
let dataGlobal = [];   // aquí guardamos todo el CSV
let filtros = {
  ubicacion: "TODOS",
  genetica: "TODAS",
  partos: "TODOS"
};

// Se ejecuta al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  cargarDatosCSV("data/estado_madres_actual.csv");
});

// Leer CSV usando PapaParse
function cargarDatosCSV(path) {
  Papa.parse(path, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
      dataGlobal = results.data || [];
      inicializarFiltros(dataGlobal);
      aplicarFiltrosYActualizar();
    },
    error: function (err) {
      console.error("Error cargando CSV", err);
    }
  });
}

// Inicializa los combos de filtro
function inicializarFiltros(data) {
  const selUbic = document.getElementById("filtro-ubicacion");
  const selGen  = document.getElementById("filtro-genetica");
  const selPar  = document.getElementById("filtro-partos");

  // --- UBICACIÓN (dinámica desde datos) ---
  if (selUbic) {
    const ubicacionesSet = new Set(
      data
        .map(r => (r["Ubicación"] || r["Ubicacion"] || "").toString().trim())
        .filter(v => v !== "")
    );
    const ubicaciones = Array.from(ubicacionesSet).sort();

    ubicaciones.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      selUbic.appendChild(opt);
    });

    selUbic.addEventListener("change", () => {
      filtros.ubicacion = selUbic.value || "TODOS";
      aplicarFiltrosYActualizar();
    });
  }

  // --- GENÉTICA (fija según tu criterio) ---
  if (selGen) {
    const opcionesGen = [
      { value: "1050", text: "1050 (incluye SUPERCERDA)" },
      { value: "1020", text: "1020" },
      { value: "SUPERCERDA_ONLY", text: "SUPERCERDA solo" }
    ];

    opcionesGen.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.text;
      selGen.appendChild(opt);
    });

    selGen.addEventListener("change", () => {
      filtros.genetica = selGen.value || "TODAS";
      aplicarFiltrosYActualizar();
    });
  }

  // --- PARTOS (0 a 10 fijos) ---
  if (selPar) {
    for (let p = 0; p <= 10; p++) {
      const opt = document.createElement("option");
      opt.value = String(p);
      opt.textContent = p;
      selPar.appendChild(opt);
    }

    selPar.addEventListener("change", () => {
      filtros.partos = selPar.value || "TODOS";
      aplicarFiltrosYActualizar();
    });
  }
}

// Aplica filtros sobre dataGlobal y refresca dashboard
function aplicarFiltrosYActualizar() {
  let filtrada = dataGlobal.slice();

  // Filtro Ubicación
  if (filtros.ubicacion !== "TODOS" && filtros.ubicacion) {
    filtrada = filtrada.filter(row => {
      const u = (row["Ubicación"] || row["Ubicacion"] || "").toString().trim();
      return u === filtros.ubicacion;
    });
  }

  // Filtro Genética
  if (filtros.genetica !== "TODAS" && filtros.genetica) {
    filtrada = filtrada.filter(row => {
      const gRow = (row["Genética"] || row["Genetica"] || "").toString().trim().toUpperCase();

      if (filtros.genetica === "1050") {
        // 1050 debe incluir genética 1050 y SUPERCERDA
        return gRow === "1050" || gRow === "SUPERCERDA";
      }

      if (filtros.genetica === "1020") {
        return gRow === "1020";
      }

      if (filtros.genetica === "SUPERCERDA_ONLY") {
        return gRow === "SUPERCERDA";
      }

      return true;
    });
  }

  // Filtro Partos
  if (filtros.partos !== "TODOS" && filtros.partos) {
    filtrada = filtrada.filter(row => {
      const pRow = row["Partos"];
      return Number(pRow) === Number(filtros.partos);
    });
  }

  procesarDatosFiltrados(filtrada);
}

// Procesar datos filtrados y alimentar KPIs, gráfico y tabla
function procesarDatosFiltrados(data) {
  if (!data || data.length === 0) {
    actualizarKPIs({
      total: 0,
      totalProductivas: 0,
      totalImproductivas: 0,
      listaRojaCount: 0
    });
    renderizarGraficoEstados({});
    renderizarListaRoja([]);
    return;
  }

  const total = data.length;

  // Conteo por estado
  const conteoEstados = {};
  data.forEach(row => {
    const estado = (row["Estado"] || "").toString().trim().toUpperCase();
    if (!conteoEstados[estado]) conteoEstados[estado] = 0;
    conteoEstados[estado]++;
  });

  // Cálculo de KPIs
  const totalProductivas = sumarPorEstados(conteoEstados, PRODUCTIVE_STATES);
  const totalImproductivas = sumarPorEstados(conteoEstados, PROBLEM_STATES);
  const listaRoja = data.filter(row =>
    PROBLEM_STATES.includes((row["Estado"] || "").toString().trim().toUpperCase())
  );

  actualizarKPIs({
    total,
    totalProductivas,
    totalImproductivas,
    listaRojaCount: listaRoja.length
  });

  renderizarGraficoEstados(conteoEstados);
  renderizarListaRoja(listaRoja);
}

// Suma los estados indicados
function sumarPorEstados(conteoEstados, estados) {
  return estados.reduce((acc, est) => acc + (conteoEstados[est] || 0), 0);
}

// Actualiza las tarjetas KPI
function actualizarKPIs({ total, totalProductivas, totalImproductivas, listaRojaCount }) {
  const kpiTotal = document.getElementById("kpi-total");
  const kpiProductivas = document.getElementById("kpi-productivas");
  const kpiImproductivas = document.getElementById("kpi-improductivas");
  const kpiListaRoja = document.getElementById("kpi-lista-roja");

  kpiTotal.textContent = total;

  const pctProd = total > 0 ? (totalProductivas / total * 100).toFixed(1) : "0.0";
  const pctImprod = total > 0 ? (totalImproductivas / total * 100).toFixed(1) : "0.0";

  kpiProductivas.textContent = `${pctProd}%`;
  kpiImproductivas.textContent = `${pctImprod}%`;
  kpiListaRoja.textContent = listaRojaCount;
}

// Gráfico de barras por estado
function renderizarGraficoEstados(conteoEstados) {
  const ctx = document.getElementById("estadoChart").getContext("2d");

  const estadosOrden = ["S", "L", "W", "H", "N", "A"];
  const labels = estadosOrden;
  const values = estadosOrden.map(e => conteoEstados[e] || 0);

  if (estadoChart) {
    estadoChart.destroy();
  }

  estadoChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "N° de hembras",
          data: values
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.parsed.y} hembras`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Estado"
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Cantidad"
          }
        }
      }
    }
  });
}

// Renderiza la tabla de lista roja (H + N + A)
function renderizarListaRoja(listaRoja) {
  const tbody = document.getElementById("tabla-lista-roja");
  tbody.innerHTML = "";

  // Orden: por estado y luego por días (desc)
  listaRoja.sort((a, b) => {
    const estA = (a["Estado"] || "").toString().toUpperCase();
    const estB = (b["Estado"] || "").toString().toUpperCase();
    if (estA === estB) {
      return (b["Dia Proceso"] || 0) - (a["Dia Proceso"] || 0);
    }
    return estA.localeCompare(estB);
  });

  listaRoja.forEach(row => {
    const estado = (row["Estado"] || "").toString().trim().toUpperCase();
    const dias = row["Dia Proceso"] || 0;
    const partos = row["Partos"] || 0;
    const codigo = row["Código"] || row["Codigo"] || "";
    const ubicacion = row["Ubicación"] || row["Ubicacion"] || "";
    const genetica = row["Genética"] || row["Genetica"] || "";
    const grupo = row["Grupo"] || "";

    const accion = sugerirAccion(estado, dias, partos);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${descripcionEstado(estado)}</td>
      <td>${dias}</td>
      <td>${partos}</td>
      <td>${ubicacion}</td>
      <td>${genetica}</td>
      <td>${grupo}</td>
      <td>${accion}</td>
    `;

    tbody.appendChild(tr);
  });
}

// Lógica de recomendación
function sugerirAccion(estado, dias, partos) {
  // Abortadas
  if (estado === "A") {
    if (partos >= 7) {
      return "ELIMINAR (aborto, alta paridad)";
    } else {
      return "Evaluar causa + re-servicio";
    }
  }

  // No preñadas / fallas
  if (estado === "N") {
    if (dias > 25) {
      return "ELIMINAR (falla >25 días)";
    } else if (dias >= 10) {
      return "Ecógrafo / decidir re-servicio";
    } else {
      return "Observar, programar ecógrafo";
    }
  }

  // Celo no servido
  if (estado === "H") {
    if (dias <= 7) {
      return "SERVIR esta semana";
    } else {
      return "Revisar detección/condición corporal";
    }
  }

  return "-";
}

// Colores + descripción por estado
function descripcionEstado(estado) {
  let colorClase = "bg-secondary";

  if (estado === "S" || estado === "L" || estado === "W") {
    colorClase = "bg-success"; // Verde
  } else if (estado === "H" || estado === "N") {
    colorClase = "bg-warning text-dark"; // Amarillo
  } else if (estado === "A") {
    colorClase = "bg-danger"; // Rojo
  }

  const desc = ESTADO_DESCRIPCION[estado] || estado || "-";

  return `<span class="badge badge-estado ${colorClase}">${desc}</span>`;
}

