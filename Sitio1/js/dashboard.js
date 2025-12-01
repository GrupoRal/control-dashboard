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

// Ventanas biológicas
const MAX_GESTACION_DIAS = 114;    // S: días desde servicio
const MAX_LACTANCIA_DIAS = 23;     // L: días de lactancia
const MAX_W_LDC_DIAS     = 5;      // W en LDC
const MAX_W_ML_1020_DIAS = 7;      // W en ML con genética 1020
const MAX_W_OTROS_DIAS   = 5;      // W otros casos


let estadoChart = null;
let dataGlobal = [];   // CSV completo
let filtros = {
  ubicacion: "TODOS",
  genetica: "TODAS",
  partos: "TODOS"
};

let dataFiltradaActual = [];

// Para detalle de ventanas biológicas
let detalleVentanas = {
  gestacionPasada: [],
  lactanciaLarga: [],
  desteteFuera: []
};
let tipoVentanaSeleccionado = "TODAS"; // GESTACION, LACTANCIA, DESTETE, TODAS

// Se ejecuta al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  cargarDatosCSV("data/estado_madres_actual.csv");
  inicializarClicksTarjetas();
  inicializarBusqueda();        // 👈 QUE ESTÉ ESTA LÍNEA
  inicializarExportarVentanas && inicializarExportarVentanas(); // si ya la agregaste
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

