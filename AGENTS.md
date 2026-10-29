# NFLARG · Guía completa para la IA que siga este proyecto

> **Leé este archivo entero antes de tocar cualquier cosa.** Está escrito para que una IA (GPT, Codex, Claude u otra) pueda seguir el proyecto sin romper nada. Explica qué es, cómo funciona por dentro, cómo se ve, qué trampas ya se resolvieron y qué prefiere el dueño.
>
> Sitio en producción: **https://nflarg.com.ar** · Repo: `IvanLaSpada/nflarg` · Rama publicada: `claude/nifty-hopper-jra203`

---

## 0. Reglas de oro (no las rompas)

1. **Todo el sitio es UN solo archivo: `index.html`** (HTML + CSS + JS vanilla). No hay build, ni npm, ni frameworks, ni bundler. No lo partas en archivos, no agregues React/Vue/Tailwind, no agregues un `package.json` para la app.
2. **La interfaz está en español rioplatense** ("vos", "tenés", "entrá"). Textos para el usuario, mensajes de error y comentarios del código: en español. Nunca dejes textos en inglés salvo términos de fútbol americano (down, touchdown, RedZone…).
3. **Nada de placeholders ni "TODO".** Todo lo que se agrega tiene que funcionar completo.
4. **No rompas el estilo visual** (sección 8). Es intencionalmente "web deportiva yankee 2003–2007" (ESPN.com vieja, NFL.com de esa época, Madden 2005): degradés brillantes, biseles, cromados, rojo/azul marino/blanco. No lo "modernices" ni lo hagas minimalista.
5. **Antes de cambiar la base de datos, leé la sección 10.** El SQL vive en `supabase/foro.sql`, tiene que seguir siendo **re-ejecutable** (idempotente) y el dueño lo corre **entero** en el SQL Editor de Supabase cada vez que cambia.
6. **Si cambiás `supabase/foro.sql`, avisale al dueño que tiene que volver a correrlo.** Si no lo corre, la página falla con errores tipo "column … does not exist".
7. **Manejá datos faltantes en todos lados.** La API de ESPN es no oficial y cambia: usá siempre `arr()`, `?.`, valores por defecto y caídas a otras fuentes (sección 6). Nunca dejes la pantalla en blanco: ante un error mostrá `errorBox(e)` con el botón "Reintentar".
8. **Escapá todo lo que viene de afuera** con `esc()` antes de meterlo en HTML (ESPN, Supabase, lo que escriben los usuarios). El foro no permite HTML ni imágenes.
9. **Antes de hacer push, traé lo último de GitHub** (`git fetch` + merge). GitHub a veces agrega commits solo (por ejemplo el archivo `CNAME` cuando se configura el dominio). Nunca hagas force-push.
10. **Las capturas y descripciones del dueño mandan.** Si pide algo puntual de diseño o comportamiento, se hace así aunque contradiga una idea anterior.

---

## 1. Qué es

- Una web de **resultados de fútbol americano al estilo Promiedos** (el sitio argentino de resultados de fútbol), pero para la **NFL** y otras ligas: **NCAA FBS**, **NCAA FCS**, **UFL** y **CFL**.
- Pensada para hinchas argentinos: **horarios en la zona del navegador** y **"dónde verlo en Argentina"**.
- Tiene un **foro** "a la vieja usanza", como el viejo foro de Promiedos: registro con usuario y contraseña, un foro general y un foro por franquicia NFL, citas, emojis, likes/dislikes, notificaciones y rankings de hinchadas.
- Dueño: Iván (marca **LSPD Studio**, Instagram **@lspd.studio**). El footer dice "Hecho por LSPD Studio" con link a su Instagram.
- Datos deportivos: **API pública no oficial de ESPN** (gratis, sin clave). Foro: **Supabase** (plan gratis).

---

## 2. Archivos del repo

| Archivo | Qué es |
|---|---|
| `index.html` | **Todo el sitio.** CSS + HTML + JS. ~2600 líneas. |
| `supabase/foro.sql` | Script completo de la base del foro (tablas, triggers, funciones, permisos, almacenamiento de fotos). Idempotente. |
| `CNAME` | Contiene `nflarg.com.ar`. Lo creó GitHub Pages. **No borrar ni editar.** |
| `favicon.ico`, `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png` | Íconos del sitio (el logo). |
| `og-image.jpg` | Imagen de vista previa al compartir el link (1200×630). |
| `AGENTS.md` | Este documento. |
| `tests/` | Pruebas automáticas con Playwright y datos simulados (sección 12). No se publican como parte del sitio, pero no molestan. |

---

## 3. Publicación, dominio y DNS

