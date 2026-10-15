# Backlog de sistemas

Estados: `falta`, `parcial`, `abierto` (hay una decisión pendiente). `[x]` = tiene spec done.

## P0: sin esto no hay demo (vie 16, 18:00)

- [x] **Tienda demo** (lista): https://uelequipo3.mitiendanube.com (20 prendas de ropa). No requiere spec.
- [ ] **Chats de ejemplo** (`parcial`): los hace el equipo; Diego los sube al repo. No requiere spec.
- [ ] **Subir chat** (`falta`): el dueño sube el .txt; se limpian nombres y teléfonos antes de analizar.
- [ ] **Análisis** (`falta`): el agente agrupa las dudas por tema y producto, con porcentaje y citas reales.
- [ ] **Hojas de decisión** (`parcial`, maqueta en `maqueta/index.html`): una hoja por problema con pestañas abajo, 3 soluciones seleccionables y resumen final.
- [ ] **Resultado guardado** (`falta`): si la IA falla, se muestra el análisis del chat de ejemplo ya guardado.
- [ ] **Aplicar cambio en la tienda** (`abierto`): desde el botón del resumen, con la API REST de Tiendanube (app de socio, scopes `write_products` y `write_coupons`). Se puede: editar descripción y crear cupones. No se puede: promociones. Falta confirmar que la app se instala en nuestra tienda.

## P1: suma puntos en la rúbrica

- [ ] **Medición antes/después** (`falta`): subir un segundo chat y mostrar si bajaron las dudas del tema corregido (simulado).
- [ ] **Landing** (`falta`): portada con el gancho, el problema y el botón para probar; mismo sitio que el panel.
- [ ] **Publicación** (`falta`): sitio en Vercel con la llave como variable de entorno.

## P2: solo si sobra tiempo

- [ ] **Reseñas y devoluciones** (`falta`): leer otras fuentes además de WhatsApp (fase 2 del pitch, puede quedar solo en diapositiva).
