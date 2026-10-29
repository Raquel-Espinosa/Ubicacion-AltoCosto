// ==========================================================================
// LÓGICA PRINCIPAL DE LA APLICACIÓN - CONTROL DE GRUPOS DE ENTREGA Y AUDITORÍA
// ==========================================================================

const AppState = {
  currentUser: null,
  currentArea: "AUDITAR", // "AUDITAR" (7 chars) | "TARIMAS" (2 chars)
  currentTipo: "ENTRADA", // "ENTRADA" | "SALIDA"
  lastHistorial: [],
  isSubmitting: false
};

document.addEventListener("DOMContentLoaded", () => {
  API.initDemoData();
  updateConnectionBadge();
  bindEvents();
  renderQuickUbicaciones();
  updateCaptureModeUI();
  restoreSession();
});

// ==========================================================================
// SONIDO DE RETROALIMENTACIÓN PARA ESCÁNER (BEEP)
// ==========================================================================
function playScannerBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? "sine" : "sawtooth";
    osc.frequency.setValueAtTime(success ? 880 : 240, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.11 : 0.25));
  } catch (e) {
    // Ignorar si el navegador bloquea audio sin interacción
  }
}

function showToast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3800);
}

// ==========================================================================
// CONEXIÓN Y CONFIGURACIÓN
// ==========================================================================
function updateConnectionBadge() {
  const btn = document.getElementById("btnConnectionStatus");
  const txt = document.getElementById("statusText");
  if (CONFIG.DEMO_MODE) {
    btn.className = "badge-status demo";
    txt.textContent = "Modo Demo (Local)";
  } else {
    btn.className = "badge-status live";
    txt.textContent = "Conectado a Google Sheets";
  }
}

function openConfigModal() {
  document.getElementById("inputAppsScriptUrl").value = CONFIG.APPS_SCRIPT_WEBAPP_URL || "";
  document.getElementById("chkDemoMode").checked = CONFIG.DEMO_MODE;
  document.getElementById("modalConfig").classList.remove("hidden");
}

function closeConfigModal() {
  document.getElementById("modalConfig").classList.add("hidden");
}

// ==========================================================================
// SESIÓN Y PERMISOS POR ROL (OPERATIVO vs ADMINISTRATIVO)
// ==========================================================================
function restoreSession() {
  const saved = sessionStorage.getItem("grupos_entrega_user");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      setLoggedUser(user);
    } catch (e) {
      sessionStorage.removeItem("grupos_entrega_user");
    }
  }
}

function setLoggedUser(user) {
  AppState.currentUser = user;
  sessionStorage.setItem("grupos_entrega_user", JSON.stringify(user));

  document.getElementById("viewLogin").classList.add("hidden");
  document.getElementById("viewApp").classList.remove("hidden");
  document.getElementById("userHeaderInfo").classList.remove("hidden");

  document.getElementById("lblUserName").textContent = user.nombre || user.usuario;
  const roleBadge = document.getElementById("lblUserRole");
  const isAdmin = String(user.rol).toLowerCase().includes("admin");
  roleBadge.textContent = isAdmin ? "Administrativo" : "Operativo";
  roleBadge.className = `role-tag ${isAdmin ? "admin" : "operativo"}`;

  // Mostrar/ocultar pestañas exclusivas del Administrativo
  const tabBtnBuscar = document.getElementById("tabBtnBuscar");
  const tabBtnUsuarios = document.getElementById("tabBtnUsuarios");
  if (isAdmin) {
    tabBtnBuscar.classList.remove("hidden");
    tabBtnUsuarios.classList.remove("hidden");
  } else {
    tabBtnBuscar.classList.add("hidden");
    tabBtnUsuarios.classList.add("hidden");
  }

  switchTab("tabCaptura");
  loadMovimientosRecientes();
  setTimeout(() => document.getElementById("inputTienda").focus(), 120);
}

