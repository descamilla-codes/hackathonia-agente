# Spec 004 — Preguntarle al agente sobre un problema

- Autor: Diego Escamilla
- Fecha: 2026-10-15
- Estado: approved

## Contexto y objetivo
Antes de decidir, el dueño puede tener dudas ("¿por qué recomiendas esa?", "¿qué dijeron mis clientes?").
Un chat al lado de la hoja le ayuda a decidir sin salir del flujo. Es apoyo, no la estrella: no aplica cambios.

## Usuarios / actores
- Dueño de la tienda.

## Historias de usuario
- H1: Como dueño quiero preguntarle al agente sobre el problema que estoy viendo para decidir con más confianza.

## Alcance
**Incluye:**
- Panel de chat al lado de las hojas, con 3 preguntas rápidas y campo libre.
- Respuestas basadas solo en el problema que se está viendo.

**No incluye (fuera de alcance):**
- Que el chat aplique cambios o agregue soluciones.
- Guardar la conversación.
- Acceso a los chats originales de los clientes.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: MIENTRAS se ven las hojas, EL SISTEMA muestra el panel de chat al lado.
- RF-2: EL SISTEMA ofrece las preguntas rápidas "¿Por qué recomiendas esa?", "Dame otra opción" y "¿Qué dijeron mis clientes?".
- RF-3: CUANDO el dueño envía una pregunta, EL SISTEMA responde usando solo el título, la descripción, las frases y las soluciones del problema que se está viendo.
- RF-4: EL SISTEMA responde en máximo 3 oraciones.
- RF-5: SI la IA no responde en 20 segundos o falla, ENTONCES EL SISTEMA responde con los datos del problema (la razón de la solución recomendada o las frases de clientes) y no inventa nada.
- RF-6: EL SISTEMA muestra preguntas y respuestas como texto plano.
- RF-7: EL SISTEMA limita cada pregunta a 300 caracteres.

## Requisitos no funcionales
- La pregunta y el contexto que se envían a la IA no contienen nombres ni teléfonos (las frases ya están limpias).

## Casos límite
- Pregunta vacía: no se envía.
- En el Resumen, el chat responde sobre el conjunto de decisiones de forma general.

## Criterios de finalización
- Test de validación de entrada en verde.
- Demo manual de las 3 preguntas rápidas.

## Preguntas abiertas