- **Hosting:** GitHub Pages, desde la rama **`claude/nifty-hopper-jra203`**, carpeta `/` (root). Cualquier push a esa rama se publica solo en 1–2 minutos.
- **Dominio:** `nflarg.com.ar` (comprado en NIC Argentina). En GitHub → Settings → Pages → Custom domain = `nflarg.com.ar`, con "Enforce HTTPS".
- **DNS en Cloudflare** (plan Free). Los nameservers de NIC.ar apuntan a Cloudflare (`bowen.ns.cloudflare.com`, `brynne.ns.cloudflare.com`). Registros, **todos en "DNS only" (nube gris)**, porque si están en naranja GitHub no puede emitir el certificado:
  - `A @ 185.199.108.153` · `A @ 185.199.109.153` · `A @ 185.199.110.153` · `A @ 185.199.111.153`
  - `CNAME www ivanlaspada.github.io`
- Después de publicar, el dueño recarga con **Ctrl+Shift+R** para evitar la caché.

---

## 4. Arquitectura de `index.html`

El archivo está dividido en secciones con comentarios grandes `/* ===== NOMBRE ===== */`. Buscalas por nombre (los números de línea cambian):

1. **`<head>`**: título, íconos, meta description, **etiquetas Open Graph / Twitter** (vista previa al compartir; URLs absolutas a `https://nflarg.com.ar/og-image.jpg`), Google Fonts (Oswald, Teko, Graduate, Share Tech Mono).
2. **`ESTILOS · NFL / ESPN circa 2003-2007`**: todo el CSS. Variables en `:root` (sección 8).
3. **HTML base**: `#ticker` (cartelera arriba), `<header id="top">` con `.hdr-in` (☰ `#burger`, `.brand` con el logo, `.hdr-tools` con la búsqueda `#q` y el selector de temporada `#seasonSel`, y `.notif` con la campanita `#bell`), `.stripes` (franja divisoria), `#wrap` con `<aside id="side">` (barra lateral) y `<main id="view">` (contenido), `#scrim` (fondo oscuro del menú móvil) y `<footer>`.
4. **`CONFIG`**: `LEAGUES` (ligas), `LG_LOGO`, URLs base de ESPN (`SITE`, `STAND`, `CORE`, `WEB`, `SEARCH`), TTLs de caché.
5. **`UTILIDADES`**: `$`, `arr`, `esc`, fechas (`ymd`, `parseYmd`, `fmtTime`, `fmtLong`…), `pool` (concurrencia limitada), `debounce`.
6. **`API`**: capa de fetch central con caché (sección 6).
7. **`ESTADO`**: objeto `state` (ruta actual, temporada elegida, filtros, etc.).
8. **`DATOS DE LIGA`**: `probeLeague`, `ready`, `seasonsFor`, `teamsOf`, `standingsOf`, `sortEntries`.
9. **`NORMALIZACIÓN DE PARTIDOS`**: `normGame` convierte cualquier partido de ESPN a un formato propio; `statusInfo`; `arInfo` (TV Argentina).
10. **`COMPONENTES`**: `logo()`, `headshot()`, `spinner()`, `skeleton()`, `errorBox()`, `emptyBox()`, `gameRow()` (la fila de partido estilo Promiedos).
11. **`NAV / SIDEBAR / TICKER / TEMPORADAS`**: `renderSidebar`, `renderSeasonSelect`, `onSeasonChange`, `renderTicker`.
12. **`ROUTER`**: `parseHash`, `go`, `route(silent)`.
13. **`VISTAS`**: `VIEWS.day`, `VIEWS.league`, `VIEWS.game`, `VIEWS.team`, `VIEWS.player`, `VIEWS.foro`, `VIEWS.notfound`.
14. **`FORO (Supabase)`**: todo el foro, las notificaciones y los rankings.
15. **`BUSCADOR`**: búsqueda de equipos y jugadores.
16. **`ACCIONES GLOBALES + ARRANQUE`**: `window.App` (funciones llamadas desde `onclick=` en el HTML) e `init()` (eventos e intervalos de refresco).

### Patrón de render (importante)
- Cada vista es `async (r, el, ctx) => {...}`. `r` = ruta parseada, `el` = `#view`, `ctx = {id, silent}`.
- `route(silent)` incrementa `state.renderId`. **Siempre pintá con `paint(ctx, el, html)`**, que solo pinta si `ctx.id === state.renderId`. Así una respuesta vieja no pisa una vista nueva.
- `silent = true` = refresco en segundo plano: **no mostrar spinner** y no hacer scroll.
- Los botones del HTML llaman a `App.algo(...)`. Si agregás una acción, sumala a `window.App`.

---

## 5. Rutas (hash routing)

