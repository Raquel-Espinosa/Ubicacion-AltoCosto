# 📦 Control de Grupos de Entrega y Auditoría (Google Sheets + GitHub Pages)

Aplicación web responsiva optimizada para **escáneres de código de barras (Handheld), tablets, celulares y PC**, conectada a la hoja de cálculo de Google Sheets:
- **ID de Google Sheet:** `1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg` (*Base de datos Alto costo*)
- **Enlace directo:** [Abrir Hoja de Google Sheets](https://docs.google.com/spreadsheets/d/1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg/edit)

---

## 🚀 Funciones Principales

### 1. Dos Modalidades de Captura con Escáner (`ENTRADA` y `SALIDA`)
- **🔍 Para Auditar:**
  - **Tienda:** `4 dígitos` numéricos (ej. `7101`).
  - **Grupo:** `10 dígitos` numéricos (ej. `8012345678`).
  - **Ubicación:** `7 caracteres` (ej. `SA-01-1`, `SA-01-2`, `SA-01-3`, `SA-02-1`). *(Si el escáner lee `SA011` sin guiones, el sistema lo formatea automáticamente a `SA-01-1`).*
  - **Movimiento:** Registra si **Entra (`ENTRADA`)** o **Sale (`SALIDA`)**.
- **📦 En las Tarimas (Grupos de Entrega):**
  - **Tienda:** `4 dígitos` numéricos (ej. `7101`).
  - **Grupo:** `10 dígitos` numéricos (ej. `8012345678`).
  - **Ubicación:** `2 caracteres` (ej. `K1`, `K2`, `K3`, `L1`, `L2`, etc.).
  - **Movimiento:** Registra si **Entra (`ENTRADA`)** o **Sale (`SALIDA`)**.
- **Auto-Avance para Escáner:** Al escanear los 4 dígitos de la tienda salta automáticamente al campo de Grupo; al escanear los 10 dígitos del grupo salta a Ubicación; y al completar la ubicación guarda automáticamente el registro con confirmación sonora (beep).

### 2. Dos Roles de Usuario
- **👷 Usuario Operativo (`Operativo`):**
  - Acceso exclusivo al módulo de **Captura de Entrada y Salida** (tanto para **Auditar** como para **Tarimas**) y visualización de sus capturas recientes.
- **🛡️ Usuario Administrativo (`Administrativo`):**
  - Puede registrar **Entradas y Salidas** igual que el operativo.
  - **🔍 Buscador por Número de Grupo:** Al ingresar o escanear el número de grupo (`10 dígitos`), muestra su **ubicación actual/última**, el área (`AUDITAR` o `TARIMAS`), la **fecha y hora exacta en la que entró** y la **fecha y hora exacta en la que salió**, además del historial completo y exportación a CSV/Excel.
  - **👥 Creación y Administración de Usuarios:** Permite dar de alta nuevos usuarios (`Operativo` o `Administrativo`), asignar contraseña/PIN y activar o desactivar cuentas.

---

## 📊 Hojas y Columnas Creadas Automáticamente en Google Sheets

El archivo `google-apps-script/Code.gs` crea y formatea automáticamente las siguientes **5 pestañas** dentro del archivo `1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg`:

1. **`Usuarios`**
   - Columnas: `Usuario` | `Nombre` | `Password` | `Rol` | `Activo` | `Fecha_Creacion` | `Creado_Por`
   - Usuarios creados por defecto:
     - `admin` / Clave: `1234` (Rol: `Administrativo`)
     - `operativo` / Clave: `1234` (Rol: `Operativo`)
2. **`Movimientos`** *(Bitácora general consolidada)*
   - Columnas: `ID_Movimiento` | `Fecha_Hora` | `Fecha` | `Hora` | `Area` | `Tipo_Movimiento` | `Tienda` | `Grupo` | `Ubicacion` | `Usuario` | `Nombre_Usuario` | `Rol_Usuario` | `Observaciones`
3. **`Auditar`** *(Solo movimientos de grupos para auditar)*
   - Columnas: `ID_Movimiento` | `Fecha_Hora` | `Tipo_Movimiento` | `Tienda_4Dig` | `Grupo_10Dig` | `Ubicacion_7Dig` | `Usuario` | `Nombre_Usuario` | `Observaciones`
4. **`Tarimas`** *(Solo movimientos de grupos en tarimas)*
   - Columnas: `ID_Movimiento` | `Fecha_Hora` | `Tipo_Movimiento` | `Tienda_4Dig` | `Grupo_10Dig` | `Ubicacion_2Dig` | `Usuario` | `Nombre_Usuario` | `Observaciones`
5. **`Estado_Grupos`** *(Resumen en vivo por número de grupo)*
   - Columnas: `Grupo` | `Tienda` | `Area_Actual` | `Ubicacion_Actual` | `Estado_Actual` | `Fecha_Hora_Entrada` | `Usuario_Entrada` | `Fecha_Hora_Salida` | `Usuario_Salida` | `Ultima_Actualizacion` | `Total_Movimientos`

---

## 🛠️ Cómo Activar la Base de Datos en Google Sheets (1 Minuto)

1. Abre tu hoja de Google Sheets: [`1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg`](https://docs.google.com/spreadsheets/d/1GuqbZE-nPD_uqIXMPwxYT-LfBmhj_1L5bC8uXChcczg/edit).
2. En el menú superior, haz clic en **Extensiones > Apps Script**.
3. Copia todo el código del archivo [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) y pégalo reemplazando el contenido del editor. Guarda con `Ctrl + S`.
4. *(Opcional)* En la barra superior del editor de Apps Script, selecciona la función `inicializarHojasYColumnas` y presiona **Ejecutar** para que se creen de inmediato todas las pestañas y encabezados en tu Google Sheet.
5. Haz clic en **Implementar > Nueva implementación**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquiera (Anyone)**
6. Copia la URL que termina en `/exec`, abre la app web, haz clic en el botón superior **⚙️ Modo Demo** y pega la URL (o colócala en `js/config.js` en `APPS_SCRIPT_WEBAPP_URL`).
