# Tareas: Spec 001

- Plan: .sdd/specs/001_analisis_y_hojas/plan.md
- Fecha: 2026-10-15

## Lógica de chats
- [x] T1. Lector .zip y parseo de chats Android/iPhone con mensajes multilínea y avisos del sistema. (RF-2, RF-3, RF-4) Hecho cuando: los 13 chats de muestra se leen con remitente y texto.
- [x] T2. Tienda, limpieza de nombres y teléfonos, spam por reglas, duplicados, validez y límites. (RF-6, RF-6a, RF-6c, RF-6d, RF-7, RF-8, RF-9, RF-10) Hecho cuando: con las muestras la tienda es "Utel Equipo3", quedan 11 chats válidos y ningún nombre ni teléfono en el texto limpio.
- [x] T3. Verificación de problemas y conteos calculados en código. (RF-14 a RF-17, RF-18, RF-20a a RF-20c) Hecho cuando: un problema con frase inventada se quita y los porcentajes salen de los chats citados.

## Servidor y respaldo
- [x] T4. Función `api/analyze.js` con Claude, esquema JSON e instrucciones contra mensajes trampa. (RF-9a, RF-13, RF-18, RF-19, RF-22 a RF-26, RF-42, RF-44) Hecho cuando: responde 400 a entradas inválidas y 502 si la IA falla.
- [x] T5. `fallback.json` con el análisis de ejemplo de las muestras. (RF-39 a RF-41) Hecho cuando: pasa la verificación de T3.

## Página
- [x] T6. Carga: soltar/elegir archivos, descartados, aviso de limpieza, elegir tienda, botón Analizar y progreso. (RF-1, RF-5, RF-6b, RF-6d, RF-10, RF-12) Hecho cuando: con las muestras se habilita Analizar y se ve el aviso.
- [x] T7. Hojas, Aceptar, Omitir, pestañas y Resumen como en la maqueta, con texto plano. (RF-20, RF-21 a RF-36, RF-43) Hecho cuando: el flujo completo funciona con el respaldo.
- [x] T8. Conservar, Nuevo análisis, timeout de 45 s y aviso de respaldo. (RF-37 a RF-41) Hecho cuando: al recargar se conserva y sin llave se ve el aviso.

## Tests
- [x] T9. Test de lector .zip y parseo. (RF-2, RF-3, RF-4) Hecho cuando: suite completa en verde.
- [x] T10. Test de tienda, limpieza, spam, duplicados y límites. (RF-6, RF-6a, RF-6c, RF-6d, RF-7 a RF-10) Hecho cuando: suite completa en verde.
- [x] T11. Test de verificación, conteos y respaldo. (RF-14 a RF-20c, RF-39) Hecho cuando: suite completa en verde.

## Validación manual
Las marca el usuario tras probar, no se marcan solas.
- [ ] T12. Subir los 13 chats en la página publicada, ver el aviso de limpieza, recorrer las hojas, aceptar, omitir y revisar el Resumen. (Todos) Hecho cuando: Diego confirma que se ve y funciona.
- [ ] T13. Con la llave configurada en Vercel, correr un análisis real y ver que no aparece el aviso de respaldo. (RF-39 a RF-41) Hecho cuando: Diego confirma el análisis real.
