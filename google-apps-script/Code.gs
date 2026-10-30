/**
 * =========================================================================================
 * BACKEND GOOGLE APPS SCRIPT - CONTROL DE GRUPOS DE ENTREGA Y AUDITORÍA (ALTO COSTO)
 * =========================================================================================
 *
 * ID de la Hoja de Google Sheets: 1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg
 *
 * Este script crea automáticamente todas las hojas (pestañas) y columnas necesarias
 * en el archivo de Google Sheets y funciona como API Web para la aplicación en GitHub Pages.
 *
 * Hojas que crea y administra automáticamente:
 *  1. "Usuarios"       -> Control de acceso (Roles: Operativo y Administrativo)
 *  2. "Movimientos"    -> Bitácora general de Entradas y Salidas (Auditar y Tarimas)
 *  3. "Auditar"        -> Movimientos específicos de Grupos para Auditar (Ubicación 7 caracteres: SA-01-1)
 *  4. "Tarimas"        -> Movimientos específicos de Grupos en Tarimas (Ubicación 2 caracteres: K1, L1)
 *  5. "Estado_Grupos"  -> Resumen en vivo por Número de Grupo/Entrega con su ubicación actual,
 *                         fecha de entrada y fecha de salida para búsquedas instantáneas.
 *
 * INSTRUCCIONES DE INSTALACIÓN:
 *  1. Abre la hoja de Google Sheets:
 *     https://docs.google.com/spreadsheets/d/1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg/edit
 *  2. En el menú superior, ve a Extensiones > Apps Script.
 *  3. Borra cualquier código existente y pega todo este archivo. Guarda (Ctrl + S).
 *  4. (Opcional) Ejecuta la función `inicializarHojasYColumnas` desde el botón "Ejecutar" arriba
 *     para crear las pestañas de inmediato, o simplemente despliega la Web App (se crean solas).
 *  5. Haz clic en "Implementar" > "Nueva implementación" > Tipo: "Aplicación web".
 *     - Ejecutar como: "Yo"
 *     - Quién tiene acceso: "Cualquiera" (Anyone)
 *  6. Copia la URL generada (termina en /exec) y pégala en la configuración de la App Web.
 */

const SHEET_ID = "1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg";
const TIMEZONE = "GMT-6";

const TAB_USUARIOS = "Usuarios";
const TAB_MOVIMIENTOS = "Movimientos";
const TAB_AUDITAR = "Auditar";
const TAB_TARIMAS = "Tarimas";
const TAB_ESTADO = "Estado_Grupos";

/**
 * Función ejecutable manualmente desde el editor de Apps Script
 * para crear y dar formato a todas las hojas y columnas necesarias.
 */
function inicializarHojasYColumnas() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ensureAllSheets(ss);
  return "Hojas y columnas creadas exitosamente en el archivo " + ss.getName();
}

// =========================================================================================
// HANDLER: GET REQUESTS
// =========================================================================================
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || "ping";
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // Garantizar siempre que existan las hojas y columnas necesarias
    ensureAllSheets(ss);

    let result = { success: false, message: "Acción GET no reconocida: " + action };

    switch (action) {
      case "ping":
        result = {
          success: true,
          message: "Conectado a Google Sheets (" + ss.getName() + ")",
          sheetId: SHEET_ID,
          timestamp: formatNow()
        };
        break;

      case "initSheets":
        result = {
          success: true,
          message: "Hojas y columnas verificadas/creadas correctamente en Google Sheets.",
          sheets: [TAB_USUARIOS, TAB_MOVIMIENTOS, TAB_AUDITAR, TAB_TARIMAS, TAB_ESTADO]
        };
        break;

      case "login":
        result = handleLogin(ss, params.usuario, params.password);
        break;

      case "buscarGrupo":
        result = handleBuscarGrupo(ss, params.grupo, params.tienda, params.area);
        break;

      case "getMovimientos":
        result = handleGetMovimientos(ss, params);
        break;

      case "getUsuarios":
        result = handleGetUsuarios(ss);
        break;

      default:
        result = { success: false, message: "Acción GET no soportada: " + action };
    }

    return respondJson(result);
  } catch (err) {
    return respondJson({ success: false, error: err.toString(), stack: err.stack });
  }
}