| Hash | Vista |
|---|---|
| `#/hoy` (o vacío) | Home: partidos del día de todas las ligas + **Foro General** abajo |
| `#/hoy/AAAAMMDD` | Home de otra fecha |
| `#/hoy[/AAAAMMDD]/foro[/temas \| /t/ID[/pag] \| /nuevo \| /rankings[/actividad] \| /muro/pag]` | Home con el foro en esa solapa (hace scroll al foro) |
| `#/{liga}/hoy[/AAAAMMDD]` | Partidos del día de una sola liga (sin foro) |
| `#/{liga}/partidos[/temporada[/tipo[/semana]]]` | Liga → Partidos por semana (tipo: 1 pretemporada, 2 regular, 3 playoffs) |
| `#/{liga}/posiciones[/temporada]` | Liga → Posiciones |
| `#/{liga}/stats[/temporada]` | Liga → Líderes estadísticos |
| `#/{liga}/team/{id}[/plantel\|fixture\|stats[/temporada]]` | Equipo |
| `#/nfl/team/{id}/foro[/temas …]` | Foro de la franquicia (solo NFL) |
| `#/{liga}/player/{id}` | Jugador |
| `#/{liga}/game/{id}[/foro/…]` | Detalle de partido (con Foro General abajo) |
| `#/foro[/temas\|/t/ID\|/nuevo\|/rankings\|/muro/pag]` | Foro General (sección Foro del menú) |
| `#/foro/entrar` · `#/foro/registro` · `#/foro/perfil` | Cuenta |

`{liga}` = `nfl`, `fbs`, `fcs`, `ufl`, `cfl`. Las sub-rutas del foro se parsean con `parseForoRest()`.

---

## 6. Datos de ESPN

### Endpoints usados
- Scoreboard: `site.api.espn.com/apis/site/v2/sports/football/{slug}/scoreboard?dates=…` (acepta un día `AAAAMMDD`, un rango `AAAAMMDD-AAAAMMDD`, o `dates={año}&seasontype={1|2|3}&week={n}`). College: se agrega `groups=80` (FBS) o `groups=81` (FCS) y `limit=300` (lo hace `sbUrl()`).
- Detalle de partido: `…/{slug}/summary?event={id}`.
- Posiciones: `site.api.espn.com/apis/v2/sports/football/{slug}/standings?season=…` (**ojo: `/apis/v2`, no `/apis/site/v2`**). `level=3` trae divisiones; college usa `group=80/81`.
- Líderes: `sports.core.api.espn.com/v2/sports/football/leagues/{slug}/seasons/{año}/types/2/leaders` → trae referencias `$ref` que hay que pedir aparte (con `pool()`, concurrencia 10).
- Temporadas disponibles: `…/leagues/{slug}/seasons?limit=300`.
- Jugador: `site.web.api.espn.com/apis/common/v3/sports/football/{slug}/athletes/{id}` y `…/stats`.
- Búsqueda de jugadores: `site.web.api.espn.com/apis/search/v2?query=…`.

### Ligas (`LEAGUES`)
`nfl` (slug `nfl`) · `fbs` (`college-football`, group 80) · `fcs` (`college-football`, group 81) · `ufl` · `cfl`. Al arrancar, `probeLeague()` pide el scoreboard de cada una: si falla o viene vacía, **la liga se oculta del menú** sin romper nada. El probe también da la temporada y semana actual y alimenta la cartelera.

### ⚠️ Trampa grande: CORS en `/teams/*`
ESPN **no permite** que el navegador lea `site.api.espn.com/.../teams/...` ni `site.web.api.espn.com/.../teams/...` (falla por CORS). Por eso las páginas de equipo usan una cadena de alternativas:
- **Info del equipo** (`teamInfo`): site → API core `…/seasons/{año}/teams/{id}` → lista de equipos.
- **Lista de equipos** (`teamsOf`): site `/teams` → si falla, se arma desde las posiciones.
- **Plantel** (`fetchRoster`): site roster → `?enable=roster` → **core** `…/teams/{id}/athletes` (resuelve cada `$ref` y el college).
- **Fixture** (`teamFixture`): site schedule (tipos 1, 2 y 3) → si falla, **`scheduleFromScoreboards`**: recorre los scoreboards semana por semana y filtra los partidos del equipo (también calcula la semana libre / BYE).
- **Estadísticas del equipo** (`teamStats`): site → core `…/types/2/teams/{id}/statistics`.
- **Jugador**: common/v3 → core athlete (sin tabla por temporada).
- `getSite(url)` reintenta en `site.web.api.espn.com` si `site.api` falla.

### Caché (`API.get`)
- Memoria + `sessionStorage` (prefijo `nfa1:`). TTL **30 s** si la respuesta tiene un partido en vivo o por empezar; **10 min** el resto; **6 h** para equipos, temporadas y atletas (`LONG_TTL`).
- Timeout de 15 s. Si falla la red y hay dato viejo, devuelve el viejo.
- Los errores son `ApiError(mensaje, status, url)`. `status 0` = red/CORS. `errorBox` muestra la URL que falló en letra chica (sirve para diagnosticar).

