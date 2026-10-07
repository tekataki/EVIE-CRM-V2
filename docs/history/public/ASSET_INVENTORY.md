# Inventario de assets · avance Neural / RC

## Incremento del Prompt FINAL
- `requirements-rc.md`: copia textual del archivo del usuario, origen https://www.genspark.ai/api/files/s/meJ8xSFg. No es código ejecutado.
- No se añadieron imágenes generadas ni nuevas librerías CDN. Agenda, medidores de Bitácora/Nutrición y calendarios usan HTML/CSS nativo y Lucide existente.
- Las imágenes de despensa usan el MediaStore ya existente y referencias `media_id`; pertenecen al respaldo personal, no al ZIP del código.
- `review-rc-open.js` contiene escenarios artificiales identificados como QA, limitados al namespace `dali-os-qa-rc-visual-*`. No son registros del propietario ni datos sembrados en la aplicación normal.
- Capturas actuales con URLs verificadas en `RC_REPORT.md`. La matriz completa continúa pendiente.
- Las 16 referencias alimentarias del 16/09/2026 se conservan como datos documentales inactivos en `farm-upgrade.js`; no equivalen a fotografías nuevas, compras, raciones ni recomendaciones médicas.

## Recursos conservados

| Recurso | Origen | Uso y almacenamiento |
|---|---|---|
| `images/dali-logo.jpg` | Logo adjuntado por el usuario | JPEG local de 4.123 bytes, sidebar. No recreado por IA. |
| Silueta porcina | SVG original escrito en `neural-farm.js` | Hero y fallback de tarjetas. No copia de logos o interfaz ajena. |
| Núcleo de Inicio | CSS/SVG/Canvas original, `neural-home*` y `neural-core.js` | Decoración, no telemetría ni indicador de estado clínico. |
| Gráfico de demanda | SVG construido desde valores de `Feed.forecast` | Incluye tabla equivalente; sin datos ficticios en producción. |
| `reference/feed-board-wide.jpg` | Fotografía MAFORNU aportada en la etapa v3 | Referencia documental, no inventario ni precio activado automáticamente. |
| Lucide 0.468.0 | jsDelivr, paquete Lucide | Iconografía; licencia del paquete. |
| Manrope / DM Sans | Google Fonts | Tipografía web; fallback sans-serif. |
| Fotos de perfil, animales, libros, Vision y drops | Archivos elegidos por el usuario dentro del CRM | MediaStore/IndexedDB. No se incorporan al ZIP de código; sí al respaldo ZIP de datos. |

Logo original: https://gensparkpublicblob.blob.core.windows.net/user-upload-image/v1/707da652-646c-412f-93bd-ffa264f7e885

Documento v4: https://www.genspark.ai/api/files/s/DQym6rdU — conservado como `requirements-v4.md`.

Vídeo de referencia GranjaControl: https://www.genspark.ai/api/files/s/bUh7OGiq — analizado como referencia visual, no embebido ni copiado como código. No se dispone del proyecto completo con `src/`.

No se usó generación de imágenes con créditos, base64 ni imágenes de terceros sin relación con el proyecto. Las fotos ALVENTO adjuntadas todavía no están integradas como campaña editable nueva; esa parte sigue pendiente. No hay URLs temporales de esas fotos hardcodeadas en el hero.