// =========================================================================================
// HANDLER: POST REQUESTS
// =========================================================================================
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || "";
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // Garantizar siempre que existan las hojas y columnas necesarias
    ensureAllSheets(ss);

    let result = { success: false, message: "Acción POST no reconocida: " + action };

    switch (action) {
      case "initSheets":
        result = {
          success: true,
          message: "Hojas y columnas creadas/verificadas correctamente.",
          sheets: [TAB_USUARIOS, TAB_MOVIMIENTOS, TAB_AUDITAR, TAB_TARIMAS, TAB_ESTADO]
        };
        break;

      case "login":
        result = handleLogin(ss, payload.usuario, payload.password);
        break;

      case "registrarMovimiento":
        result = handleRegistrarMovimiento(ss, payload);
        break;

      case "crearUsuario":
        result = handleCrearUsuario(ss, payload);
        break;

      case "toggleUsuario":
        result = handleToggleUsuario(ss, payload);
        break;

      case "buscarGrupo":
        result = handleBuscarGrupo(ss, payload.grupo, payload.tienda, payload.area);
        break;

      default:
        result = { success: false, message: "Acción POST no soportada: " + action };
    }

    return respondJson(result);
  } catch (err) {
    return respondJson({ success: false, error: err.toString(), stack: err.stack });
  }
}