### Refrescos automáticos (`init()`)
- Cada **30 s** `route(true)` si la vista tiene partidos en vivo (`state.liveInView`), **salvo** que el usuario esté escribiendo en el foro o tenga abierto el panel de emojis.
- Cada **20 s** el **muro del foro** se refresca con `refreshForoBox()`: reemplaza solo el contenido del foro y solo si cambió (ver trampas).
- Cartelera: cada 30 s si hay algo en vivo; si no, cada 5 min.
- Notificaciones: cada 60 s y al volver a la pestaña.

---

## 7. Qué muestra cada vista

### Home (`VIEWS.day`)
- Selector de fecha: **◀ Ayer | HOY | Mañana ▶** + calendario (`input type=date`). Título con la fecha larga.
- Filtros: **Todos / En vivo / Finalizados / Próximos**, con contadores.
- **Bloques por liga en este orden fijo** (`LG_PRIORITY`): **NFL → NCAA FBS → NCAA FCS → UFL → CFL**. Cada bloque tiene un encabezado brillante (rojo si hay partidos en vivo), se puede colapsar (se recuerda en `localStorage` `nfa:collapsed`) y tiene el link "Liga ›".
- Si una liga no juega ese día, igual aparece en su lugar con el **encabezado gris**, "sin partidos este día" y su **próximo partido** (lo busca hasta 12 días adelante).
- Pide el rango día-anterior → día-siguiente y filtra por **el día en la zona horaria del navegador** (para que los partidos nocturnos caigan bien).
- **Fila de partido** (`gameRow`): estado u hora · visitante (nombre, logo, récord, ranking college, 🏈 si tiene la posesión) · marcador (o "@" si no empezó) · local · TV EE.UU. + **TV Argentina**. En vivo: "EN VIVO" rojo pulsando, cuarto y reloj, y abajo down & distance y "ZONA ROJA". Toda la fila es un link al partido.
- Abajo de todo: **Foro General** embebido.

