# Tareas: Spec 003

- Plan: .sdd/specs/003_antes_y_despues/plan.md
- Fecha: 2026-10-15

- [x] T1. Temas fijos en el esquema y etiquetas en español. (RF-1) Hecho cuando: el esquema solo acepta los 9 temas.
- [x] T2. Registro del último análisis real y comparación. (RF-2, RF-3, RF-7) Hecho cuando: "Nuevo análisis" no lo borra y el respaldo no lo toca.
- [x] T3. Antes en cada hoja y tabla en el Resumen. (RF-4, RF-5, RF-6) Hecho cuando: un tema que desaparece dice "no se repite".
- [x] T4. Muestras "después". Hecho cuando: son 9 chats válidos de la misma tienda.

## Tests
- [x] T5. Test de `snapshot`, `compare` y muestras "después". (RF-2, RF-5, RF-6) Hecho cuando: suite completa en verde.

## Validación manual
Las marca el usuario tras probar, no se marcan solas.
- [ ] T6. Con la llave de Claude, analizar `muestras/chats`, luego "Nuevo análisis" con `muestras/chats_despues`, y ver la tabla. (Todos) Hecho cuando: Diego confirma.
