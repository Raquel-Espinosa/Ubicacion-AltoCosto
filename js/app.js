// ==========================================================================
// LÓGICA PRINCIPAL DE LA APP (OPTIMIZADA PARA CELULAR Y ESCÁNER)
// ==========================================================================

const AppState = {
  currentUser: null,
  currentArea: "AUDITAR", // "AUDITAR" (7 chars) | "TARIMAS" (2 chars)
  currentTipo: "ENTRADA", // "ENTRADA" | "SALIDA"
  lastHistorial: [],
  isSubmitting: false,
  virtualKeyboardEnabled: true,
  html5QrCode: null,
  cameraActive: false,
  cameraMode: "CAPTURA" // "CAPTURA" | "BUSCAR"
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
// SONIDO + VIBRACIÓN HÁPTICA EN CELULAR
// ==========================================================================
function playScannerFeedback(success = true) {
  // Vibración en celular Android
  try {
    if (navigator.vibrate) {
      navigator.vibrate(success ? [70] : [120, 60, 120]);
    }
  } catch (e) {}

  // Beep sonoro
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? "sine" : "sawtooth";
    osc.frequency.setValueAtTime(success ? 920 : 230, ctx.currentTime);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.1 : 0.24));
  } catch (e) {}
}

function showToast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3200);
}

// ==========================================================================
// CONEXIÓN Y CONFIGURACIÓN
// ==========================================================================
function updateConnectionBadge() {
  const btn = document.getElementById("btnConnectionStatus");
  const txt = document.getElementById("statusText");
  if (CONFIG.DEMO_MODE) {
    btn.className = "badge-status demo";
    txt.textContent = "Demo";
  } else {
    btn.className = "badge-status live";
    txt.textContent = "En Línea";
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
  roleBadge.textContent = isAdmin ? "ADMIN" : "OPER";
  roleBadge.className = `role-tag ${isAdmin ? "admin" : "operativo"}`;

  // Mostrar u ocultar pestañas exclusivas del Administrativo
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
  stopCameraScanner();
  AppState.currentUser = null;
  sessionStorage.removeItem("grupos_entrega_user");
  document.getElementById("userHeaderInfo").classList.add("hidden");
  document.getElementById("viewApp").classList.add("hidden");
  document.getElementById("viewLogin").classList.remove("hidden");
  document.getElementById("loginPass").value = "";
}

function switchTab(tabId) {
  if (tabId !== "tabCaptura") {
    stopCameraScanner();
  }

  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.toggle("hidden", pane.id !== tabId);
  });

  if (tabId === "tabCaptura") {
    loadMovimientosRecientes();
    setTimeout(() => document.getElementById("inputTienda").focus(), 100);
  } else if (tabId === "tabRecientes") {
    loadMovimientosRecientes();
  } else if (tabId === "tabBuscar") {
    ejecutarBusquedaGrupo();
  } else if (tabId === "tabUsuarios") {
    cargarListaUsuarios();
  }
}

// ==========================================================================
// CONTROL DE TECLADO EN PANTALLA (PARA ESCÁNER BLUETOOTH EN CELULAR)
// ==========================================================================
function toggleVirtualKeyboard() {
  AppState.virtualKeyboardEnabled = !AppState.virtualKeyboardEnabled;
  const lbl = document.getElementById("lblKbState");
  const inputsNumeric = [
    document.getElementById("inputTienda"),
    document.getElementById("inputEntrega")
  ];
  const inputUb = document.getElementById("inputUbicacion");

  if (AppState.virtualKeyboardEnabled) {
    lbl.textContent = "Activo";
    inputsNumeric.forEach(i => i.setAttribute("inputmode", "numeric"));
    inputUb.setAttribute("inputmode", "text");
    showToast("⌨️ Teclado del celular activado", "success");
  } else {
    lbl.textContent = "Oculto (BT)";
    inputsNumeric.forEach(i => i.setAttribute("inputmode", "none"));
    inputUb.setAttribute("inputmode", "none");
    showToast("📡 Modo Escáner Bluetooth: teclado oculto", "success");
  }
}