// =========================================================================================
// CREACIÓN Y VERIFICACIÓN AUTOMÁTICA DE HOJAS Y COLUMNAS
// =========================================================================================
function ensureAllSheets(ss) {
  // 1. Hoja Usuarios
  let shUsuarios = ss.getSheetByName(TAB_USUARIOS);
  if (!shUsuarios) {
    shUsuarios = ss.insertSheet(TAB_USUARIOS);
  }
  if (shUsuarios.getLastRow() === 0) {
    const headersUsuarios = ["Usuario", "Nombre", "Password", "Rol", "Activo", "Fecha_Creacion", "Creado_Por"];
    shUsuarios.appendRow(headersUsuarios);
    styleHeaderRow(shUsuarios, headersUsuarios.length, "#1e293b", "#ffffff");
    // Usuarios iniciales por defecto
    const nowStr = formatNow();
    shUsuarios.appendRow(["admin", "Administrador General", "1234", "Administrativo", "SI", nowStr, "SISTEMA"]);
    shUsuarios.appendRow(["operativo", "Operador Escáner 1", "1234", "Operativo", "SI", nowStr, "SISTEMA"]);
    shUsuarios.setFrozenRows(1);
  }

  // 2. Hoja Movimientos (Bitácora General)
  let shMov = ss.getSheetByName(TAB_MOVIMIENTOS);
  if (!shMov) {
    shMov = ss.insertSheet(TAB_MOVIMIENTOS);
  }
  if (shMov.getLastRow() === 0) {
    const headersMov = [
      "ID_Movimiento",
      "Fecha_Hora",
      "Fecha",
      "Hora",
      "Area",
      "Tipo_Movimiento",
      "Tienda",
      "Grupo",
      "Ubicacion",
      "Usuario",
      "Nombre_Usuario",
      "Rol_Usuario",
      "Observaciones"
    ];
    shMov.appendRow(headersMov);
    styleHeaderRow(shMov, headersMov.length, "#0f172a", "#ffffff");
    shMov.setFrozenRows(1);
  } else {
    shMov.getRange(1, 8).setValue("Grupo");
  }

  // 3. Hoja Auditar (Ubicaciones de 7 caracteres: SA-01-1, SA-01-2, etc.)
  let shAuditar = ss.getSheetByName(TAB_AUDITAR);
  if (!shAuditar) {
    shAuditar = ss.insertSheet(TAB_AUDITAR);
  }
  if (shAuditar.getLastRow() === 0) {
    const headersAuditar = [
      "ID_Movimiento",
      "Fecha_Hora",
      "Tipo_Movimiento",
      "Tienda_4Dig",
      "Grupo_10Dig",
      "Ubicacion_7Dig",
      "Usuario",
      "Nombre_Usuario",
      "Observaciones"
    ];
    shAuditar.appendRow(headersAuditar);
    styleHeaderRow(shAuditar, headersAuditar.length, "#1d4ed8", "#ffffff");
    shAuditar.setFrozenRows(1);
  } else {
    shAuditar.getRange(1, 5).setValue("Grupo_10Dig");
  }

  // 4. Hoja Tarimas (Ubicaciones de 2 caracteres: K1, K2, L1, etc.)
  let shTarimas = ss.getSheetByName(TAB_TARIMAS);
  if (!shTarimas) {
    shTarimas = ss.insertSheet(TAB_TARIMAS);
  }
  if (shTarimas.getLastRow() === 0) {
    const headersTarimas = [
      "ID_Movimiento",
      "Fecha_Hora",
      "Tipo_Movimiento",
      "Tienda_4Dig",
      "Grupo_10Dig",
      "Ubicacion_2Dig",
      "Usuario",
      "Nombre_Usuario",
      "Observaciones"
    ];
    shTarimas.appendRow(headersTarimas);
    styleHeaderRow(shTarimas, headersTarimas.length, "#047857", "#ffffff");
    shTarimas.setFrozenRows(1);
  } else {
    shTarimas.getRange(1, 5).setValue("Grupo_10Dig");
  }

  // 5. Hoja Estado_Grupos (Resumen consolidado de cada grupo para consulta rápida)
  let shEstado = ss.getSheetByName(TAB_ESTADO);
  if (!shEstado) {
    shEstado = ss.insertSheet(TAB_ESTADO);
  }
  if (shEstado.getLastRow() === 0) {
    const headersEstado = [
      "Grupo",
      "Tienda",
      "Area_Actual",
      "Ubicacion_Actual",
      "Estado_Actual",
      "Fecha_Hora_Entrada",
      "Usuario_Entrada",
      "Fecha_Hora_Salida",
      "Usuario_Salida",
      "Ultima_Actualizacion",
      "Total_Movimientos"
    ];
    shEstado.appendRow(headersEstado);
    styleHeaderRow(shEstado, headersEstado.length, "#4338ca", "#ffffff");
    shEstado.setFrozenRows(1);
  } else {
    shEstado.getRange(1, 1).setValue("Grupo");
  }
}

function styleHeaderRow(sheet, numCols, bgColor, fgColor) {
  const range = sheet.getRange(1, 1, 1, numCols);
  range.setFontWeight("bold");
  range.setBackground(bgColor);
  range.setFontColor(fgColor);
}

// =========================================================================================
// 1. AUTENTICACIÓN DE USUARIOS
// =========================================================================================
function handleLogin(ss, usuarioInput, passwordInput) {
  if (!usuarioInput) {
    return { success: false, message: "Ingrese su nombre de usuario" };
  }

  const sheet = ss.getSheetByName(TAB_USUARIOS);
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) {
    return { success: false, message: "No existen usuarios en la hoja Usuarios" };
  }

  const cleanUser = String(usuarioInput).trim().toLowerCase();
  const cleanPass = String(passwordInput || "").trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowUser = String(row[0] || "").trim().toLowerCase();
    const rowNombre = String(row[1] || "").trim();
    const rowPass = String(row[2] || "").trim();
    const rowRol = String(row[3] || "Operativo").trim();
    const rowActivo = String(row[4] || "SI").trim().toUpperCase();

    if (rowUser === cleanUser) {
      if (rowActivo === "NO" || rowActivo === "INACTIVO" || rowActivo === "FALSE") {
        return { success: false, message: "Este usuario está desactivado. Contacte al administrador." };
      }
      if (rowPass !== "" && rowPass !== cleanPass) {
        return { success: false, message: "Contraseña o PIN incorrecto." };
      }

      const rolNormalizado = rowRol.toLowerCase().includes("admin") ? "Administrativo" : "Operativo";

      return {
        success: true,
        user: {
          usuario: String(row[0]).trim(),
          nombre: rowNombre || String(row[0]).trim(),
          rol: rolNormalizado
        }
      };
    }
  }

  return { success: false, message: "Usuario no encontrado." };
}

