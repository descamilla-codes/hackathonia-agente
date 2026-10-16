# Spec 003 — Medir el antes y el después

- Autor: Diego Escamilla
- Fecha: 2026-10-15
- Estado: approved

## Contexto y objetivo
Después de aplicar cambios, el dueño necesita saber si funcionaron: si bajaron las dudas sobre ese tema.
Comparar un análisis nuevo con el anterior lo demuestra con números (criterio 5 de la rúbrica: validación del beneficio).

## Usuarios / actores
- Dueño de la tienda.

## Historias de usuario
- H1: Como dueño quiero comparar mis chats nuevos con los anteriores para saber si los cambios redujeron las dudas.

## Alcance
**Incluye:**
- Temas con nombres fijos para poder compararlos entre análisis.
- Guardar en el navegador el resultado del último análisis real (temas y porcentajes, sin chats).
- Mostrar en cada hoja y en el Resumen el antes y el después por tema.
- Chats de muestra "después" para la demo.

**No incluye (fuera de alcance):**
- Historial de más de un análisis anterior.
- Relacionar la baja de dudas con ventas.
- Comparar análisis de respaldo.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: EL SISTEMA clasifica cada problema en uno de estos temas: tallas, envío, pagos, confianza, devoluciones, precio, disponibilidad, calidad u otro.
- RF-2: CUANDO termina un análisis real, EL SISTEMA guarda la fecha, el número de chats y el porcentaje de cada tema, en el navegador y en el servidor.
- RF-2a: EL SISTEMA identifica la tienda en el servidor con una huella de una sola vía de su nombre, sin guardar el nombre, texto de chats, frases ni datos de clientes.
- RF-2b: EL SISTEMA guarda los últimos 10 análisis de cada tienda por 90 días.
- RF-2c: EL SISTEMA cuenta cada tema que preguntó al menos un cliente, aunque no llegue a 3 chats, para medir si una duda bajó.
- RF-3: EL SISTEMA no borra ese registro con "Nuevo análisis".
- RF-4: CUANDO termina un análisis real y existe un registro anterior, EL SISTEMA muestra en cada hoja el porcentaje anterior del mismo tema y su fecha.
- RF-5: EL SISTEMA muestra en el Resumen una tabla con cada tema del análisis anterior o del actual, su porcentaje antes y ahora.
- RF-6: SI un tema del análisis anterior no aparece en el actual, ENTONCES EL SISTEMA lo muestra como "ya no se repite".
- RF-7: SI el análisis mostrado es el de respaldo, ENTONCES EL SISTEMA no compara ni guarda registro.

## Requisitos no funcionales
- El registro no contiene texto de chats, frases ni datos de clientes.

## Casos límite
- Primer análisis: no hay comparación.
- Un tema nuevo que antes no existía: aparece como "nuevo".

## Criterios de finalización
- Tests de la comparación en verde.
- Demo manual: analizar las muestras "antes", luego las "después", y ver la tabla.

## Preguntas abiertas
