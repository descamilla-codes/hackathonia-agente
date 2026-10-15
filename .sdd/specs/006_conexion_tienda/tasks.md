# Tareas: Spec 006

- Plan: .sdd/specs/006_conexion_tienda/plan.md
- Fecha: 2026-10-15

- [x] T1. Cliente MCP y aplicación del plan. (RF-4, RF-8) Hecho cuando: tests de `applyPlan` en verde.
- [x] T2. Aplicación inmediata en la fila, con cupo y respaldo. (RF-5, RF-6, RF-7) Hecho cuando: tests de la fila en verde.
- [x] T3. Script de autorización única. (RF-1, RF-2, RF-3) Hecho cuando: guarda el permiso sin imprimirlo.

## Validación manual
Las marca el usuario tras probar, no se marcan solas.
- [ ] T4. Correr `node scripts/conectar-tienda.mjs` y autorizar. (RF-1) Hecho cuando: la terminal dice "tienda conectada".
- [ ] T5. Confirmar un plan en la página publicada con Claude Code cerrado. (RF-4) Hecho cuando: Diego ve el cambio en la tienda.
