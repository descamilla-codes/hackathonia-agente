# Spec 006 — Aplicar sin la laptop del equipo

- Autor: Diego Escamilla
- Fecha: 2026-10-15
- Estado: approved

## Contexto y objetivo
En la spec 002 los cambios los aplica Claude Code en la laptop del equipo. Si la laptop está apagada, el dueño se queda esperando.
Aquí el servidor aplica el plan en cuanto el dueño confirma, usando el conector oficial de IA de Tiendanube.

## Usuarios / actores
- Dueño de la tienda.
- Equipo: autoriza la tienda una sola vez.

## Alcance
**Incluye:**
- Autorización única de la tienda del equipo desde la laptop.
- Aplicación inmediata del plan al confirmar.
- Respaldo: si la tienda no está conectada, el plan queda pendiente para el agente de la laptop (spec 002).

**No incluye (fuera de alcance):**
- Botón "Conectar con Tiendanube" para otros dueños: el conector solo acepta autorizaciones que regresan a la propia computadora.
- Varias tiendas.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: CUANDO el equipo corre la autorización, EL SISTEMA abre Tiendanube y guarda el permiso de la tienda sin mostrarlo.
- RF-2: EL SISTEMA pide solo permisos de leer y editar productos y cupones.
- RF-3: CUANDO el permiso está por vencer, EL SISTEMA lo renueva solo.
- RF-4: CUANDO el dueño confirma un plan y la tienda está conectada, EL SISTEMA aplica el plan sin esperar al agente de la laptop.
- RF-5: MIENTRAS el servidor aplica un plan, EL agente de la laptop no lo toma.
- RF-6: SI la tienda no está conectada o la aplicación falla, ENTONCES EL SISTEMA deja el plan pendiente para el agente de la laptop.
- RF-7: SI ya se aplicaron 10 planes en la última hora, ENTONCES EL SISTEMA deja los siguientes pendientes.
- RF-8: EL SISTEMA aplica las mismas reglas de la spec 002 (RF-12, RF-13, casos límite).

## Requisitos no funcionales
- El permiso de la tienda nunca aparece en la página, el chat, los logs ni el repositorio.
- Idioma: español de México.

## Casos límite
- El permiso deja de servir (la tienda quitó el acceso): el plan queda pendiente y el equipo vuelve a autorizar.

## Criterios de finalización
- Tests de aplicación y de la fila en verde.
- Demo manual: confirmar un plan en la página publicada con la laptop apagada y ver el cambio en la tienda.

## Preguntas abiertas