// Inicializar clicks en tarjetas de ventanas biológicas
function inicializarClicksTarjetas() {
  const cardGest = document.getElementById("card-gestacion-pasada");
  const cardLact = document.getElementById("card-lactancia-larga");
  const cardDest = document.getElementById("card-destete-fuera");

  if (cardGest) {
    cardGest.addEventListener("click", () => {
      tipoVentanaSeleccionado =
        tipoVentanaSeleccionado === "GESTACION" ? "TODAS" : "GESTACION";
      renderizarTablaVentanas();
    });
  }

  if (cardLact) {
    cardLact.addEventListener("click", () => {
      tipoVentanaSeleccionado =
        tipoVentanaSeleccionado === "LACTANCIA" ? "TODAS" : "LACTANCIA";
      renderizarTablaVentanas();
    });
  }

  if (cardDest) {
    cardDest.addEventListener("click", () => {
      tipoVentanaSeleccionado =
        tipoVentanaSeleccionado === "DESTETE" ? "TODAS" : "DESTETE";
      renderizarTablaVentanas();
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

// Procesar datos filtrados y alimentar KPIs, ventanas biológicas, gráfico y tabla
function procesarDatosFiltrados(data) {
  dataFiltradaActual = data;  // 👈 IMPORTANTE

  if (!data || data.length === 0) {
    actualizarKPIs({
      total: 0,
      totalProductivas: 0,
      totalImproductivas: 0,
      listaRojaCount: 0
    });
    actualizarVentanasBiologicas(0, 0, 0);
    renderizarGraficoEstados({});
    renderizarListaRoja([]);
    renderizarTablaVentanas();
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

  // Cálculo de ventanas biológicas + detalle
  const {
    gestacionPasada,
    lactanciaLarga,
    desteteFuera,
    detalle
  } = calcularVentanasBiologicas(data);

  detalleVentanas = detalle;
  actualizarVentanasBiologicas(gestacionPasada, lactanciaLarga, desteteFuera);

  renderizarGraficoEstados(conteoEstados);
  renderizarListaRoja(listaRoja);
  renderizarTablaVentanas();
}

// Suma los estados indicados
function sumarPorEstados(conteoEstados, estados) {
  return estados.reduce((acc, est) => acc + (conteoEstados[est] || 0), 0);
}

// Actualiza las tarjetas KPI principales
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

// Calcula hembras fuera de ventana biológica + detalle
function calcularVentanasBiologicas(data) {
  let gestacionPasada = 0;
  let lactanciaLarga = 0;
  let desteteFuera = 0;

  const detalle = {
    gestacionPasada: [],
    lactanciaLarga: [],
    desteteFuera: []
  };

  data.forEach(row => {
    const estado = (row["Estado"] || "").toString().trim().toUpperCase();
    const dias = Number(row["Dia Proceso"] || 0);
    const ubic = (row["Ubicación"] || row["Ubicacion"] || "").toString().trim().toUpperCase();
    const genetica = (row["Genética"] || row["Genetica"] || "").toString().trim().toUpperCase();

    // Servidas con más de 114 días
    if (estado === "S" && dias > MAX_GESTACION_DIAS) {
      gestacionPasada++;
      detalle.gestacionPasada.push({ ...row, _tipo: "Gestación > 114 días" });
    }

    // Lactantes con más de 23 días
    if (estado === "L" && dias > MAX_LACTANCIA_DIAS) {
      lactanciaLarga++;
      detalle.lactanciaLarga.push({ ...row, _tipo: "Lactancia > 23 días" });
    }

    // Destetadas fuera de la ventana según reglas
    if (estado === "W") {
      let maxDiasPermitidos = MAX_W_OTROS_DIAS;

      if (ubic === "LDC") {
        maxDiasPermitidos = MAX_W_LDC_DIAS;
      } else if (ubic === "ML" && genetica === "1020") {
        maxDiasPermitidos = MAX_W_ML_1020_DIAS;
      }

      if (dias > maxDiasPermitidos) {
        desteteFuera++;
        detalle.desteteFuera.push({ ...row, _tipo: "Destetada fuera de ventana" });
      }
    }
  });

  return { gestacionPasada, lactanciaLarga, desteteFuera, detalle };
}

// Actualiza tarjetas de ventanas biológicas
function actualizarVentanasBiologicas(gestacionPasada, lactanciaLarga, desteteFuera) {
  const kGest = document.getElementById("kpi-gestacion-pasada");
  const kLact = document.getElementById("kpi-lactancia-larga");
  const kDest = document.getElementById("kpi-destete-fuera");

  if (kGest) kGest.textContent = gestacionPasada;
  if (kLact) kLact.textContent = lactanciaLarga;
  if (kDest) kDest.textContent = desteteFuera;
}

// Renderizar gráfico de barras por estado
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
  if (!tbody) return;
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

// Renderiza la tabla de detalle de ventanas biológicas
function renderizarTablaVentanas() {
  const tbody = document.getElementById("tabla-ventanas");
  const label = document.getElementById("label-detalle-ventanas");
  if (!tbody) return;

  tbody.innerHTML = "";

  let filas = [];
  let texto = "Mostrando: todas las categorías";

  if (tipoVentanaSeleccionado === "GESTACION") {
    filas = detalleVentanas.gestacionPasada;
    texto = "Mostrando: Gestación > 114 días";
  } else if (tipoVentanaSeleccionado === "LACTANCIA") {
    filas = detalleVentanas.lactanciaLarga;
    texto = "Mostrando: Lactancia > 23 días";
  } else if (tipoVentanaSeleccionado === "DESTETE") {
    filas = detalleVentanas.desteteFuera;
    texto = "Mostrando: Destetadas fuera de ventana";
  } else {
    filas = [
      ...detalleVentanas.gestacionPasada,
      ...detalleVentanas.lactanciaLarga,
      ...detalleVentanas.desteteFuera
    ];
  }

  if (label) label.textContent = texto;

  // Orden sencillo: por tipo y luego por días desc
  filas.sort((a, b) => {
    const tA = (a._tipo || "").localeCompare(b._tipo || "");
    if (tA !== 0) return tA;
    return (b["Dia Proceso"] || 0) - (a["Dia Proceso"] || 0);
  });

  filas.forEach(row => {
    const estado = (row["Estado"] || "").toString().trim().toUpperCase();
    const dias = row["Dia Proceso"] || 0;
    const partos = row["Partos"] || 0;
    const codigo = row["Código"] || row["Codigo"] || "";
    const ubicacion = row["Ubicación"] || row["Ubicacion"] || "";
    const genetica = row["Genética"] || row["Genetica"] || "";
    const grupo = row["Grupo"] || "";
    const tipo = row._tipo || "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${descripcionEstado(estado)}</td>
      <td>${dias}</td>
      <td>${partos}</td>
      <td>${ubicacion}</td>
      <td>${genetica}</td>
      <td>${grupo}</td>
      <td>${tipo}</td>
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

function inicializarBusqueda() {
  const input = document.getElementById("busqueda-codigo");
  const btn = document.getElementById("btn-buscar-codigo");
  if (!input || !btn) return;

  btn.addEventListener("click", () => buscarPorCodigo());
  input.addEventListener("keyup", (e) => {
    if (e.key === "Enter") buscarPorCodigo();
  });
}

function buscarPorCodigo() {
  const input = document.getElementById("busqueda-codigo");
  const tbody = document.getElementById("tabla-busqueda");
  const label = document.getElementById("label-busqueda");
  if (!input || !tbody || !label) return;

  const codigoBuscado = input.value.trim().toUpperCase();
  tbody.innerHTML = "";

  if (!codigoBuscado) {
    label.textContent = "Ingresa un código y presiona Buscar";
    return;
  }

  // Buscamos dentro de la data filtrada actual (respeta Ubicación, Genética, Partos)
  const resultados = dataFiltradaActual.filter(row => {
    const cod = (row["Código"] || row["Codigo"] || "").toString().trim().toUpperCase();
    return cod === codigoBuscado;
  });

  if (resultados.length === 0) {
    label.textContent = `No se encontró hembra con código ${codigoBuscado} en el filtro actual`;
    return;
  }

  label.textContent = `Resultados para código ${codigoBuscado} (${resultados.length})`;

  resultados.forEach(row => {
    const estado = (row["Estado"] || "").toString().trim().toUpperCase();
    const dias = row["Dia Proceso"] || 0;
    const partos = row["Partos"] || 0;
    const codigo = row["Código"] || row["Codigo"] || "";
    const ubicacion = row["Ubicación"] || row["Ubicacion"] || "";
    const genetica = row["Genética"] || row["Genetica"] || "";
    const grupo = row["Grupo"] || "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${descripcionEstado(estado)}</td>
      <td>${dias}</td>
      <td>${partos}</td>
      <td>${ubicacion}</td>
      <td>${genetica}</td>
      <td>${grupo}</td>
    `;
    tbody.appendChild(tr);
  });
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