### Liga (`VIEWS.league`)
- Encabezado ("hero") con el logo y un chip de temporada. Solapas: **Partidos | Posiciones | Estadísticas | Hoy**.
- Partidos: botones de tipo de temporada y "chips" de semana (del calendario de ESPN), con los partidos agrupados por día.
- Posiciones: por división o por conferencia (botones). Columnas W, L, T, PCT, PF, PA, DIFF, STRK (en college también CONF). Indicadores de clasificación (x/y/z/*/e).
- Estadísticas: top 10 por categoría (yardas por pase, carrera y recepción, TD, sacks, intercepciones, tackles…). El primero de cada categoría va destacado en dorado.

### Partido (`VIEWS.game`)
Cabecera con los colores de los dos equipos y **marcador estilo LED** (fuente Share Tech Mono, ámbar) → barra de situación si está en vivo → marcador por cuarto → líderes (pases, carreras, recepciones) → jugadas de anotación → estadísticas de equipo con barras comparativas → box score individual → "Info" (estadio, fecha, TV EE.UU., **TV Argentina**, asistencia, clima en °F y °C, línea de apuestas) → **Foro General** embebido.

### Equipo (`VIEWS.team`)
Hero con los colores del equipo, logo grande y marca de agua, chips de temporada, récord y posición ("1º en AFC West"). Solapas: **Plantel** (agrupado en ofensiva, defensiva y equipos especiales; número, posición, edad, altura y peso también en métrico, experiencia, college) · **Fixture / Resultados** (G/P/E coloreado, semana libre, TV EE.UU. y AR) · **Estadísticas** · **💬 Foro** (solo NFL).

### Jugador (`VIEWS.player`)
Hero con la foto, la camiseta y el equipo; ficha (posición, edad, nacimiento, altura, peso, college, draft, experiencia); resumen de la temporada; tablas por temporada con la fila de carrera.

### Barra lateral (`renderSidebar`)
- Sección **★ Ligas**: "★ Hoy · Todas" (activa solo en el Home), cada liga visible y "✉ Foro".
- Sección **{Liga} · Equipos**: botones Hoy, Partidos, Posiciones y Stats, y los equipos agrupados por conferencia y división (en college, conferencias colapsadas).
- Las dos secciones se pueden cerrar tocando el título (se recuerda en `localStorage` `nfa:sbClosed`).
- En el celular (≤900 px) la barra lateral es un menú deslizable que abre el ☰.

### Otros
- **Selector de temporada** global (`#seasonSel`): las temporadas salen de la API core. Cambiarlo lleva a la misma vista con esa temporada.
- **Buscador**: equipos de todas las ligas (de `teamsOf`) + jugadores (búsqueda de ESPN). Se maneja con teclado (flechas y Enter).
- **Cartelera** (`#ticker`): marcadores en scroll continuo (se pausa con el mouse encima). En FBS solo los partidos con equipos rankeados o en vivo; en FCS solo los en vivo.

---

## 8. Diseño visual (muy importante)

**Concepto:** la estructura y densidad de Promiedos (listas compactas, mucha info), vestida como una web deportiva yankee de 2003–2007: ESPN.com vieja, NFL.com de esa época, menús de Madden 2005, gráficos de Monday Night Football. Cargado y con personalidad, pero legible.

### Paleta (`:root`)
`--navy #0a1f44` (azul marino principal) · `--navy2 #13306b` · `--navy3 #1d4594` · `--red #c8102e` / `--red2 #e3263f` · `--gold #d4a017` / `--gold2 #f5cf4a` · `--silver #c7ccd4` · `--hover #fff3c4` (amarillo suave al pasar el mouse) · `--win #0b7a2a` · `--loss #b3001b`. El fondo de la página es azul muy oscuro con estrellitas (gradientes radiales).

### Tipografías
- `--f-head` **Oswald** (títulos: en mayúsculas, *itálica*, peso 600–700).
- `--f-num` **Teko** (números de marcadores y estadísticas).
- `--f-var` **Graduate** (estilo universitario/varsity: el texto "NFLARG" del logo).
- `--f-led` **Share Tech Mono** (marcador LED del detalle de partido).
- `--f-body` **Verdana/Arial** (tablas y texto chico, como en esa época).

### Componentes y clases clave
- **`.ph`**: encabezado de panel brillante (degradé azul con reflejo blanco arriba, borde biselado, franja roja a la izquierda). `.ph.red` = versión roja (en vivo). `.ph.sm` = chico.
- **`.box`**: caja blanca debajo de un `.ph`.
- **`.btn`**: botón "plástico cromado" (degradé plateado, itálica, mayúsculas). `.btn.on` = rojo brillante (activo).
- **`.tab` / `.tabs`**: solapas con forma de pestaña; la activa es roja. En el foro (`.ftabs`) la activa es azul.
- **`.hero`**: encabezado grande de liga, equipo o jugador, con el color del equipo en `--tc`.
- **`.star-sep`**: título de sección con franjas rojo/blanco/azul a los lados y ★ dorada.
- **`.stripes`**: franja diagonal roja/blanca/azul debajo del header (**al dueño le gusta, no la saques**).
- **`.live`**: badge "EN VIVO" rojo que pulsa.
- **`.g`**: fila de partido (grid). Ganador en negrita; perdedor en gris.
- **`.tbl`**: tablas con zebra, encabezado plateado con línea roja y hover amarillo.
- **`.led`**: marcador LED.
- **`.spin`**: spinner con una pelota de fútbol americano girando (SVG). `.sk` = skeleton con brillo.
- **`.av`**: avatar redondo (foto o inicial sobre un color propio del usuario). `.fteam` = chip con el logo de la franquicia del usuario.
- **`.fpost`**: mensaje del foro (columna izquierda con autor/avatar/equipo y columna derecha con el texto). **No uses la clase `.post`** (ver trampas).

### Header
- **Arriba de todo, la cartelera** `#ticker` (negra, con la etiqueta roja "★ SCORES").
- **Header con césped**: degradé verde con líneas de yarda (repeating-linear-gradient), oscurecido a la izquierda.
- **Escritorio:** logo (imagen) + "NFLARG" (Graduate: "NFL" cromado plateado y "ARG" rojo, inclinado) + "★ FÚTBOL AMERICANO EN VIVO ★" en dorado · a la derecha la búsqueda, el selector de temporada y la **campanita**. El contenido del header está **alineado con la columna central** (padding calculado para pantallas anchas).
- **Celular (≤900 px):** ☰ a la izquierda · **logo centrado** · 🔔 a la derecha; **abajo la búsqueda** y el selector de temporada. Con ≤440 px se oculta la frase de abajo del logo.
- **No hay barra de ligas horizontal debajo del header** (el dueño la pidió sacar: está en la barra lateral).
- Debajo del header va la franja `.stripes` (**sin** línea roja lisa).

### Logo e imágenes
- **Logo:** mapa de Argentina con el escudo estilo NFL (estrellas, pelota, letras rojas). Está **embebido como data URI** en el `<img class="brand-logo">` del header (68 px de alto; 48 px en el celular).
- **Favicons:** archivos en la raíz (`favicon.ico`, etc.). No uses data URI para el favicon: Safari lo ignora.
- **`og-image.jpg`:** logo + "NFLARG" + "El Promiedos de la NFL" + chips + `nflarg.com.ar`, sobre el césped. WhatsApp guarda las vistas previas en caché: para probar un cambio hay que compartir con algo al final (`?wpp`).

### Responsive
Funciona desde 360 px de ancho **sin scroll horizontal**. Las tablas anchas scrollean dentro de `.tw`. Puntos de corte: 1100, 900, 640, 440 y 380 px.

---

## 9. "Dónde verlo en Argentina" (`arInfo`)

ESPN solo informa la TV de EE.UU.; lo de Argentina es una **estimación por reglas** (siempre se muestra con "estimado" o un asterisco). En las filas se ve la versión corta (`AR · …`) y en el detalle la larga.

**NFL** (según el día y la hora **en horario del Este de EE.UU.**, función `etParts`):
| Caso | Corto | Largo |
|---|---|---|
| Pretemporada, jueves, viernes, o TV con Prime/Amazon/Netflix/YouTube | `Game Pass` | Solo NFL Game Pass (DAZN) |
| Playoffs, TV con ESPN/ABC, domingo desde las 19 h o antes de las 12 h (internacionales) | `ESPN + Game Pass` | Completo por ESPN / Disney+ · también en NFL Game Pass (DAZN) |
| Domingo de 12 a 19 h (franja CBS/FOX) | `RedZone + Game Pass` | En la RedZone de ESPN / Disney+ (no completo) · completo en NFL Game Pass (DAZN) |
| Resto (ej. sábado de NFL Network) | `Game Pass` | Solo NFL Game Pass |

**College / UFL:** `Disney+` si la TV de EE.UU. es ESPN/ABC/SEC Network/ACC Network; si no, nada. **CFL:** `CFL+`.

El dueño puede pedir ajustar estas reglas: cambiá solo `arInfo()`.

---

## 10. Foro (Supabase)

### Conexión
- En `index.html`: `FORO_CFG = {url: 'https://qdcimhqpgobtvcfvxnpj.supabase.co', key: 'sb_publishable_…'}`. **La clave es la "publishable" (pública): está bien que esté en el código.** Nunca pongas la `service_role` ni la `secret`.
- La librería `@supabase/supabase-js@2.49.4` se carga **bajo demanda** desde jsDelivr (`Foro.client()`).
- En el panel de Supabase, **Authentication → Email → "Confirm email" tiene que estar DESACTIVADO**.

### Cuentas (sin mail obligatorio)
- **Registro:** usuario (3–20, letras/números/guion bajo; único sin importar mayúsculas), contraseña (mínimo 6), **mail opcional** y **franquicia NFL favorita** (opcional).
- Supabase exige un mail: la cuenta se crea con un **mail interno** `{usuario en minúsculas}@foro-nflarg.com` (constante `FORO_MAIL`; **tiene que coincidir con el SQL**). El mail real, si lo cargan, se guarda aparte en la tabla privada `account_emails`.
- **Entrar:** un solo campo "Usuario o mail" + contraseña. La función `login_email(p_login)` devuelve el mail interno de la cuenta y con eso se hace `signInWithPassword`.
- **No hay recuperación de contraseña** (el dueño lo aceptó). La sesión se guarda en `localStorage` (`nfa-foro`).
- **Mi perfil:** cambiar la franquicia y **subir/cambiar/quitar la foto de perfil**.

### Estructura
- **Foros:** `general` (Foro General) y `nfl-{idEquipoESPN}` (uno por franquicia NFL). El SQL también acepta `game-{liga}-{id}`, pero **no se usa**: el dueño pidió que abajo de cada partido vaya el Foro General y que para un partido se abra un tema.
- **Cada foro tiene solapas:** **💬 Mensajes** (muro: mensajes sueltos, lo más nuevo arriba, se actualiza solo) · **📋 Temas** (hilos con título y respuestas) · **🏆 Rankings** (**solo en el Foro General**).
- **Dónde aparece el Foro General:** sección Foro del menú (`#/foro`), **abajo de los partidos en el Home** y **abajo de cada partido**. El de cada franquicia: pestaña "💬 Foro" de la página del equipo. Todos usan `forumBody(sb, fc, r, ctx)`, con `fc = {forum, base, name}`, donde `base` es el prefijo de las rutas del foro en esa página.

### Funciones del foro
- **Citar** ("❝ Citar"): inserta `[quote=usuario]texto[/quote]` en el textarea. `renderBody()` lo convierte en recuadro "usuario escribió:" (soporta anidados). Al citar se quitan las citas internas del mensaje original.
- **Emojis**: botón "😀 Emojis" que abre un panel (`EMOJIS`) e inserta en el cursor.
- **Sin imágenes**: los links se convierten en `<a>`, pero nunca se muestran imágenes de los mensajes.
- **👍 / 👎**: uno por persona y mensaje; tocar el mismo lo saca y tocar el otro lo cambia. Los contadores (`likes`, `dislikes`) los mantiene un trigger.
- **Antispam**: un mensaje cada 10 s por usuario (el trigger tira `too_fast` → "Esperá unos segundos…").
- **Notificaciones** (campanita del header): avisa cuando **te responden en un tema que abriste** o **te citan**. Un aviso por mensaje; nunca por tus propios mensajes. Globito rojo con la cantidad sin leer, también en el título de la pestaña ("(2) NFLARG…"). El panel muestra los últimos 20; tocar uno lo marca leído y te lleva al mensaje; "Marcar todo leído".
- **Rankings**: "Por equipo" (las 32 franquicias por cantidad de hinchas, con barras de colores) y "Por actividad" (hinchada más activa por mensajes escritos + top 10 de usuarios por mensajes y likes).
- **Foto de perfil**: se recorta cuadrada y se achica a 160×160 JPEG **en el navegador** (`squareJpeg`) y se sube a `avatars/{idUsuario}/avatar.jpg`. Si no hay foto, se ve la inicial sobre un color propio del usuario.

### Base de datos (`supabase/foro.sql`)
- **Tablas:** `profiles` (id, username, team_id, avatar_url) · `account_emails` (privada, sin acceso desde la página) · `threads` (forum, title, author, last_post_at, post_count) · `posts` (forum, thread_id **NULL = mensaje del muro**, author, body, likes, dislikes) · `reactions` (post_id, user_id, value ±1) · `notifications` (user_id, actor, post_id, thread_id, forum, kind `reply`/`quote`, read).
- **Triggers:** `on_auth_user_created` (crea el perfil y guarda el mail opcional) · `posts_before_insert` (hereda el foro del tema, pone contadores en 0, antispam) · `posts_bump_thread` (contador y última actividad del tema) · `posts_notify` (notificaciones) · `reactions_count` (recuenta likes/dislikes).
- **Funciones:** `create_thread(p_forum, p_title, p_body)` (tema + primer mensaje en una operación) · `login_email(p_login)` · `ranking_hinchas()` · `ranking_actividad()` · `ranking_usuarios(p_limit)`.
- **Permisos (RLS):** todos leen perfiles, temas, mensajes y reacciones; solo los registrados escriben, y siempre a su nombre. Nadie edita ni borra mensajes (todavía no hay moderación). Del perfil solo se pueden cambiar `team_id` y `avatar_url`, y `avatar_url` solo puede apuntar a la carpeta propia del almacenamiento. Las notificaciones las ve y marca solo su dueño.
- **Almacenamiento:** bucket público `avatars` (máx. 256 KB, jpg/png/webp); cada uno escribe solo en su carpeta. Va en un bloque `DO … exception`: si fallara, el resto del SQL igual se instala.
- **Migraciones incluidas** (por eso el script es largo): borra las tablas de la primera versión (categorías), convierte las cuentas viejas que tenían mail real al mail interno, y al final `notify pgrst, 'reload schema'` para que la API vea los cambios enseguida.
- **Para cambiar la base:** editá `supabase/foro.sql` manteniéndolo re-ejecutable (`create … if not exists`, `create or replace`, `drop policy if exists` + `create policy`, `add column if not exists`, constraints con `drop constraint if exists` antes de `add constraint`). Probalo dos veces seguidas sobre una base vacía y sobre la versión anterior. Después **pedile al dueño que lo corra entero** (GitHub → `supabase/foro.sql` → "Copy raw file" → Supabase → SQL Editor → borrar → pegar → Run).

### Consultas desde la página: ojo con los "embeds"
Entre `posts` y `profiles` hay **dos caminos** (el autor, y quién reaccionó vía `reactions`), así que PostgREST exige indicar la relación:
- `profiles!posts_author_fkey(username,team_id,avatar_url)` (constante `POST_SEL`)
- `profiles!threads_author_fkey(...)`
- `actor:profiles!notifications_actor_fkey(username,avatar_url)` y `threads!notifications_thread_id_fkey(title)`

Si escribís `profiles(username)` a secas, falla con *"more than one relationship was found"*.

---

## 11. Trampas ya resueltas (no las vuelvas a meter)

1. **CORS en `/teams/*` de ESPN** → cadena de alternativas (sección 6).
2. **No uses la clase `.post`**: los estados de partido generan clases como `st-post` y `tk-st post`, y un estilo `.post` rompía la cartelera. El foro usa `.fpost`.
3. **`[hidden]` vs `display`**: si un elemento tiene `display:flex` en el CSS, el atributo `hidden` no lo oculta. Agregá `X[hidden]{display:none}` (ya está para `.emo`, `.nbadge` y `.npanel`).
4. **El foro parpadeaba** porque el refresco redibujaba toda la vista (y en el Home pintaba primero sin el foro). Ahora: el muro usa `refreshForoBox()` (solo reemplaza `#foroBox` si cambió) y `VIEWS.day` en modo silencioso pinta una sola vez con el foro incluido. **No vuelvas a refrescar el foro con `route(true)`.**
5. **No refresques mientras el usuario escribe**: `typing()` revisa `#foText`; también se respeta el panel de emojis abierto.
6. **Embeds ambiguos de PostgREST** (sección 10).
7. **Favicon en data URI** no anda en Safari → archivos reales.
8. **GitHub agrega commits solo** (`CNAME`): `git fetch` + merge antes de push.
9. **Volver al foro después de entrar**: `App.foroBack()` guarda el hash actual; si el foro está embebido (Home o partido) agrega `/foro` para volver directo al foro.
10. **Mail interno**: si cambiás `FORO_MAIL`, también hay que cambiarlo en el SQL (`'%@foro-nflarg.com'`) y las cuentas existentes dejarían de poder entrar. **No lo cambies.**
11. **Logo de la CFL**: el scoreboard de ESPN no lo trae; se usa `LG_LOGO.cfl` (ruta de logos de ligas de ESPN). Si no carga, se ve un recuadro "CFL".

---

## 12. Cómo probar

- **No hay tests en CI.** Se prueba con **Playwright** (Chromium headless) interceptando las llamadas a ESPN y a Supabase con datos simulados (en algunos entornos no hay acceso a ESPN ni a Supabase).
- En `tests/`:
  - `mock-espn.js`: respuestas simuladas de ESPN con la forma real de la API.
  - `fake-supabase.js`: un Supabase falso en memoria (auth, tablas, triggers emulados, RPCs, storage) que se inyecta en lugar de la librería real.
  - `smoke.js`: recorre todas las rutas en escritorio y en celular y reporta errores de JavaScript y scroll horizontal.
  - `foro.js`: registro, muro, likes, temas, citas, notificaciones, rankings y perfil.
  - Se corren con `node tests/smoke.js` y `node tests/foro.js` (necesitan `playwright` instalado). Leé el encabezado de cada archivo.
- **Checklist antes de hacer commit:**
  1. Que el JS parsee: `node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"`.
  2. Correr `tests/smoke.js` y `tests/foro.js` sin errores.
  3. Mirar capturas en 1280 px y 360 px.
  4. Si tocaste el SQL: probarlo en un Postgres local dos veces seguidas.
  5. `git fetch` + merge, commit y push a `claude/nifty-hopper-jra203`.

---

## 13. Pendientes e ideas conversadas (NO hacer sin que el dueño lo pida)

- **"Gamecast" con cancha animada** (como el de X): cancha en perspectiva 3D con los colores de los equipos, la pelota moviéndose con animación, la línea amarilla de primer down, flechas por jugada del drive y carteles de TOUCHDOWN, FIELD GOAL, INTERCEPCIÓN, etc. Datos: `summary` → `situation` (yarda, posesión, down y distancia, zona roja, última jugada) y `drives` (jugadas con yarda de inicio y fin y tipo). Sin jugadores (ESPN no da tracking). Durante los partidos en vivo, refrescar cada 10–15 s. Lo delicado es la orientación de la cancha cuando cambia la posesión. Idea extra: mini cancha en las filas en vivo del Home. **El dueño dijo "todavía no".**
- **Moderación mínima del foro**: botón de borrar solo para el admin, bloquear usuarios, que cada uno borre lo suyo, botón de reportar, captcha (Cloudflare Turnstile) en el registro. Para el admin hace falta el nombre de usuario del dueño en el foro.
- **Publicidad** que no moleste: banner en la barra lateral, entre bloques del Home o en el footer (nunca pop-ups). Antes, revisar el tema marca "NFL" y las condiciones de uso de ESPN.
- **Riesgo legal conocido**: "NFL" en el nombre, el dominio y el logo es marca registrada. Para uso personal sin fines de lucro el riesgo es bajo; si se monetiza, conviene cambiar el nombre y el logo.

---

## 14. Preferencias del dueño (resumen)

- Estilo visual ESPN/NFL 2000s cargado, brillante y con personalidad. Le gustaron la franja rojo/blanco/azul y el header con césped.
- **Todo centrado** respecto a la columna de contenido, incluido el header.
- Home con **todas las ligas jerarquizadas** (NFL primero, después universitarias, UFL y la CFL al final) y el Foro General abajo.
- Nada de barra de ligas horizontal; la navegación va en la barra lateral, con secciones colapsables.
- Foro simple y sin censura, registro sin complicaciones (usuario y contraseña; mail opcional; se entra con usuario o mail).
- Prefiere que le expliquen las cosas en criollo y con pasos concretos (dónde tocar en cada panel).
- Siempre recordarle **cuándo tiene que volver a correr el SQL** y que recargue con Ctrl+Shift+R.
