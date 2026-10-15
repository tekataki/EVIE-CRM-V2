# EVIE · Mapa de Ciudad Guzmán (P2)

## Proveedor elegido: Stadia Maps (datos OpenStreetMap)
| Necesidad | Servicio | Endpoint | Quién lo llama |
|---|---|---|---|
| Mapa base (teselas vectoriales) | Stadia Maps, estilos `alidade_smooth` / `alidade_smooth_dark` | `https://tiles.stadiamaps.com/styles/*.json` | Navegador (MapLibre), **autenticación por dominio** (sin clave en el front) |
| Búsqueda de destinos | Stadia Geocoding (Pelias) | `GET https://api.stadiamaps.com/geocoding/v1/search` | Worker (`/api/map/search`) con `Authorization: Stadia-Auth <STADIA_API_KEY>` |
| Ruta + maniobras en español | Stadia Routing (Valhalla) | `POST https://api.stadiamaps.com/route/v1` | Worker (`/api/map/route`) |
| Visor | MapLibre GL JS 4.7.1, incluido en `public/vendor/maplibre/` (BSD-3, `public/vendor/MAPLIBRE-LICENSE.txt`) | — | Navegador, se carga solo al abrir el Mapa |

**Por qué Stadia:** usa datos de OpenStreetMap con licencia clara para uso en producción, ofrece en una sola cuenta las teselas, la geocodificación y el ruteo Valhalla (maniobras y texto de voz en `es-ES`), el plan gratuito no pide tarjeta y el consumo extra viene **desactivado por defecto** (al pasarte del límite recibes errores en lugar de un cargo). **No se usa `tile.openstreetmap.org`**: su política de uso prohíbe tráfico de aplicaciones de producción como esta.

**Alternativas revisadas:**
- MapTiler + OpenRouteService: requiere dos cuentas, y el plan gratuito de ORS no es comercial.
- Mapbox: no es OSM puro, su licencia obliga a usar su SDK y la atribución es más restrictiva.
- Google Maps: sus términos prohíben mezclar sus rutas con otros mapas.
- Servidor Valhalla/OSRM propio: no cabe en Cloudflare Workers.

## Arquitectura
```
Navegador ── MapLibre ── teselas Stadia (auth por dominio)
   │
   └─ EvieMap (public/evie-map.js) ── EvieMapCore (public/evie-map-core.js, lógica pura y probada)
          │  /api/map/config | /search | /route  (sesión EVIE obligatoria)
          ▼
   Worker Hono (src/map.js) ── STADIA_API_KEY (secreto) ── api.stadiamaps.com
          └─ contador diario por cuenta en D1 (ai_usage: map_search / map_route). No se guarda ninguna coordenada.
```
- **Geocerca:** el polígono de Zapotlán el Grande vive en `EvieMapCore.AREA`; el servidor aplica además una caja (bbox). Destino u origen fuera de esa zona → `outside_area` / `origin_outside_area` (HTTP 422) y la sugerencia de usar una app de navegación.
- **Sin clave:** todas las rutas responden 503 `not_configured` con la lista de lo que falta. La interfaz lo muestra tal cual y **nunca dibuja una ruta simulada**.
- **Errores del proveedor:**

  | Código | Causa |
  |---|---|
  | `provider_auth` | clave inválida |
  | `provider_rate` | HTTP 429 |
  | `provider_timeout` | sin respuesta a tiempo |
  | `provider_error` | otro fallo del proveedor |
  | `no_route` | el proveedor no encontró ruta |
  | `quota` | se alcanzó el límite diario de EVIE |

  Cada código tiene su propio mensaje en pantalla.

## Navegación (solo en primer plano)
1. **Ubicación con permiso explícito:** el navegador solo la pide al tocar «Mi ubicación» o «Iniciar navegación». Si se niega o no hay GPS, se elige el origen tocando el mapa.
2. **Posición en vivo:** `watchPosition` funciona solo mientras dura la sesión. «Detener», «termina la navegación», salir de la cuenta o llegar al destino ejecutan `clearWatch`.
3. **Calidad del GPS:**
   - Precisión mayor de 50 m o lectura de hace más de 15 s: Ivi dice que la señal es débil y **no da instrucciones**.
   - Entre 25 y 50 m: muestra «señal débil».
