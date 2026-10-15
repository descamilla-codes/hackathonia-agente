# Backlog de sistemas

Estados: `falta`, `parcial`, `abierto` (hay una decisión pendiente). `[x]` = tiene spec done.

## P0: sin esto no hay demo (vie 16, 18:00)

- [x] **Tienda demo** (lista): https://uelequipo3.mitiendanube.com (20 prendas de ropa). No requiere spec.
- [ ] **Chats de ejemplo** (`parcial`): los hace el equipo; Diego los sube al repo. No requiere spec.
- [x] **Subir chat** (spec 001): el dueño sube el .txt; se limpian nombres y teléfonos antes de analizar.
- [x] **Análisis** (spec 001): el agente agrupa las dudas por tema y producto, con porcentaje y citas reales.
- [x] **Hojas de decisión** (spec 001): una hoja por problema con pestañas abajo, 3 soluciones seleccionables y resumen final.
- [x] **Resultado guardado** (spec 001): si la IA falla, se muestra el análisis del chat de ejemplo ya guardado.
- [x] **Aplicar cambio en la tienda** (spec 002): plan con vista previa, fila en Upstash y agente aplicador (Claude Code con el conector de Tiendanube).

## P1: suma puntos en la rúbrica

- [x] **Medición antes/después** (spec 003): subir un segundo chat y mostrar si bajaron las dudas del tema corregido (simulado).
- [x] **Landing** (spec 005): portada con el gancho, el problema y el botón para probar; mismo sitio que el panel.
- [x] **Publicación** (hecho): sitio en Vercel con la llave como variable de entorno.

- [x] **Chat con el agente** (spec 004)

## P2: solo si sobra tiempo

- [ ] **Reseñas y devoluciones** (`falta`): leer otras fuentes además de WhatsApp (fase 2 del pitch, puede quedar solo en diapositiva).