function logout() {
  AppState.currentUser = null;
  sessionStorage.removeItem("grupos_entrega_user");
  document.getElementById("userHeaderInfo").classList.add("hidden");
  document.getElementById("viewApp").classList.add("hidden");
  document.getElementById("viewLogin").classList.remove("hidden");
  document.getElementById("loginPass").value = "";
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.toggle("hidden", pane.id !== tabId);
  });

  if (tabId === "tabCaptura") {
    loadMovimientosRecientes();
    setTimeout(() => document.getElementById("inputTienda").focus(), 100);
  } else if (tabId === "tabBuscar") {
    ejecutarBusquedaGrupo();
    setTimeout(() => document.getElementById("searchGrupoInput").focus(), 100);
  } else if (tabId === "tabUsuarios") {
    cargarListaUsuarios();
  }
}

// ==========================================================================
// LÓGICA DE INTERFAZ DE CAPTURA (AUDITAR 7 DÍGITOS vs TARIMAS 2 DÍGITOS)
// ==========================================================================
function updateCaptureModeUI() {
  const isAuditar = AppState.currentArea === "AUDITAR";
  const isEntrada = AppState.currentTipo === "ENTRADA";

  const btnAuditar = document.getElementById("btnModeAuditar");
  const btnTarimas = document.getElementById("btnModeTarimas");
  btnAuditar.className = `mode-btn ${isAuditar ? "active-auditar" : ""}`;
  btnTarimas.className = `mode-btn ${!isAuditar ? "active-tarimas" : ""}`;

  const btnEntrada = document.getElementById("btnTipoEntrada");
  const btnSalida = document.getElementById("btnTipoSalida");
  btnEntrada.className = `mode-btn ${isEntrada ? "active-entrada" : ""}`;
  btnSalida.className = `mode-btn ${!isEntrada ? "active-salida" : ""}`;

  const lblUbicacion = document.getElementById("lblUbicacionTitulo");
  const inputUbicacion = document.getElementById("inputUbicacion");

  if (isAuditar) {
    lblUbicacion.textContent = "📍 Ubicación para Auditar (7 caracteres)";
    inputUbicacion.maxLength = 7;
    inputUbicacion.placeholder = "Ej. SA-01-1, SA-01-2, SA-01-3, SA-02-1";
  } else {
    lblUbicacion.textContent = "📍 Ubicación en Tarimas (2 caracteres)";
    inputUbicacion.maxLength = 2;
    inputUbicacion.placeholder = "Ej. K1, K2, K3, L1";
    if (inputUbicacion.value.length > 2) {
      inputUbicacion.value = inputUbicacion.value.slice(0, 2);
    }
  }

  const btnSubmit = document.getElementById("btnGuardarMovimiento");
  const accionTxt = isEntrada ? "ENTRADA" : "SALIDA";
  const areaTxt = isAuditar ? "AUDITAR" : "TARIMAS";
  btnSubmit.textContent = `${isEntrada ? "📥" : "📤"} REGISTRAR ${accionTxt} EN ${areaTxt}`;
  btnSubmit.style.background = isEntrada ? "var(--entrada-color)" : "var(--salida-color)";
  btnSubmit.style.color = "#052e16";

  renderQuickUbicaciones();
  updateCounters();
}

function renderQuickUbicaciones() {
  const container = document.getElementById("quickUbicaciones");
  container.innerHTML = "";
  const list = AppState.currentArea === "AUDITAR"
    ? CONFIG.UBICACIONES_AUDITAR
    : CONFIG.UBICACIONES_TARIMAS;

  list.forEach(ub => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = ub;
    chip.addEventListener("click", () => {
      const inputUb = document.getElementById("inputUbicacion");
      inputUb.value = ub;
      updateCounters();
      if (
        document.getElementById("chkAutoSubmit").checked &&
        isCaptureFormValid()
      ) {
        handleRegistrarSubmit(new Event("submit"));
      } else {
        inputUb.focus();
      }
    });
    container.appendChild(chip);
  });
}