// ==========================================================================
// ESCÁNER DE CÓDIGO DE BARRAS CON LA CÁMARA DEL CELULAR
// ==========================================================================
async function startCameraScanner(mode = "CAPTURA") {
  AppState.cameraMode = mode;
  const box = document.getElementById("cameraScannerBox");

  if (mode === "BUSCAR") {
    // Cambiar a vista de captura o abrir lector rápido
    switchTab("tabCaptura");
    AppState.cameraMode = "BUSCAR";
  }

  box.classList.remove("hidden");
  updateCameraTargetLabel();

  if (typeof Html5Qrcode === "undefined") {
    showToast("Cargando módulo de cámara, intenta de nuevo en 1 seg.", "error");
    return;
  }

  try {
    if (AppState.html5QrCode && AppState.cameraActive) {
      await AppState.html5QrCode.stop();
    }
    AppState.html5QrCode = new Html5Qrcode("qrReader");
    AppState.cameraActive = true;

    await AppState.html5QrCode.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: { width: 240, height: 110 } },
      (decodedText) => {
        handleCameraCodeScanned(decodedText);
      },
      () => {}
    );
  } catch (err) {
    AppState.cameraActive = false;
    showToast("No se pudo acceder a la cámara del celular. Verifica los permisos.", "error");
    box.classList.add("hidden");
  }
}

async function stopCameraScanner() {
  const box = document.getElementById("cameraScannerBox");
  box.classList.add("hidden");
  if (AppState.html5QrCode && AppState.cameraActive) {
    try {
      await AppState.html5QrCode.stop();
      AppState.html5QrCode.clear();
    } catch (e) {}
  }
  AppState.cameraActive = false;
}

function updateCameraTargetLabel() {
  const lbl = document.getElementById("lblCameraTarget");
  if (AppState.cameraMode === "BUSCAR") {
    lbl.textContent = "📷 Escanea el Grupo (8 dígitos) a buscar";
    return;
  }
  const t = document.getElementById("inputTienda").value.trim();
  const e = document.getElementById("inputEntrega").value.trim();
  if (t.length < 4) {
    lbl.textContent = "📷 Paso 1: Escanea Tienda (4 dígitos)";
  } else if (e.length < 8) {
    lbl.textContent = "📷 Paso 2: Escanea Entrega / Grupo (8 dígitos)";
  } else {
    lbl.textContent = `📷 Paso 3: Escanea Ubicación (${AppState.currentArea === "AUDITAR" ? "7" : "2"} díg.)`;
  }
}

let lastScannedRaw = "";
let lastScannedTime = 0;

function handleCameraCodeScanned(rawText) {
  const clean = String(rawText || "").trim().toUpperCase();
  if (!clean) return;

  const now = Date.now();
  if (clean === lastScannedRaw && now - lastScannedTime < 1600) {
    return; // Evitar lectura duplicada del mismo código en menos de 1.6s
  }
  lastScannedRaw = clean;
  lastScannedTime = now;

  if (AppState.cameraMode === "BUSCAR") {
    playScannerFeedback(true);
    stopCameraScanner();
    switchTab("tabBuscar");
    document.getElementById("searchGrupoInput").value = clean;
    ejecutarBusquedaGrupo();
    return;
  }

  const inputTienda = document.getElementById("inputTienda");
  const inputEntrega = document.getElementById("inputEntrega");
  const inputUbicacion = document.getElementById("inputUbicacion");

  // Detectar automáticamente qué código se escaneó por su formato o por el paso actual
  const onlyDigits = clean.replace(/\D/g, "");

  if (/^\d{4}$/.test(clean) || (inputTienda.value.length < 4 && onlyDigits.length === 4)) {
    inputTienda.value = onlyDigits;
    playScannerFeedback(true);
    showToast(`🏬 Tienda escaneada: ${onlyDigits}`, "success");
    updateCounters();
    updateCameraTargetLabel();
    inputEntrega.focus();
    return;
  }

  if (/^\d{8}$/.test(clean) || (inputEntrega.value.length < 8 && onlyDigits.length === 8)) {
    inputEntrega.value = onlyDigits;
    playScannerFeedback(true);
    showToast(`📦 Grupo escaneado: ${onlyDigits}`, "success");
    updateCounters();
    updateCameraTargetLabel();
    inputUbicacion.focus();
    return;
  }

  // De lo contrario, procesarlo como Ubicación
  const normUb = normalizeUbicacionInput(clean);
  const reqLen = AppState.currentArea === "AUDITAR" ? 7 : 2;
  if (normUb.length === reqLen) {
    inputUbicacion.value = normUb;
    playScannerFeedback(true);
    updateCounters();
    updateCameraTargetLabel();
    if (document.getElementById("chkAutoSubmit").checked && isCaptureFormValid()) {
      handleRegistrarSubmit(new Event("submit"));
    }
  } else {
    playScannerFeedback(false);
    showToast(`Código leído (${clean}) no coincide con el formato esperado.`, "error");
  }
}

