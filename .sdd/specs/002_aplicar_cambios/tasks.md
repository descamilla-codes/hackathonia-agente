# Tareas: Spec 002

- Plan: .sdd/specs/002_aplicar_cambios/plan.md
- Fecha: 2026-10-15

## Servidor
- [x] T1. Reglas de planes: tipos permitidos, límites y descripción en español. (RF-4, RF-14) Hecho cuando: un tipo no permitido se rechaza.
- [x] T2. `api/plan.js`: plan concreto con Claude y esquema JSON. (RF-3, RF-9) Hecho cuando: responde 400 a entradas inválidas y 502 si la IA falla.
- [x] T3. `api/queue.js`: crear, consultar, listar pendientes y marcar aplicado en Upstash. (RF-6, RF-10, RF-15, RF-18) Hecho cuando: sin Upstash responde 503.

## Página y agente
- [x] T4. Resumen con "Para hacer tú", botón Aplicar, vista previa, confirmar y cancelar. (RF-1, RF-2, RF-5, RF-7) Hecho cuando: la vista previa muestra el texto exacto.
- [x] T5. Planes de ejemplo para el análisis de respaldo. (RF-8) Hecho cuando: los 5 planes pasan la validación.
- [x] T6. Espera con consulta cada 3 s, aviso a los 2 min, resultado y copia manual. (RF-10, RF-16, RF-17, RF-18) Hecho cuando: sin fila se ofrece "Copiar plan".
- [x] T7. `AGENTE.md` con el procedimiento del agente aplicador. (RF-11 a RF-15) Hecho cuando: describe vigilar, aplicar y marcar.

## Tests
- [x] T8. Test de reglas de planes y normalización. (RF-4, RF-5, RF-14) Hecho cuando: suite completa en verde.
- [x] T9. Test de la fila con Redis simulado. (RF-6, RF-10, RF-15, RF-18) Hecho cuando: suite completa en verde.

## Validación manual
Las marca el usuario tras probar, no se marcan solas.
- [ ] T10. Con Upstash conectado y el agente aplicador corriendo, aprobar un plan en la página publicada y ver el cambio en la tienda Utel Equipo3 y el "Aplicado ✓". (Todos) Hecho cuando: Diego confirma.
