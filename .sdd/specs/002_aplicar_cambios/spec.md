# Spec 002 — Aplicar los cambios aprobados en la tienda

- Autor: Diego Escamilla
- Fecha: 2026-10-15
- Estado: approved

## Contexto y objetivo
Después de decidir en las hojas, el dueño necesita que los cambios lleguen a su tienda sin hacerlos a mano.
El agente prepara los cambios exactos, el dueño los revisa y aprueba, y el agente los aplica en Tiendanube.
Es el paso que convierte el análisis en acción ("comprende, ayuda a decidir y genera acción").

## Usuarios / actores
- Dueño de la tienda.
- Agente aplicador: en el prototipo, Claude Code en la computadora del equipo, conectado al conector oficial de IA de Tiendanube. En producción, un agente hospedado (fuera de alcance).

## Historias de usuario
- H1: Como dueño quiero ver exactamente qué va a cambiar en mi tienda antes de aprobarlo.
- H2: Como dueño quiero que, al aprobar, los cambios se apliquen solos y ver cuándo quedaron.

## Alcance
**Incluye:**
- Botón "Aplicar en mi tienda" en el Resumen.
- Plan de cambios concretos generado por el agente, con vista previa.
- Fila de planes aprobados en el servidor.
- Agente aplicador que toma los planes pendientes y los aplica.
- Estado "Aplicado" en la página.

**No incluye (fuera de alcance):**
- Deshacer cambios ya aplicados.
- Aplicar soluciones marcadas "Lo haces tú".
- Agente aplicador hospedado en la nube (fase 2).
- Cuentas de usuario: la página atiende una sola tienda, la del equipo.

## Requisitos funcionales (criterios de aceptación en EARS)

### Plan y vista previa
- RF-1: MIENTRAS no haya al menos una solución aceptada con "Se aplica en tu tienda", EL SISTEMA mantiene deshabilitado "Aplicar en mi tienda".
- RF-2: EL SISTEMA lista en el Resumen las soluciones "Lo haces tú" como pendientes del dueño, sin aplicarlas.
- RF-3: CUANDO el dueño presiona "Aplicar en mi tienda", EL SISTEMA genera un plan con los cambios concretos de cada solución aceptada "Se aplica en tu tienda".
- RF-4: EL SISTEMA solo incluye en un plan tres tipos de cambio: agregar texto a la descripción de productos, crear un cupón y activar envío gratis en productos.
- RF-5: EL SISTEMA muestra la vista previa del plan con el texto exacto que se agrega, los productos afectados y los datos de cada cupón.
- RF-6: CUANDO el dueño presiona "Confirmar y aplicar", EL SISTEMA guarda el plan como pendiente en la fila.
- RF-7: CUANDO el dueño presiona "Cancelar", EL SISTEMA regresa al Resumen sin guardar nada.
- RF-8: SI el análisis mostrado es el de ejemplo, ENTONCES EL SISTEMA usa un plan de ejemplo guardado en lugar de generarlo con la IA.
- RF-9: SI la IA no logra generar el plan, ENTONCES EL SISTEMA muestra un aviso y permite reintentar.

### Aplicación
- RF-10: MIENTRAS haya un plan pendiente, EL SISTEMA muestra "Esperando al agente" y consulta su estado cada 3 segundos.
- RF-11: EL agente aplicador toma cada plan pendiente y aplica sus cambios en la tienda con el conector de Tiendanube.
- RF-12: EL agente aplicador agrega el texto al final de la descripción existente, sin borrar lo que ya había.
- RF-13: SI la descripción de un producto ya contiene el texto, ENTONCES EL agente aplicador no lo vuelve a agregar.
- RF-14: EL agente aplicador rechaza cualquier cambio fuera de los tres tipos de RF-4.
- RF-15: CUANDO termina, EL agente aplicador marca el plan como aplicado con el resultado de cada cambio.
- RF-16: CUANDO el plan queda aplicado, EL SISTEMA muestra "Aplicado ✓" y el resultado de cada cambio.
- RF-17: SI pasan 2 minutos sin que el plan se aplique, ENTONCES EL SISTEMA avisa que el plan quedó guardado y que el agente lo aplicará al conectarse.
- RF-18: SI la fila no está disponible, ENTONCES EL SISTEMA muestra el plan para copiarlo y aplicarlo manualmente con el agente.

## Requisitos no funcionales
- Un plan no contiene nombres, teléfonos ni frases de clientes.
- El texto agregado a una descripción tiene máximo 400 caracteres por cambio.
- Un plan tiene máximo 10 cambios y máximo 25 productos por cambio.
- Un cupón de monto fijo es de máximo $500; uno de porcentaje, de máximo 50%.
- El texto publicado no lleva enlaces, correos, números largos, HTML ni huecos para completar.
- Como la fila es pública, el agente aplicador pide el "sí" del equipo antes de aplicar cada plan y solo usa las herramientas de editar descripción, envío gratis y crear cupón.
- Idioma: español de México.

## Casos límite
- Una solución sin productos mencionados se aplica a todos los productos de la tienda.
- Un producto mencionado que no existe en la tienda se reporta como "no encontrado" sin detener los demás cambios.
- Un código de cupón que ya existe se reporta como error de ese cambio.
- El dueño recarga mientras espera: la página retoma la espera del mismo plan.

## Criterios de finalización
- Tests de validación de planes y de la fila en verde.
- Demo manual: aprobar un plan en la página publicada y ver el cambio aplicado en la tienda del equipo.

## Preguntas abiertas
