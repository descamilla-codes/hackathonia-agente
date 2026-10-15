# Plan — Spec 005: portada y chats de ejemplo

- Spec relacionado: .sdd/specs/005_portada/spec.md
- Fecha: 2026-10-15
- Estado: approved

## Arquitectura / enfoque
- Gancho y 4 pasos dentro de la tarjeta de carga en `index.html`.
- `muestras/index.json` lista los archivos; `app.js` los descarga y los pasa por la misma carga que un archivo real.

## Constitution aplicable
- 1: un clic deja lista la demo.

## Módulos / componentes
- `index.html` → RF-1, RF-2. `app.js` (`loadExamples`) → RF-3, RF-4, RF-5.

## Modelo de datos
- `muestras/index.json`: `{ antes: [archivos], despues: [archivos] }`.

## Archivos afectados
- Crear: `muestras/index.json`. Modificar: `index.html`, `app.js`. Eliminar: N/A.

## Decisiones técnicas clave
- Portada en la misma página. — Descartado: página aparte; un clic más en la demo.

## Preguntas abiertas

## Riesgos
- Si se agregan muestras, hay que regenerar `index.json`.

## Estrategia de testing
- Demo manual.

## Fuera de alcance técnico
- N/A