/**
 * Normaliza la ubicación mientras se escribe o escanea:
 * En modo AUDITAR (7 caracteres): si escanean "SA011" sin guiones, lo formatea a "SA-01-1".
 */
function normalizeUbicacionInput(rawVal) {
  let val = String(rawVal || "").toUpperCase().trim();
  if (AppState.currentArea === "AUDITAR") {
    // Si escriben o escanean p.ej. SA011 (2 letras + 2 dígitos + 1 dígito = 5 chars sin guiones)
    if (/^[A-Z]{2}\d{3}$/.test(val)) {
      val = `${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4, 5)}`;
    }
    return val.slice(0, 7);
  } else {
    // Modo TARIMAS: 2 caracteres (K1, K2, L1, etc.)
    return val.replace(/[^A-Z0-9]/g, "").slice(0, 2);
  }
}

function updateCounters() {
  const tienda = document.getElementById("inputTienda").value.trim();
  const entrega = document.getElementById("inputEntrega").value.trim();
  const ubicacion = document.getElementById("inputUbicacion").value.trim();

  const reqUbLen = AppState.currentArea === "AUDITAR" ? 7 : 2;

  const cTienda = document.getElementById("counterTienda");
  cTienda.textContent = `${tienda.length} / 4 dígitos`;
  cTienda.classList.toggle("valid", /^\d{4}$/.test(tienda));
  document.getElementById("inputTienda").classList.toggle("input-valid", /^\d{4}$/.test(tienda));

  const cEntrega = document.getElementById("counterEntrega");
  cEntrega.textContent = `${entrega.length} / 8 dígitos`;
  cEntrega.classList.toggle("valid", /^\d{8}$/.test(entrega));
  document.getElementById("inputEntrega").classList.toggle("input-valid", /^\d{8}$/.test(entrega));

  const cUb = document.getElementById("counterUbicacion");
  cUb.textContent = `${ubicacion.length} / ${reqUbLen} caracteres`;
  cUb.classList.toggle("valid", ubicacion.length === reqUbLen);
  document.getElementById("inputUbicacion").classList.toggle("input-valid", ubicacion.length === reqUbLen);
}

function isCaptureFormValid() {
  const tienda = document.getElementById("inputTienda").value.trim();
  const entrega = document.getElementById("inputEntrega").value.trim();
  const ubicacion = document.getElementById("inputUbicacion").value.trim();
  const reqUbLen = AppState.currentArea === "AUDITAR" ? 7 : 2;

  return /^\d{4}$/.test(tienda) && /^\d{8}$/.test(entrega) && ubicacion.length === reqUbLen;
}

