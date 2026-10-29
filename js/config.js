// ==========================================================================
// CONFIGURACIÓN DE CONEXIÓN CON GOOGLE SHEETS Y APPS SCRIPT
// ==========================================================================

const DEFAULT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyQCq1sH7UY04m8mI4O5AlUl9jDmLzhpUNcP6j1pulHa-9HKGszUGLqA1ZLFkLuV4MrkQ/exec";

const CONFIG = {
  // ID de la hoja de Google Sheets ("Base de datos Alto costo")
  SHEET_ID: "1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg",
  SHEET_URL: "https://docs.google.com/spreadsheets/d/1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg/edit",

  // Pestañas que se crean automáticamente en el Google Sheet
  TAB_USUARIOS: "Usuarios",
  TAB_MOVIMIENTOS: "Movimientos",
  TAB_AUDITAR: "Auditar",
  TAB_TARIMAS: "Tarimas",
  TAB_ESTADO: "Estado_Grupos",

  // URL del Web App de Google Apps Script desplegada
  APPS_SCRIPT_WEBAPP_URL: DEFAULT_WEBAPP_URL,

  // Conectado en vivo a Google Sheets por defecto
  DEMO_MODE: false,

  // Ubicaciones sugeridas para botones rápidos (además del escáner)
  UBICACIONES_AUDITAR: [
    "SA-01-1", "SA-01-2", "SA-01-3",
    "SA-02-1", "SA-02-2", "SA-02-3",
    "SA-03-1", "SA-03-2", "SA-03-3"
  ],
  UBICACIONES_TARIMAS: [
    "K1", "K2", "K3", "K4", "K5",
    "L1", "L2", "L3", "L4", "L5",
    "M1", "M2", "M3"
  ],

  APP_VERSION: "1.0.1"
};

(function initConfig() {
  const savedUrl = localStorage.getItem("grupos_entrega_apps_script_url");
  if (savedUrl && savedUrl.trim() !== "") {
    CONFIG.APPS_SCRIPT_WEBAPP_URL = savedUrl.trim();
  } else {
    CONFIG.APPS_SCRIPT_WEBAPP_URL = DEFAULT_WEBAPP_URL;
    localStorage.setItem("grupos_entrega_apps_script_url", DEFAULT_WEBAPP_URL);
  }

  const savedDemo = localStorage.getItem("grupos_entrega_demo_mode");
  if (savedDemo === "true" && !CONFIG.APPS_SCRIPT_WEBAPP_URL) {
    CONFIG.DEMO_MODE = true;
  } else {
    CONFIG.DEMO_MODE = false;
    localStorage.setItem("grupos_entrega_demo_mode", "false");
  }
})();
