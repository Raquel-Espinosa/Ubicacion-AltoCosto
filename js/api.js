// ==========================================================================
// CONECTOR API CON GOOGLE APPS SCRIPT + MODO DEMO PERSISTENTE
// ==========================================================================

const API = {
  STORAGE_USERS_KEY: "grupos_entrega_demo_users_v1",
  STORAGE_MOVS_KEY: "grupos_entrega_demo_movs_v2",

  initDemoData() {
    if (!localStorage.getItem(this.STORAGE_USERS_KEY)) {
      const defaultUsers = [
        {
          usuario: "admin",
          nombre: "Administrador General",
          password: "1234",
          rol: "Administrativo",
          activo: "SI",
          fechaCreacion: "2026-10-29 08:00:00",
          creadoPor: "SISTEMA"
        },
        {
          usuario: "operativo",
          nombre: "Operador Escáner 1",
          password: "1234",
          rol: "Operativo",
          activo: "SI",
          fechaCreacion: "2026-10-29 08:00:00",
          creadoPor: "SISTEMA"
        }
      ];
      localStorage.setItem(this.STORAGE_USERS_KEY, JSON.stringify(defaultUsers));
    }

    if (!localStorage.getItem(this.STORAGE_MOVS_KEY)) {
      const sampleMovs = [
        {
          id: "MOV-20261029091510-101",
          fechaHora: "2026-10-29 09:15:10",
          fecha: "2026-10-29",
          hora: "09:15:10",
          area: "AUDITAR",
          tipoMovimiento: "ENTRADA",
          tienda: "7101",
          entrega: "8012345678",
          ubicacion: "SA-01-1",
          usuario: "operativo",
          nombreUsuario: "Operador Escáner 1",
          rolUsuario: "Operativo",
          observaciones: "Ingreso a jaula de auditoría"
        },
        {
          id: "MOV-20261029104200-204",
          fechaHora: "2026-10-29 10:42:00",
          fecha: "2026-10-29",
          hora: "10:42:00",
          area: "AUDITAR",
          tipoMovimiento: "SALIDA",
          tienda: "7101",
          entrega: "8012345678",
          ubicacion: "SA-01-1",
          usuario: "operativo",
          nombreUsuario: "Operador Escáner 1",
          rolUsuario: "Operativo",
          observaciones: "Auditoría liberada"
        },
        {
          id: "MOV-20261029105012-309",
          fechaHora: "2026-10-29 10:50:12",
          fecha: "2026-10-29",
          hora: "10:50:12",
          area: "TARIMAS",
          tipoMovimiento: "ENTRADA",
          tienda: "7101",
          entrega: "8012345678",
          ubicacion: "K1",
          usuario: "operativo",
          nombreUsuario: "Operador Escáner 1",
          rolUsuario: "Operativo",
          observaciones: "Ubicado en tarima de embarque"
        },
        {
          id: "MOV-20261029112045-412",
          fechaHora: "2026-10-29 11:20:45",
          fecha: "2026-10-29",
          hora: "11:20:45",
          area: "AUDITAR",
          tipoMovimiento: "ENTRADA",
          tienda: "7104",
          entrega: "8098765432",
          ubicacion: "SA-02-1",
          usuario: "operativo",
          nombreUsuario: "Operador Escáner 1",
          rolUsuario: "Operativo",
          observaciones: "Pendiente de auditar"
        },
        {
          id: "MOV-20261029114530-518",
          fechaHora: "2026-10-29 11:45:30",
          fecha: "2026-10-29",
          hora: "11:45:30",
          area: "TARIMAS",
          tipoMovimiento: "ENTRADA",
          tienda: "7112",
          entrega: "8055443322",
          ubicacion: "L1",
          usuario: "admin",
          nombreUsuario: "Administrador General",
          rolUsuario: "Administrativo",
          observaciones: "Consolidado en L1"
        }
      ];
      localStorage.setItem(this.STORAGE_MOVS_KEY, JSON.stringify(sampleMovs));
    }
  },

  getDemoUsers() {
    this.initDemoData();
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_USERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  saveDemoUsers(users) {
    localStorage.setItem(this.STORAGE_USERS_KEY, JSON.stringify(users));
  },

  getDemoMovs() {
    this.initDemoData();
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_MOVS_KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  saveDemoMovs(movs) {
    localStorage.setItem(this.STORAGE_MOVS_KEY, JSON.stringify(movs));
  },

  formatNow() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return { fechaHora: `${fecha} ${hora}`, fecha, hora };
  },

  async requestGet(params) {
    const url = new URL(CONFIG.APPS_SCRIPT_WEBAPP_URL);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.append(k, params[k]);
      }
    });
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    return await res.json();
  },

  async requestPost(payload) {
    const res = await fetch(CONFIG.APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  async ping() {
    if (CONFIG.DEMO_MODE) {
      return {
        success: true,
        demo: true,
        message: "Modo Demo Activo (Datos guardados localmente en el navegador)"
      };
    }
    return await this.requestGet({ action: "ping" });
  },

  async initSheets() {
    if (CONFIG.DEMO_MODE) {
      this.initDemoData();
      return {
        success: true,
        message: "Modo Demo: estructura local inicializada. Para crear las pestañas en Google Sheets, desactive Modo Demo y conecte la URL de Apps Script."
      };
    }
    return await this.requestPost({ action: "initSheets" });
  },

  async login(usuario, password) {
    if (CONFIG.DEMO_MODE) {
      const users = this.getDemoUsers();
      const cleanUser = String(usuario || "").trim().toLowerCase();
      const cleanPass = String(password || "").trim();
      const found = users.find(u => String(u.usuario).trim().toLowerCase() === cleanUser);

      if (!found) {
        return { success: false, message: "Usuario no encontrado. (En modo demo use 'operativo' o 'admin', clave '1234')" };
      }
      if (String(found.activo).toUpperCase() === "NO") {
        return { success: false, message: "Este usuario se encuentra inactivo." };
      }
      if (found.password && String(found.password) !== cleanPass) {
        return { success: false, message: "Contraseña o PIN incorrecto." };
      }
      return {
        success: true,
        user: {
          usuario: found.usuario,
          nombre: found.nombre,
          rol: found.rol
        }
      };
    }
    return await this.requestGet({ action: "login", usuario, password });
  },

  async registrarMovimiento(payload) {
    if (CONFIG.DEMO_MODE) {
      const { fechaHora, fecha, hora } = this.formatNow();
      const id = `MOV-${fecha.replace(/-/g, "")}${hora.replace(/:/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
      const nuevo = {
        id,
        fechaHora,
        fecha,
        hora,
        area: String(payload.area || "").toUpperCase(),
        tipoMovimiento: String(payload.tipoMovimiento || "").toUpperCase(),
        tienda: String(payload.tienda || "").trim(),
        entrega: String(payload.entrega || "").trim(),
        ubicacion: String(payload.ubicacion || "").trim().toUpperCase(),
        usuario: payload.usuario || "operativo",
        nombreUsuario: payload.nombreUsuario || payload.usuario || "Operador",
        rolUsuario: payload.rolUsuario || "Operativo",
        observaciones: payload.observaciones || ""
      };
      const movs = this.getDemoMovs();
      movs.push(nuevo);
      this.saveDemoMovs(movs);
      return {
        success: true,
        message: `${nuevo.tipoMovimiento} registrada en ${nuevo.area} (${nuevo.ubicacion})`,
        movimiento: nuevo
      };
    }
    return await this.requestPost({ action: "registrarMovimiento", ...payload });
  },

  buildGruposSummary(movimientosDesc) {
    const gruposMap = {};
    // Procesar del más antiguo al más reciente
    for (let i = movimientosDesc.length - 1; i >= 0; i--) {
      const mov = movimientosDesc[i];
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
        g.usuarioEntrada = mov.usuario + (mov.nombreUsuario ? ` (${mov.nombreUsuario})` : "");
        g.ubicacionEntrada = mov.ubicacion;
      } else if (mov.tipoMovimiento === "SALIDA") {
        g.fechaHoraSalida = mov.fechaHora;
        g.usuarioSalida = mov.usuario + (mov.nombreUsuario ? ` (${mov.nombreUsuario})` : "");
        g.ubicacionSalida = mov.ubicacion;
      }
      g.movimientos.unshift(mov);
    }
    return Object.keys(gruposMap).map(k => gruposMap[k]);
  },

  async buscarGrupo(grupo = "", tienda = "", area = "") {
    if (CONFIG.DEMO_MODE) {
      const movs = this.getDemoMovs();
      const qGrupo = String(grupo || "").trim().toLowerCase();
      const qTienda = String(tienda || "").trim().toLowerCase();
      const qArea = String(area || "").trim().toUpperCase();

      const filteredDesc = [...movs].reverse().filter(m => {
        const matchG = !qGrupo || m.entrega.toLowerCase().includes(qGrupo) || m.ubicacion.toLowerCase().includes(qGrupo);
        const matchT = !qTienda || m.tienda.toLowerCase().includes(qTienda);
        const matchA = !qArea || qArea === "TODAS" || m.area.toUpperCase() === qArea;
        return matchG && matchT && matchA;
      });

      const grupos = this.buildGruposSummary(filteredDesc);
      return {
        success: true,
        query: grupo,
        totalMovimientos: filteredDesc.length,
        grupos,
        historial: filteredDesc
      };
    }
    return await this.requestGet({ action: "buscarGrupo", grupo, tienda, area });
  },

  async getUsuarios() {
    if (CONFIG.DEMO_MODE) {
      return { success: true, usuarios: this.getDemoUsers() };
    }
    return await this.requestGet({ action: "getUsuarios" });
  },

  async crearUsuario(payload) {
    if (CONFIG.DEMO_MODE) {
      const users = this.getDemoUsers();
      const cleanUser = String(payload.usuario || "").trim();
      if (!cleanUser || !payload.nombre) {
        return { success: false, message: "Usuario y nombre son obligatorios." };
      }
      if (users.some(u => u.usuario.toLowerCase() === cleanUser.toLowerCase())) {
        return { success: false, message: `El usuario '${cleanUser}' ya existe.` };
      }
      const { fechaHora } = this.formatNow();
      const nuevo = {
        usuario: cleanUser,
        nombre: String(payload.nombre).trim(),
        password: String(payload.password || "1234").trim(),
        rol: payload.rol === "Administrativo" ? "Administrativo" : "Operativo",
        activo: "SI",
        fechaCreacion: fechaHora,
        creadoPor: payload.creadoPor || "admin"
      };
      users.push(nuevo);
      this.saveDemoUsers(users);
      return {
        success: true,
        message: `Usuario '${nuevo.usuario}' (${nuevo.rol}) creado correctamente.`,
        usuario: nuevo
      };
    }
    return await this.requestPost({ action: "crearUsuario", ...payload });
  },

  async toggleUsuario(usuario) {
    if (CONFIG.DEMO_MODE) {
      const users = this.getDemoUsers();
      const idx = users.findIndex(u => u.usuario.toLowerCase() === String(usuario).toLowerCase());
      if (idx === -1) return { success: false, message: "Usuario no encontrado." };
      users[idx].activo = users[idx].activo === "SI" ? "NO" : "SI";
      this.saveDemoUsers(users);
      return {
        success: true,
        message: `Estado de '${users[idx].usuario}' actualizado a ${users[idx].activo}`,
        activo: users[idx].activo
      };
    }
    return await this.requestPost({ action: "toggleUsuario", usuario });
  }
};