// =========================================================================================
// 2. REGISTRAR ENTRADA O SALIDA (AUDITAR O TARIMAS)
// =========================================================================================
function handleRegistrarMovimiento(ss, payload) {
  const area = String(payload.area || "").trim().toUpperCase(); // "AUDITAR" o "TARIMAS"
  const tipo = String(payload.tipoMovimiento || "").trim().toUpperCase(); // "ENTRADA" o "SALIDA"
  const tienda = String(payload.tienda || "").trim();
  const entrega = String(payload.grupo || payload.entrega || "").trim();
  const ubicacion = String(payload.ubicacion || "").trim().toUpperCase();
  const usuario = String(payload.usuario || "operativo").trim();
  const nombreUsuario = String(payload.nombreUsuario || usuario).trim();
  const rolUsuario = String(payload.rolUsuario || "Operativo").trim();
  const observaciones = String(payload.observaciones || "").trim();

  // Validaciones de negocio
  if (area !== "AUDITAR" && area !== "TARIMAS") {
    return { success: false, message: "El área debe ser AUDITAR o TARIMAS." };
  }
  if (tipo !== "ENTRADA" && tipo !== "SALIDA") {
    return { success: false, message: "El tipo de movimiento debe ser ENTRADA o SALIDA." };
  }
  if (!/^\d{4}$/.test(tienda)) {
    return { success: false, message: "La Tienda debe tener exactamente 4 dígitos numéricos (ej. 7101)." };
  }
  if (!/^\d{10}$/.test(entrega)) {
    return { success: false, message: "El Grupo debe tener exactamente 10 dígitos numéricos." };
  }
  if (area === "AUDITAR" && ubicacion.length !== 7) {
    return {
      success: false,
      message: "Para Auditar, la Ubicación debe ser de 7 caracteres (ej. SA-01-1, SA-01-2, SA-02-1)."
    };
  }
  if (area === "TARIMAS" && ubicacion.length !== 2) {
    return {
      success: false,
      message: "En Tarimas, la Ubicación debe ser de 2 caracteres (ej. K1, K2, K3, L1)."
    };
  }

  const now = new Date();
  const fechaHoraStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  const fechaStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const horaStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");
  const idMov = "MOV-" + Utilities.formatDate(now, TIMEZONE, "yyyyMMddHHmmss") + "-" + Math.floor(100 + Math.random() * 900);

  // Forzar formato texto en tienda y entrega con apóstrofe para conservar ceros iniciales en Sheets
  const tiendaText = "'" + tienda;
  const entregaText = "'" + entrega;

  // 1. Insertar en "Movimientos" (Bitácora General)
  const shMov = ss.getSheetByName(TAB_MOVIMIENTOS);
  shMov.appendRow([
    idMov,
    fechaHoraStr,
    fechaStr,
    horaStr,
    area,
    tipo,
    tiendaText,
    entregaText,
    ubicacion,
    usuario,
    nombreUsuario,
    rolUsuario,
    observaciones
  ]);

  // 2. Insertar en la hoja específica ("Auditar" o "Tarimas")
  const targetTabName = area === "AUDITAR" ? TAB_AUDITAR : TAB_TARIMAS;
  const shEspecifica = ss.getSheetByName(targetTabName);
  shEspecifica.appendRow([
    idMov,
    fechaHoraStr,
    tipo,
    tiendaText,
    entregaText,
    ubicacion,
    usuario,
    nombreUsuario,
    observaciones
  ]);

  // 3. Actualizar la hoja "Estado_Grupos" para búsquedas instantáneas
  actualizarEstadoGrupo(ss, {
    entrega: entrega,
    tienda: tienda,
    area: area,
    ubicacion: ubicacion,
    tipo: tipo,
    fechaHora: fechaHoraStr,
    usuario: usuario
  });

  return {
    success: true,
    message: tipo + " registrada correctamente en " + area + " (" + ubicacion + ")",
    movimiento: {
      id: idMov,
      fechaHora: fechaHoraStr,
      fecha: fechaStr,
      hora: horaStr,
      area: area,
      tipoMovimiento: tipo,
      tienda: tienda,
      entrega: entrega,
      ubicacion: ubicacion,
      usuario: usuario,
      nombreUsuario: nombreUsuario,
      rolUsuario: rolUsuario,
      observaciones: observaciones
    }
  };
}