// ==========================================================================
// GUARDAR MOVIMIENTO (ENTRADA / SALIDA)
// ==========================================================================
async function handleRegistrarSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (AppState.isSubmitting) return;

  const tienda = document.getElementById("inputTienda").value.trim();
  const entrega = document.getElementById("inputEntrega").value.trim();
  const ubicacion = normalizeUbicacionInput(document.getElementById("inputUbicacion").value);
  const observaciones = document.getElementById("inputObservaciones").value.trim();

  const reqUbLen = AppState.currentArea === "AUDITAR" ? 7 : 2;

  if (!/^\d{4}$/.test(tienda)) {
    playScannerBeep(false);
    showToast("La Tienda debe tener exactamente 4 dígitos (ej. 7101).", "error");
    document.getElementById("inputTienda").focus();
    return;
  }
  if (!/^\d{8}$/.test(entrega)) {
    playScannerBeep(false);
    showToast("La Entrega / Grupo debe tener exactamente 8 dígitos.", "error");
    document.getElementById("inputEntrega").focus();
    return;
  }
  if (ubicacion.length !== reqUbLen) {
    playScannerBeep(false);
    const ej = AppState.currentArea === "AUDITAR" ? "SA-01-1 (7 caracteres)" : "K1, L1 (2 caracteres)";
    showToast(`La Ubicación debe tener ${reqUbLen} caracteres. Ejemplo: ${ej}`, "error");
    document.getElementById("inputUbicacion").focus();
    return;
  }

  AppState.isSubmitting = true;
  const btn = document.getElementById("btnGuardarMovimiento");
  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Guardando registro...";

  try {
    const res = await API.registrarMovimiento({
      area: AppState.currentArea,
      tipoMovimiento: AppState.currentTipo,
      tienda,
      entrega,
      ubicacion,
      observaciones,
      usuario: AppState.currentUser ? AppState.currentUser.usuario : "operativo",
      nombreUsuario: AppState.currentUser ? AppState.currentUser.nombre : "Operador",
      rolUsuario: AppState.currentUser ? AppState.currentUser.rol : "Operativo"
    });

    if (res.success) {
      playScannerBeep(true);
      showToast(`✅ ${res.message}`, "success");

      // Mostrar banner de última captura
      const banner = document.getElementById("lastScanBanner");
      const details = document.getElementById("lastScanDetails");
      banner.classList.remove("hidden");
      details.textContent = `${AppState.currentTipo} | ${AppState.currentArea} | Tienda: ${tienda} | Grupo: ${entrega} ➔ Ubicación: ${ubicacion} (${res.movimiento.fechaHora})`;

      // Limpiar para siguiente escaneo inmediato
      limpiarFormularioCaptura();
      await loadMovimientosRecientes();
    } else {
      playScannerBeep(false);
      showToast(res.message || "Error al guardar el movimiento", "error");
    }
  } catch (err) {
    playScannerBeep(false);
    showToast("Error de red al conectar con Google Sheets: " + err.message, "error");
  } finally {
    AppState.isSubmitting = false;
    btn.disabled = false;
    btn.textContent = prevText;
  }
}

function limpiarFormularioCaptura() {
  document.getElementById("inputTienda").value = "";
  document.getElementById("inputEntrega").value = "";
  document.getElementById("inputUbicacion").value = "";
  document.getElementById("inputObservaciones").value = "";
  updateCounters();
  document.getElementById("inputTienda").focus();
}