// ==========================================================================
// LÓGICA DE INTERFAZ DE CAPTURA (AUDITAR 7 DÍGITOS vs TARIMAS 2 DÍGITOS)
// ==========================================================================
function updateCaptureModeUI() {
  const isAuditar = AppState.currentArea === "AUDITAR";
  const isEntrada = AppState.currentTipo === "ENTRADA";

  document.getElementById("btnModeAuditar").className = `mode-btn ${isAuditar ? "active-auditar" : ""}`;
  document.getElementById("btnModeTarimas").className = `mode-btn ${!isAuditar ? "active-tarimas" : ""}`;

  document.getElementById("btnTipoEntrada").className = `mode-btn ${isEntrada ? "active-entrada" : ""}`;
  document.getElementById("btnTipoSalida").className = `mode-btn ${!isEntrada ? "active-salida" : ""}`;

  const lblUbicacion = document.getElementById("lblUbicacionTitulo");
  const inputUbicacion = document.getElementById("inputUbicacion");

  if (isAuditar) {
    lblUbicacion.textContent = "📍 Ubicación Auditar (7 díg.)";
    inputUbicacion.maxLength = 7;
    inputUbicacion.placeholder = "SA-01-1, SA-01-2...";
  } else {
    lblUbicacion.textContent = "📍 Ubicación Tarimas (2 díg.)";
    inputUbicacion.maxLength = 2;
    inputUbicacion.placeholder = "K1, K2, K3, L1...";
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
  updateCameraTargetLabel();
}

function renderQuickUbicaciones() {
  const container = document.getElementById("quickUbicaciones");
  container.innerHTML = "";
  const list = AppState.currentArea === "AUDITAR"
    ? CONFIG.UBICACIONES_AUDITAR
    : CONFIG.UBICACIONES_TARIMAS;

  const currentVal = document.getElementById("inputUbicacion").value.trim().toUpperCase();

  list.forEach(ub => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip ${currentVal === ub ? "selected" : ""}`;
    chip.textContent = ub;
    chip.addEventListener("click", () => {
      const inputUb = document.getElementById("inputUbicacion");
      inputUb.value = ub;
      updateCounters();
      renderQuickUbicaciones();
      if (
        document.getElementById("chkAutoSubmit").checked &&
        isCaptureFormValid()
      ) {
        handleRegistrarSubmit(new Event("submit"));
      } else {
        // Si falta tienda o entrega, enfocar el campo pendiente
        const t = document.getElementById("inputTienda").value.trim();
        const e = document.getElementById("inputEntrega").value.trim();
        if (t.length < 4) document.getElementById("inputTienda").focus();
        else if (e.length < 8) document.getElementById("inputEntrega").focus();
      }
    });
    container.appendChild(chip);
  });
}

function normalizeUbicacionInput(rawVal) {
  let val = String(rawVal || "").toUpperCase().trim();
  if (AppState.currentArea === "AUDITAR") {
    // Si se escanea SA011 sin guiones, convierte a SA-01-1
    if (/^[A-Z]{2}\d{3}$/.test(val)) {
      val = `${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4, 5)}`;
    }
    return val.slice(0, 7);
  } else {
    return val.replace(/[^A-Z0-9]/g, "").slice(0, 2);
  }
}

function updateCounters() {
  const tienda = document.getElementById("inputTienda").value.trim();
  const entrega = document.getElementById("inputEntrega").value.trim();
  const ubicacion = document.getElementById("inputUbicacion").value.trim();

  const reqUbLen = AppState.currentArea === "AUDITAR" ? 7 : 2;

  const cTienda = document.getElementById("counterTienda");
  cTienda.textContent = `${tienda.length}/4`;
  cTienda.classList.toggle("valid", /^\d{4}$/.test(tienda));
  document.getElementById("inputTienda").classList.toggle("input-valid", /^\d{4}$/.test(tienda));

  const cEntrega = document.getElementById("counterEntrega");
  cEntrega.textContent = `${entrega.length}/8`;
  cEntrega.classList.toggle("valid", /^\d{8}$/.test(entrega));
  document.getElementById("inputEntrega").classList.toggle("input-valid", /^\d{8}$/.test(entrega));

  const cUb = document.getElementById("counterUbicacion");
  cUb.textContent = `${ubicacion.length}/${reqUbLen}`;
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
    playScannerFeedback(false);
    showToast("La Tienda debe tener 4 dígitos (ej. 7101).", "error");
    document.getElementById("inputTienda").focus();
    return;
  }
  if (!/^\d{8}$/.test(entrega)) {
    playScannerFeedback(false);
    showToast("La Entrega / Grupo debe tener 8 dígitos.", "error");
    document.getElementById("inputEntrega").focus();
    return;
  }
  if (ubicacion.length !== reqUbLen) {
    playScannerFeedback(false);
    const ej = AppState.currentArea === "AUDITAR" ? "SA-01-1 (7 caracteres)" : "K1, L1 (2 caracteres)";
    showToast(`Ubicación inválida. Debe ser de ${reqUbLen} caracteres (${ej}).`, "error");
    document.getElementById("inputUbicacion").focus();
    return;
  }

  AppState.isSubmitting = true;
  const btn = document.getElementById("btnGuardarMovimiento");
  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Guardando...";

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
      playScannerFeedback(true);
      showToast(`✅ ${res.message}`, "success");

      const banner = document.getElementById("lastScanBanner");
      const details = document.getElementById("lastScanDetails");
      banner.classList.remove("hidden");
      details.textContent = `${AppState.currentTipo} • ${AppState.currentArea} | Tienda ${tienda} | Grupo ${entrega} ➔ ${ubicacion}`;

      limpiarFormularioCaptura();
      await loadMovimientosRecientes();
    } else {
      playScannerFeedback(false);
      showToast(res.message || "Error al guardar", "error");
    }
  } catch (err) {
    playScannerFeedback(false);
    showToast("Error de conexión: " + err.message, "error");
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
  renderQuickUbicaciones();
  updateCameraTargetLabel();
  document.getElementById("inputTienda").focus();
}

function buildMovMobileCardHtml(m) {
  const pillMov = m.tipoMovimiento === "ENTRADA" ? "pill-entrada" : "pill-salida";
  const pillArea = m.area === "AUDITAR" ? "pill-auditar" : "pill-tarimas";
  return `
    <div class="mov-mobile-card">
      <div class="mov-mobile-top">
        <div style="display:flex; gap:0.35rem; align-items:center;">
          <span class="pill ${pillArea}">${escapeHtml(m.area)}</span>
          <span class="pill ${pillMov}">${escapeHtml(m.tipoMovimiento)}</span>
        </div>
        <span style="font-family:monospace; font-size:0.74rem; color:var(--text-muted);">${escapeHtml(m.fechaHora)}</span>
      </div>
      <div class="mov-mobile-mid">
        <span>🏬 Tda: <strong>${escapeHtml(m.tienda)}</strong> • 📦 Grp: <span style="color:#60a5fa;">${escapeHtml(m.entrega)}</span></span>
        <span style="font-size:1rem; color:#38bdf8;">📍 ${escapeHtml(m.ubicacion)}</span>
      </div>
      <div class="mov-mobile-bot">
        <span>👷 ${escapeHtml(m.usuario)}</span>
        <span>${escapeHtml(m.observaciones || "")}</span>
      </div>
    </div>
  `;
}

async function loadMovimientosRecientes() {
  try {
    const res = await API.buscarGrupo("", "", "TODAS");
    if (!res.success) return;

    const rec = (res.historial || []).slice(0, 25);
    const listMobile = document.getElementById("listaRecientesMobile");
    const listDesktop = document.getElementById("listaRecientesDesktop");

    if (rec.length === 0) {
      const emptyHtml = `<div style="text-align:center; color:var(--text-muted); padding:1.5rem; font-size:0.84rem;">Aún no hay movimientos registrados.</div>`;
      if (listMobile) listMobile.innerHTML = emptyHtml;
      if (listDesktop) listDesktop.innerHTML = emptyHtml;
      return;
    }

    const cardsHtml = rec.map(buildMovMobileCardHtml).join("");
    if (listMobile) listMobile.innerHTML = cardsHtml;
    if (listDesktop) listDesktop.innerHTML = cardsHtml;
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
  const mobileCards = document.getElementById("historialMobileCards");

  containerGrupos.innerHTML = `<div class="card" style="margin-bottom:0.85rem; color:var(--text-muted); font-size:0.85rem;">Consultando grupo...</div>`;

  try {
    const res = await API.buscarGrupo(qGrupo, qTienda, qArea);
    if (!res.success) {
      showToast(res.message || "Error en la búsqueda", "error");
      return;
    }

    AppState.lastHistorial = res.historial || [];
    document.getElementById("lblTotalHistorial").textContent = `${AppState.lastHistorial.length} movs`;

    const grupos = res.grupos || [];
    if (grupos.length === 0) {
      containerGrupos.innerHTML = `
        <div class="card" style="margin-bottom:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
          No se encontró ningún grupo con <strong>${escapeHtml(qGrupo || "ese criterio")}</strong>.
        </div>
      `;
    } else {
      const mostrarGrupos = qGrupo || qTienda ? grupos : grupos.slice(0, 6);
      containerGrupos.innerHTML = mostrarGrupos.map(g => {
        const enUbicacion = g.ultimoMovimiento === "ENTRADA";
        const badgeClass = enUbicacion ? "pill-entrada" : "pill-salida";
        const areaClass = g.areaActual === "AUDITAR" ? "pill-auditar" : "pill-tarimas";

        return `
          <div class="grupo-result-card">
            <div class="grupo-header">
              <div>
                <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Número de Grupo / Entrega</div>
                <div class="grupo-number">📦 ${escapeHtml(g.entrega)}</div>
              </div>
              <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap;">
                <span class="pill ${areaClass}">${escapeHtml(g.areaActual)}</span>
                <span class="pill ${badgeClass}">${escapeHtml(g.estadoActual)}</span>
              </div>
            </div>

            <div class="grupo-details-grid">
              <div class="detail-box">
                <div class="detail-label">📍 Ubicación Actual / Última</div>
                <div class="detail-value" style="font-family:monospace; font-size:1.15rem; color:#38bdf8;">
                  ${escapeHtml(g.ubicacionActual || "—")}
                </div>
                <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.1rem;">
                  Tienda: <strong>${escapeHtml(g.tienda)}</strong>
                </div>
              </div>

              <div class="detail-box">
                <div class="detail-label">📥 Fecha y Hora de ENTRADA</div>
                <div class="detail-value" style="color:#6ee7b7; font-family:monospace;">
                  ${escapeHtml(g.fechaHoraEntrada || "Sin entrada")}
                </div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.1rem;">
                  ${g.ubicacionEntrada ? `Ubic: <strong>${escapeHtml(g.ubicacionEntrada)}</strong> • ` : ""}
                  ${g.usuarioEntrada ? `${escapeHtml(g.usuarioEntrada)}` : ""}
                </div>
              </div>

              <div class="detail-box">
                <div class="detail-label">📤 Fecha y Hora de SALIDA</div>
                <div class="detail-value" style="color:#fde68a; font-family:monospace;">
                  ${escapeHtml(g.fechaHoraSalida || "Sigue en ubicación")}
                </div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.1rem;">
                  ${g.ubicacionSalida ? `Salió de: <strong>${escapeHtml(g.ubicacionSalida)}</strong> • ` : ""}
                  ${g.usuarioSalida ? `${escapeHtml(g.usuarioSalida)}` : ""}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    // Historial en tarjetas móviles y tabla escritorio
    if (AppState.lastHistorial.length === 0) {
      mobileCards.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:1rem;">Sin movimientos.</div>`;
      tbodyHistorial.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.2rem;">Sin movimientos.</td></tr>`;
    } else {
      mobileCards.innerHTML = AppState.lastHistorial.map(buildMovMobileCardHtml).join("");
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
            <td style="font-family:monospace; font-weight:800;">${escapeHtml(m.ubicacion)}</td>
            <td>${escapeHtml(m.usuario)}</td>
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
  a.download = `grupos_entrega_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================================
// GESTIÓN DE USUARIOS (TARJETAS ADAPTADAS A CELULAR)
// ==========================================================================
async function cargarListaUsuarios() {
  const container = document.getElementById("usuariosMobileList");
  container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:1rem;">Cargando usuarios...</div>`;

  try {
    const res = await API.getUsuarios();
    if (!res.success) {
      showToast(res.message || "Error al obtener usuarios", "error");
      return;
    }

    const list = res.usuarios || [];
    container.innerHTML = list.map(u => {
      const isAdmin = String(u.rol).toLowerCase().includes("admin");
      const isActive = String(u.activo).toUpperCase() !== "NO";
      return `
        <div class="mov-mobile-card">
          <div class="mov-mobile-top">
            <div>
              <strong style="font-family:monospace; font-size:0.95rem;">${escapeHtml(u.usuario)}</strong>
              <span style="color:var(--text-muted); font-size:0.8rem;"> • ${escapeHtml(u.nombre)}</span>
            </div>
            <span class="role-tag ${isAdmin ? "admin" : "operativo"}">${isAdmin ? "Administrativo" : "Operativo"}</span>
          </div>
          <div class="mov-mobile-bot" style="margin-top:0.25rem;">
            <span>🔑 PIN: <code>${escapeHtml(u.password || "****")}</code> • Estado: <strong>${isActive ? "ACTIVO" : "INACTIVO"}</strong></span>
            <button type="button" class="btn btn-outline btn-sm btn-toggle-user" data-user="${escapeHtml(u.usuario)}">
              ${isActive ? "Desactivar" : "Activar"}
            </button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".btn-toggle-user").forEach(btn => {
      btn.addEventListener("click", async () => {
        const target = btn.dataset.user;
        const r = await API.toggleUsuario(target);
        if (r.success) {
          showToast(r.message, "success");
          cargarListaUsuarios();
        } else {
          showToast(r.message || "Error al actualizar", "error");
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
    showToast("Completa el usuario y el nombre.", "error");
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
      playScannerFeedback(true);
      showToast(res.message, "success");
      document.getElementById("newUserId").value = "";
      document.getElementById("newUserName").value = "";
      document.getElementById("newUserPass").value = "1234";
      cargarListaUsuarios();
    } else {
      playScannerFeedback(false);
      showToast(res.message || "Error al crear usuario", "error");
    }
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

// ==========================================================================
// EVENTOS Y AUTO-AVANCE DEL ESCÁNER EN CELULAR
// ==========================================================================
function bindEvents() {
  // Login
  document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value.trim();
    const res = await API.login(u, p);
    if (res.success) {
      playScannerFeedback(true);
      showToast(`Hola, ${res.user.nombre}`, "success");
      setLoggedUser(res.user);
    } else {
      playScannerFeedback(false);
      showToast(res.message || "Credenciales incorrectas", "error");
    }
  });

  document.getElementById("btnQuickOperativo").addEventListener("click", async () => {
    const res = await API.login("operativo", "1234");
    if (res.success) setLoggedUser(res.user);
  });

  document.getElementById("btnQuickAdmin").addEventListener("click", async () => {
    const res = await API.login("admin", "1234");
    if (res.success) setLoggedUser(res.user);
  });

  document.getElementById("btnLogout").addEventListener("click", logout);

  // Pestañas inferiores
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Cámara y Teclado Virtual en Celular
  document.getElementById("btnOpenCameraScanner").addEventListener("click", () => {
    if (AppState.cameraActive) stopCameraScanner();
    else startCameraScanner("CAPTURA");
  });

  document.getElementById("btnCloseCamera").addEventListener("click", stopCameraScanner);
  document.getElementById("btnToggleVirtualKeyboard").addEventListener("click", toggleVirtualKeyboard);

  document.getElementById("btnScanSearchGrupo").addEventListener("click", () => {
    startCameraScanner("BUSCAR");
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

  // Inputs de escáner con auto-avance
  const inputTienda = document.getElementById("inputTienda");
  const inputEntrega = document.getElementById("inputEntrega");
  const inputUbicacion = document.getElementById("inputUbicacion");

  inputTienda.addEventListener("input", () => {
    inputTienda.value = inputTienda.value.replace(/\D/g, "").slice(0, 4);
    updateCounters();
    updateCameraTargetLabel();
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
    updateCameraTargetLabel();
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
    renderQuickUbicaciones();
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
  const btnRefDesk = document.getElementById("btnRefreshRecientesDesktop");
  if (btnRefDesk) btnRefDesk.addEventListener("click", loadMovimientosRecientes);

  // Buscador de grupos (Administrativo)
  document.getElementById("formBuscarGrupo").addEventListener("submit", ejecutarBusquedaGrupo);
  document.getElementById("searchAreaSelect").addEventListener("change", ejecutarBusquedaGrupo);
  document.getElementById("btnLimpiarBusqueda").addEventListener("click", () => {
    document.getElementById("searchGrupoInput").value = "";
    document.getElementById("searchTiendaInput").value = "";
    document.getElementById("searchAreaSelect").value = "TODAS";
    ejecutarBusquedaGrupo();
  });
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
    showToast("Configuración guardada.", "success");
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