/**
 * Mantiene actualizada la pestaña "Estado_Grupos" con la ubicación actual,
 * fecha de entrada y fecha de salida de cada número de grupo/entrega.
 */
function actualizarEstadoGrupo(ss, info) {
  const shEstado = ss.getSheetByName(TAB_ESTADO);
  const data = shEstado.getDataRange().getDisplayValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim() === info.entrega) {
      rowIndex = i + 1; // 1-indexed en Apps Script
      break;
    }
  }

  const estadoActual = info.tipo === "ENTRADA" ? "EN UBICACIÓN (" + info.ubicacion + ")" : "SALIDA REGISTRADA";

  if (rowIndex === -1) {
    // Nuevo grupo
    const fechaEntrada = info.tipo === "ENTRADA" ? info.fechaHora : "";
    const userEntrada = info.tipo === "ENTRADA" ? info.usuario : "";
    const fechaSalida = info.tipo === "SALIDA" ? info.fechaHora : "";
    const userSalida = info.tipo === "SALIDA" ? info.usuario : "";

    shEstado.appendRow([
      "'" + info.entrega,
      "'" + info.tienda,
      info.area,
      info.ubicacion,
      estadoActual,
      fechaEntrada,
      userEntrada,
      fechaSalida,
      userSalida,
      info.fechaHora,
      1
    ]);
  } else {
    // Actualizar grupo existente
    const currentRow = data[rowIndex - 1];
    const prevFechaEntrada = currentRow[5] || "";
    const prevUserEntrada = currentRow[6] || "";
    const prevFechaSalida = currentRow[7] || "";
    const prevUserSalida = currentRow[8] || "";
    const prevTotal = parseInt(currentRow[10] || "0", 10) || 0;

    const newFechaEntrada = info.tipo === "ENTRADA" ? info.fechaHora : prevFechaEntrada;
    const newUserEntrada = info.tipo === "ENTRADA" ? info.usuario : prevUserEntrada;
    const newFechaSalida = info.tipo === "SALIDA" ? info.fechaHora : prevFechaSalida;
    const newUserSalida = info.tipo === "SALIDA" ? info.usuario : prevUserSalida;

    shEstado.getRange(rowIndex, 1, 1, 11).setValues([[
      "'" + info.entrega,
      "'" + info.tienda,
      info.area,
      info.ubicacion,
      estadoActual,
      newFechaEntrada,
      newUserEntrada,
      newFechaSalida,
      newUserSalida,
      info.fechaHora,
      prevTotal + 1
    ]]);
  }
}