async function loadMovimientosRecientes() {
  try {
    const res = await API.buscarGrupo("", "", "TODAS");
    if (!res.success) return;

    const tbody = document.getElementById("tbodyRecientes");
    const rec = (res.historial || []).slice(0, 25);

    if (rec.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Aún no hay movimientos registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = rec.map(m => {
      const pillMov = m.tipoMovimiento === "ENTRADA" ? "pill-entrada" : "pill-salida";
      const pillArea = m.area === "AUDITAR" ? "pill-auditar" : "pill-tarimas";
      return `
        <tr>
          <td style="font-family:monospace; font-size:0.78rem;">${escapeHtml(m.fechaHora)}</td>
          <td><span class="pill ${pillArea}">${escapeHtml(m.area)}</span></td>
          <td><span class="pill ${pillMov}">${escapeHtml(m.tipoMovimiento)}</span></td>
          <td style="font-family:monospace; font-weight:700;">${escapeHtml(m.tienda)}</td>
          <td style="font-family:monospace; font-weight:700; color:#60a5fa;">${escapeHtml(m.entrega)}</td>
          <td style="font-family:monospace; font-weight:800;">${escapeHtml(m.ubicacion)}</td>
        </tr>
      `;
    }).join("");
  } catch (e) {
    console.error(e);
  }
}

// ==========================================================================
// BUSCADOR DE GRUPOS Y FECHAS DE ENTRADA/SALIDA (ADMINISTRATIVO)
// ==========================================================================
async function ejecutarBusquedaGrupo(e) {
  if (e && e.preventDefault) e.preventDefault();

  const qGrupo = document.getElementById("searchGrupoInput").value.trim();
  const qTienda = document.getElementById("searchTiendaInput").value.trim();
  const qArea = document.getElementById("searchAreaSelect").value;

  const containerGrupos = document.getElementById("resultadosGruposContainer");
  const tbodyHistorial = document.getElementById("tbodyHistorial");

  containerGrupos.innerHTML = `<div class="card" style="margin-bottom:1rem; color:var(--text-muted);">Consultando información...</div>`;

  try {
    const res = await API.buscarGrupo(qGrupo, qTienda, qArea);
    if (!res.success) {
      showToast(res.message || "No se pudo realizar la búsqueda", "error");
      return;
    }

    AppState.lastHistorial = res.historial || [];
    document.getElementById("lblTotalHistorial").textContent = `${AppState.lastHistorial.length} movimientos`;

    // Renderizar Tarjetas Resumen de cada Grupo encontrado
    const grupos = res.grupos || [];
    if (grupos.length === 0) {
      containerGrupos.innerHTML = `
        <div class="card" style="margin-bottom:1.25rem; text-align:center; color:var(--text-muted);">
          No se encontró ningún grupo con el criterio <strong>${escapeHtml(qGrupo || "actual")}</strong>.
        </div>
      `;
    } else {
      // Si no hay filtro escrito, mostrar los primeros 6 grupos más recientes para no saturar, o todos si hay búsqueda
      const mostrarGrupos = qGrupo || qTienda ? grupos : grupos.slice(0, 6);
      containerGrupos.innerHTML = mostrarGrupos.map(g => {
        const enUbicacion = g.ultimoMovimiento === "ENTRADA";
        const badgeClass = enUbicacion ? "pill-entrada" : "pill-salida";
        const areaClass = g.areaActual === "AUDITAR" ? "pill-auditar" : "pill-tarimas";

        return `
          <div class="grupo-result-card">
            <div class="grupo-header">
              <div>
                <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Grupo / Entrega (8 dígitos)</span>
                <div class="grupo-number">📦 ${escapeHtml(g.entrega)}</div>
              </div>
              <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                <span class="pill ${areaClass}">ÁREA: ${escapeHtml(g.areaActual)}</span>
                <span class="pill ${badgeClass}">${escapeHtml(g.estadoActual)}</span>
              </div>
            </div>

            <div class="grupo-details-grid">
              <div class="detail-box">
                <div class="detail-label">📍 Ubicación Actual / Última</div>
                <div class="detail-value" style="font-family:monospace; font-size:1.2rem; color:#38bdf8;">
                  ${escapeHtml(g.ubicacionActual || "—")}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">
                  Tienda: <strong>${escapeHtml(g.tienda)}</strong>
                </div>
              </div>

              <div class="detail-box">
                <div class="detail-label">📥 Fecha y Hora de ENTRADA</div>
                <div class="detail-value" style="color:#6ee7b7; font-family:monospace;">
                  ${escapeHtml(g.fechaHoraEntrada || "Sin registro de entrada")}
                </div>
                <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.15rem;">
                  ${g.ubicacionEntrada ? `Ubicación: <strong>${escapeHtml(g.ubicacionEntrada)}</strong> • ` : ""}
                  ${g.usuarioEntrada ? `Por: ${escapeHtml(g.usuarioEntrada)}` : ""}
                </div>
              </div>

              <div class="detail-box">
                <div class="detail-label">📤 Fecha y Hora de SALIDA</div>
                <div class="detail-value" style="color:#fde68a; font-family:monospace;">
                  ${escapeHtml(g.fechaHoraSalida || "Aún en ubicación (Sin salida)")}
                </div>
                <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.15rem;">
                  ${g.ubicacionSalida ? `Salió de: <strong>${escapeHtml(g.ubicacionSalida)}</strong> • ` : ""}
                  ${g.usuarioSalida ? `Por: ${escapeHtml(g.usuarioSalida)}` : ""}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    // Renderizar tabla completa de movimientos
    if (AppState.lastHistorial.length === 0) {
      tbodyHistorial.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Sin movimientos para mostrar.</td></tr>`;
    } else {
      tbodyHistorial.innerHTML = AppState.lastHistorial.map(m => {
        const pillMov = m.tipoMovimiento === "ENTRADA" ? "pill-entrada" : "pill-salida";
        const pillArea = m.area === "AUDITAR" ? "pill-auditar" : "pill-tarimas";
        return `
          <tr>
            <td style="font-family:monospace;">${escapeHtml(m.fechaHora)}</td>
            <td style="font-family:monospace; font-weight:800; color:#60a5fa;">${escapeHtml(m.entrega)}</td>
            <td style="font-family:monospace; font-weight:700;">${escapeHtml(m.tienda)}</td>
            <td><span class="pill ${pillArea}">${escapeHtml(m.area)}</span></td>
            <td><span class="pill ${pillMov}">${escapeHtml(m.tipoMovimiento)}</span></td>
            <td style="font-family:monospace; font-weight:800; font-size:0.95rem;">${escapeHtml(m.ubicacion)}</td>
            <td>${escapeHtml(m.usuario)} <span style="color:var(--text-muted); font-size:0.76rem;">(${escapeHtml(m.nombreUsuario || "")})</span></td>
            <td style="color:var(--text-muted);">${escapeHtml(m.observaciones || "—")}</td>
          </tr>
        `;
      }).join("");
    }
  } catch (err) {
    showToast("Error al buscar grupo: " + err.message, "error");
  }
}

function exportarHistorialCSV() {
  if (!AppState.lastHistorial || AppState.lastHistorial.length === 0) {
    showToast("No hay registros para exportar", "error");
    return;
  }

  const headers = [
    "ID_Movimiento",
    "Fecha_Hora",
    "Area",
    "Tipo_Movimiento",
    "Tienda",
    "Entrega_Grupo",
    "Ubicacion",
    "Usuario",
    "Nombre_Usuario",
    "Observaciones"
  ];

  const rows = AppState.lastHistorial.map(m => [
    m.id,
    m.fechaHora,
    m.area,
    m.tipoMovimiento,
    `="${m.tienda}"`,
    `="${m.entrega}"`,
    m.ubicacion,
    m.usuario,
    m.nombreUsuario,
    (m.observaciones || "").replace(/"/g, '""')
  ]);

  const csvContent = "\uFEFF" + [
    headers.join(","),
    ...rows.map(r => r.map(v => `"${v ?? ""}"`).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `movimientos_grupos_entrega_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================================
// GESTIÓN DE USUARIOS (SOLO ADMINISTRATIVO)
// ==========================================================================
async function cargarListaUsuarios() {
  const tbody = document.getElementById("tbodyUsuarios");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Cargando usuarios...</td></tr>`;

  try {
    const res = await API.getUsuarios();
    if (!res.success) {
      showToast(res.message || "Error al obtener usuarios", "error");
      return;
    }

    const list = res.usuarios || [];
    tbody.innerHTML = list.map(u => {
      const isAdmin = String(u.rol).toLowerCase().includes("admin");
      const isActive = String(u.activo).toUpperCase() !== "NO";
      return `
        <tr>
          <td style="font-family:monospace; font-weight:700;">${escapeHtml(u.usuario)}</td>
          <td>${escapeHtml(u.nombre)}</td>
          <td style="font-family:monospace; color:var(--text-muted);">${escapeHtml(u.password || "••••")}</td>
          <td><span class="role-tag ${isAdmin ? "admin" : "operativo"}">${isAdmin ? "Administrativo" : "Operativo"}</span></td>
          <td>
            <span class="pill ${isActive ? "pill-entrada" : "pill-salida"}">${isActive ? "ACTIVO" : "INACTIVO"}</span>
          </td>
          <td>
            <button type="button" class="btn btn-outline btn-toggle-user" data-user="${escapeHtml(u.usuario)}" style="padding:0.25rem 0.6rem; font-size:0.75rem;">
              ${isActive ? "Desactivar" : "Activar"}
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".btn-toggle-user").forEach(btn => {
      btn.addEventListener("click", async () => {
        const target = btn.dataset.user;
        const r = await API.toggleUsuario(target);
        if (r.success) {
          showToast(r.message, "success");
          cargarListaUsuarios();
        } else {
          showToast(r.message || "No se pudo actualizar el usuario", "error");
        }
      });
    });
  } catch (err) {
    showToast("Error cargando usuarios: " + err.message, "error");
  }
}

async function handleCrearUsuarioSubmit(e) {
  e.preventDefault();
  const usuario = document.getElementById("newUserId").value.trim();
  const nombre = document.getElementById("newUserName").value.trim();
  const password = document.getElementById("newUserPass").value.trim();
  const rol = document.getElementById("newUserRole").value;

  if (!usuario || !nombre) {
    showToast("Completa el ID de usuario y el nombre.", "error");
    return;
  }

  try {
    const res = await API.crearUsuario({
      usuario,
      nombre,
      password: password || "1234",
      rol,
      creadoPor: AppState.currentUser ? AppState.currentUser.usuario : "admin"
    });

    if (res.success) {
      showToast(res.message, "success");
      document.getElementById("newUserId").value = "";
      document.getElementById("newUserName").value = "";
      document.getElementById("newUserPass").value = "1234";
      cargarListaUsuarios();
    } else {
      showToast(res.message || "Error al crear usuario", "error");
    }
  } catch (err) {
    showToast("Error al crear usuario: " + err.message, "error");
  }
}

// ==========================================================================
// EVENTOS Y AUTO-AVANCE DEL ESCÁNER
// ==========================================================================
function bindEvents() {
  // Login
  document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value.trim();
    const res = await API.login(u, p);
    if (res.success) {
      showToast(`Bienvenido, ${res.user.nombre} (${res.user.rol})`, "success");
      setLoggedUser(res.user);
    } else {
      playScannerBeep(false);
      showToast(res.message || "Credenciales inválidas", "error");
    }
  });

  document.getElementById("btnQuickOperativo").addEventListener("click", async () => {
    document.getElementById("loginUser").value = "operativo";
    document.getElementById("loginPass").value = "1234";
    const res = await API.login("operativo", "1234");
    if (res.success) setLoggedUser(res.user);
  });

  document.getElementById("btnQuickAdmin").addEventListener("click", async () => {
    document.getElementById("loginUser").value = "admin";
    document.getElementById("loginPass").value = "1234";
    const res = await API.login("admin", "1234");
    if (res.success) setLoggedUser(res.user);
  });

  document.getElementById("btnLogout").addEventListener("click", logout);

  // Navegación de pestañas
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Selectores de Área (AUDITAR vs TARIMAS) y Movimiento (ENTRADA vs SALIDA)
  document.getElementById("btnModeAuditar").addEventListener("click", () => {
    AppState.currentArea = "AUDITAR";
    updateCaptureModeUI();
    document.getElementById("inputTienda").focus();
  });

  document.getElementById("btnModeTarimas").addEventListener("click", () => {
    AppState.currentArea = "TARIMAS";
    updateCaptureModeUI();
    document.getElementById("inputTienda").focus();
  });

  document.getElementById("btnTipoEntrada").addEventListener("click", () => {
    AppState.currentTipo = "ENTRADA";
    updateCaptureModeUI();
    document.getElementById("inputTienda").focus();
  });

  document.getElementById("btnTipoSalida").addEventListener("click", () => {
    AppState.currentTipo = "SALIDA";
    updateCaptureModeUI();
    document.getElementById("inputTienda").focus();
  });

  // Inputs de escáner con salto automático al completar longitud
  const inputTienda = document.getElementById("inputTienda");
  const inputEntrega = document.getElementById("inputEntrega");
  const inputUbicacion = document.getElementById("inputUbicacion");

  inputTienda.addEventListener("input", () => {
    inputTienda.value = inputTienda.value.replace(/\D/g, "").slice(0, 4);
    updateCounters();
    if (inputTienda.value.length === 4) {
      inputEntrega.focus();
      inputEntrega.select();
    }
  });

  inputTienda.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && inputTienda.value.length > 0) {
      e.preventDefault();
      inputEntrega.focus();
    }
  });

  inputEntrega.addEventListener("input", () => {
    inputEntrega.value = inputEntrega.value.replace(/\D/g, "").slice(0, 8);
    updateCounters();
    if (inputEntrega.value.length === 8) {
      inputUbicacion.focus();
      inputUbicacion.select();
    }
  });

  inputEntrega.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && inputEntrega.value.length > 0) {
      e.preventDefault();
      inputUbicacion.focus();
    }
  });

  inputUbicacion.addEventListener("input", () => {
    inputUbicacion.value = normalizeUbicacionInput(inputUbicacion.value);
    updateCounters();
    const reqLen = AppState.currentArea === "AUDITAR" ? 7 : 2;
    if (
      inputUbicacion.value.length === reqLen &&
      document.getElementById("chkAutoSubmit").checked &&
      isCaptureFormValid()
    ) {
      handleRegistrarSubmit(new Event("submit"));
    }
  });

  document.getElementById("formCaptura").addEventListener("submit", handleRegistrarSubmit);
  document.getElementById("btnLimpiarCampos").addEventListener("click", limpiarFormularioCaptura);
  document.getElementById("btnRefreshRecientes").addEventListener("click", loadMovimientosRecientes);

  // Buscador de grupos (Administrativo)
  document.getElementById("formBuscarGrupo").addEventListener("submit", ejecutarBusquedaGrupo);
  document.getElementById("searchAreaSelect").addEventListener("change", ejecutarBusquedaGrupo);
  document.getElementById("btnExportarCSV").addEventListener("click", exportarHistorialCSV);

  // Gestión de usuarios (Administrativo)
  document.getElementById("formCrearUsuario").addEventListener("submit", handleCrearUsuarioSubmit);
  document.getElementById("btnRefreshUsuarios").addEventListener("click", cargarListaUsuarios);

  // Modal de Configuración
  document.getElementById("btnConnectionStatus").addEventListener("click", openConfigModal);
  document.getElementById("btnCloseModal").addEventListener("click", closeConfigModal);

  document.getElementById("btnSaveConfig").addEventListener("click", async () => {
    const url = document.getElementById("inputAppsScriptUrl").value.trim();
    const demo = document.getElementById("chkDemoMode").checked;

    CONFIG.APPS_SCRIPT_WEBAPP_URL = url;
    CONFIG.DEMO_MODE = demo || !url;

    localStorage.setItem("grupos_entrega_apps_script_url", url);
    localStorage.setItem("grupos_entrega_demo_mode", String(CONFIG.DEMO_MODE));

    updateConnectionBadge();
    closeConfigModal();
    showToast("Configuración guardada correctamente.", "success");
    if (AppState.currentUser) {
      loadMovimientosRecientes();
    }
  });

  document.getElementById("btnInitSheetsNow").addEventListener("click", async () => {
    const url = document.getElementById("inputAppsScriptUrl").value.trim();
    if (url) {
      CONFIG.APPS_SCRIPT_WEBAPP_URL = url;
      CONFIG.DEMO_MODE = false;
      localStorage.setItem("grupos_entrega_apps_script_url", url);
      localStorage.setItem("grupos_entrega_demo_mode", "false");
      updateConnectionBadge();
    }
    try {
      const res = await API.initSheets();
      if (res.success) {
        showToast(res.message, "success");
      } else {
        showToast(res.message || "Error al inicializar hojas", "error");
      }
    } catch (err) {
      showToast("Error conectando con Apps Script: " + err.message, "error");
    }
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