4. **Desvío:** cuenta cuando la posición queda a más de 35 m de la línea (más la precisión) durante 3 lecturas seguidas. Entonces se recalcula con antirrebote de 20 s y un máximo de 6 recálculos cada 10 min. Cada recálculo es una llamada facturable.
5. **Avisos y voz:**
   - Umbrales de aviso según la velocidad (p. ej. 500/200/50 m en auto); cada aviso suena una sola vez.
   - Llegada: a 25 m o menos del destino.
   - La voz no habla mientras el micrófono escucha y EVIE no abre el micrófono mientras habla, así que Ivi no se transcribe a sí misma.
   - Silenciar/activar voz y Repetir.
6. **ETA honesta:** distancia y tiempo vienen del proveedor; el tiempo restante es el tiempo del proveedor × la fracción de ruta que falta. La etiqueta dice «sin tráfico en vivo». «Posición en vivo» (tu GPS) se presenta como algo distinto de «tráfico en vivo».
7. **Segundo plano:** el navegador pausa el GPS y la voz cuando EVIE no está visible. EVIE lo avisa (estado `background`) y ofrece «Abrir en una app de navegación» (Google Maps con el destino).
8. **Sin conexión:** la ruta actual sigue en pantalla, pero no se recalcula (estado `offline`).

## Voz (intents locales, sin IA)
| Comando | Acción |
|---|---|
| «Ivi, abre el mapa» | abre la sección |
| «calcula la ruta al Tecnológico» / «cómo llego a…» / «llévame a…» | busca; si hay varios resultados pide elegir; calcula con el origen actual |
| «¿cuánto falta?» | distancia y tiempo restantes (o aviso de GPS débil) |
| «recalcula» | nueva ruta desde la posición actual |
| «silencia» / «activa la voz» / «repite» | controla la guía hablada |
| «termina la navegación» / «inicia la navegación» | detiene o inicia la guía |

Variantes de activación: Ivi / Ivy / Evie / Evi / Ibi. El modelo también puede usar la herramienta `map_action`, y existe la tarjeta del HUD «Mapa · Ciudad Guzmán».

## Cuotas, atribución y costos (revisado 2026-10-15; confirma en https://stadiamaps.com/pricing/)
- **Créditos Stadia:**

  | Uso | Créditos |
  |---|---|
  | Tesela vectorial | 1 |
  | Búsqueda (geocodificación) | 20 |
  | Ruta estándar | 20 |

- **Facturable en EVIE:** cada búsqueda, cada cálculo de ruta, **cada recálculo** y las teselas que se ven al mover o hacer zoom en el mapa.
- **Planes:**

  | Plan | Precio | Créditos/mes | Notas |
  |---|---|---|---|
  | Free | 0 US$ | 200 000 | **no comercial**, sin consumo extra |
  | Starter | 20 US$/mes | 1 M | uso comercial |
  | Standard | 80 US$/mes | 7,5 M | necesario para `auto_traffic` (con atribución TomTom) y para guardar resultados de geocodificación de forma permanente |

- **Estimación para 2 personas** (10 búsquedas, 10 rutas y unas 300 teselas al día): unos 21 000 créditos/mes, dentro del plan gratuito *si el uso es personal y no comercial*. Si EVIE se usa para un negocio (SOMA, clientes), contrata Starter.
- **Límites propios por cuenta y día:** `EVIE_MAP_LIMITS` (por defecto `{"map_search":200,"map_route":120}`).
- **Atribución obligatoria**, siempre visible: «© Stadia Maps © OpenMapTiles © OpenStreetMap contributors». Aparece en el control de MapLibre y en el panel.
- **Tráfico en vivo:** `EVIE_MAP_TRAFFIC=on` solo con el plan Standard o superior. Hay que añadir la atribución de TomTom antes de activarlo.

## Privacidad
- No se guarda historial de ubicaciones: ni en D1, ni en Supabase, ni en localStorage/sessionStorage (el E2E lo comprueba).
- El destino y la ruta viven solo en memoria de la pestaña y se borran al salir de la cuenta (`EvieMap.reset`).
- El servidor no registra coordenadas; solo incrementa un contador diario por cuenta.

## Límites honestos
- Funciona solo en primer plano; no navega con la pantalla bloqueada ni en segundo plano (limitación de PWA y navegador).
- En PC de escritorio sin GPS la ubicación del navegador puede ser aproximada (Wi-Fi/IP), con 100 m o más de error. Usa el origen manual.
- No se ha probado conduciendo en un dispositivo real: los recorridos son simulados en las pruebas. Es un prototipo: **no lo uses como única guía al manejar**.
- Sin carriles, radares, límites de velocidad ni tráfico en vivo (el plan gratuito no los incluye).