// =========================================================================================
// 3. BUSCAR POR NÚMERO DE GRUPO / ENTREGA (FUNCIÓN ADMINISTRATIVA)
// =========================================================================================
function handleBuscarGrupo(ss, grupoQuery, tiendaQuery, areaQuery) {
  const cleanGrupo = String(grupoQuery || "").trim().toLowerCase();
  const cleanTienda = String(tiendaQuery || "").trim().toLowerCase();
  const cleanArea = String(areaQuery || "").trim().toUpperCase();

  const shMov = ss.getSheetByName(TAB_MOVIMIENTOS);
  const movData = shMov.getDataRange().getDisplayValues();

  const historial = [];
  // Recorrer de más reciente a más antiguo
  for (let i = movData.length - 1; i >= 1; i--) {
    const r = movData[i];
    const idMov = String(r[0] || "").trim();
    const fechaHora = String(r[1] || "").trim();
    const fecha = String(r[2] || "").trim();
    const hora = String(r[3] || "").trim();
    const area = String(r[4] || "").trim();
    const tipo = String(r[5] || "").trim();
    const tienda = String(r[6] || "").trim();
    const entrega = String(r[7] || "").trim();
    const ubicacion = String(r[8] || "").trim();
    const usuario = String(r[9] || "").trim();
    const nombreUsuario = String(r[10] || "").trim();
    const rolUsuario = String(r[11] || "").trim();
    const observaciones = String(r[12] || "").trim();

    if (!idMov && !entrega) continue;

    const matchGrupo = !cleanGrupo || entrega.toLowerCase().includes(cleanGrupo) || ubicacion.toLowerCase().includes(cleanGrupo);
    const matchTienda = !cleanTienda || tienda.toLowerCase().includes(cleanTienda);
    const matchArea = !cleanArea || cleanArea === "TODAS" || area.toUpperCase() === cleanArea;

    if (matchGrupo && matchTienda && matchArea) {
      historial.push({
        id: idMov,
        fechaHora: fechaHora,
        fecha: fecha,
        hora: hora,
        area: area,
        tipoMovimiento: tipo,
        tienda: tienda,
        entrega: entrega,
        ubicacion: ubicacion,
        usuario: usuario,
        nombreUsuario: nombreUsuario,
        rolUsuario: rolUsuario,
        observaciones: observaciones
      });
    }
  }

  // Agrupar resumen por cada Entrega/Grupo encontrado
  const gruposMap = {};
  // Procesar del más antiguo al más reciente para construir el estado cronológico exacto
  for (let i = historial.length - 1; i >= 0; i--) {
    const mov = historial[i];
    const key = mov.entrega;
    if (!gruposMap[key]) {
      gruposMap[key] = {
        entrega: mov.entrega,
        tienda: mov.tienda,
        areaActual: mov.area,
        ubicacionActual: mov.ubicacion,
        ultimoMovimiento: mov.tipoMovimiento,
        estadoActual: mov.tipoMovimiento === "ENTRADA" ? "EN UBICACIÓN" : "SALIDA REGISTRADA",
        fechaHoraEntrada: "",
        usuarioEntrada: "",
        ubicacionEntrada: "",
        fechaHoraSalida: "",
        usuarioSalida: "",
        ubicacionSalida: "",
        ultimaFechaHora: mov.fechaHora,
        totalMovimientos: 0,
        movimientos: []
      };
    }
    const g = gruposMap[key];
    g.tienda = mov.tienda;
    g.areaActual = mov.area;
    g.ubicacionActual = mov.ubicacion;
    g.ultimoMovimiento = mov.tipoMovimiento;
    g.estadoActual = mov.tipoMovimiento === "ENTRADA" ? "EN UBICACIÓN" : "SALIDA REGISTRADA";
    g.ultimaFechaHora = mov.fechaHora;
    g.totalMovimientos += 1;

    if (mov.tipoMovimiento === "ENTRADA") {
      g.fechaHoraEntrada = mov.fechaHora;
      g.usuarioEntrada = mov.usuario + (mov.nombreUsuario ? " (" + mov.nombreUsuario + ")" : "");
      g.ubicacionEntrada = mov.ubicacion;
    } else if (mov.tipoMovimiento === "SALIDA") {
      g.fechaHoraSalida = mov.fechaHora;
      g.usuarioSalida = mov.usuario + (mov.nombreUsuario ? " (" + mov.nombreUsuario + ")" : "");
      g.ubicacionSalida = mov.ubicacion;
    }
    g.movimientos.unshift(mov); // Más reciente primero dentro del grupo
  }

  const gruposResumen = Object.keys(gruposMap).map(k => gruposMap[k]);

  return {
    success: true,
    query: grupoQuery || "",
    totalMovimientos: historial.length,
    grupos: gruposResumen,
    historial: historial
  };
}

// =========================================================================================
// 4. LISTAR MOVIMIENTOS RECIENTES Y ESTADÍSTICAS
// =========================================================================================
function handleGetMovimientos(ss, params) {
  const limit = parseInt(params.limit || "300", 10) || 300;
  const res = handleBuscarGrupo(ss, params.grupo || "", params.tienda || "", params.area || "");
  return {
    success: true,
    movimientos: res.historial.slice(0, limit),
    grupos: res.grupos,
    totalMovimientos: res.totalMovimientos
  };
}

// =========================================================================================
// 5. GESTIÓN DE USUARIOS (SOLO ADMINISTRATIVO)
// =========================================================================================
function handleGetUsuarios(ss) {
  const sheet = ss.getSheetByName(TAB_USUARIOS);
  const data = sheet.getDataRange().getDisplayValues();
  const usuarios = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!String(r[0] || "").trim()) continue;
    usuarios.push({
      usuario: String(r[0] || "").trim(),
      nombre: String(r[1] || "").trim(),
      password: String(r[2] || "").trim(),
      rol: String(r[3] || "Operativo").trim(),
      activo: String(r[4] || "SI").trim().toUpperCase(),
      fechaCreacion: String(r[5] || "").trim(),
      creadoPor: String(r[6] || "").trim()
    });
  }

  return { success: true, usuarios: usuarios };
}

function handleCrearUsuario(ss, payload) {
  const nuevoUsuario = String(payload.usuario || "").trim();
  const nombre = String(payload.nombre || "").trim();
  const password = String(payload.password || "1234").trim();
  const rolInput = String(payload.rol || "Operativo").trim();
  const creadoPor = String(payload.creadoPor || "admin").trim();

  if (!nuevoUsuario || !nombre) {
    return { success: false, message: "El usuario y el nombre completo son obligatorios." };
  }

  const rol = rolInput.toLowerCase().includes("admin") ? "Administrativo" : "Operativo";
  const sheet = ss.getSheetByName(TAB_USUARIOS);
  const data = sheet.getDataRange().getDisplayValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim().toLowerCase() === nuevoUsuario.toLowerCase()) {
      return { success: false, message: "El usuario '" + nuevoUsuario + "' ya existe." };
    }
  }

  const nowStr = formatNow();
  sheet.appendRow([
    nuevoUsuario,
    nombre,
    "'" + password,
    rol,
    "SI",
    nowStr,
    creadoPor
  ]);

  return {
    success: true,
    message: "Usuario '" + nuevoUsuario + "' (" + rol + ") creado exitosamente.",
    usuario: {
      usuario: nuevoUsuario,
      nombre: nombre,
      rol: rol,
      activo: "SI",
      fechaCreacion: nowStr,
      creadoPor: creadoPor
    }
  };
}

function handleToggleUsuario(ss, payload) {
  const targetUser = String(payload.usuario || "").trim().toLowerCase();
  if (!targetUser) {
    return { success: false, message: "Especifique el usuario a modificar." };
  }

  const sheet = ss.getSheetByName(TAB_USUARIOS);
  const data = sheet.getDataRange().getDisplayValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim().toLowerCase() === targetUser) {
      const currentActivo = String(data[i][4] || "SI").trim().toUpperCase();
      const nextActivo = currentActivo === "SI" ? "NO" : "SI";
      sheet.getRange(i + 1, 5).setValue(nextActivo);
      return {
        success: true,
        message: "Estado del usuario '" + data[i][0] + "' actualizado a Activo = " + nextActivo,
        activo: nextActivo
      };
    }
  }

  return { success: false, message: "Usuario no encontrado." };
}

// =========================================================================================
// HELPERS
// =========================================================================================
function formatNow() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
}

function respondJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
