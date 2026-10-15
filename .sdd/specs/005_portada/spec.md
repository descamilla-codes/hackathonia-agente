# Spec 005 — Portada y prueba con chats de ejemplo

- Autor: Diego Escamilla
- Fecha: 2026-10-15
- Estado: approved

## Contexto y objetivo
Quien abre la página (jueces, emprendedores) debe entender en segundos qué hace el agente y poder probarlo sin tener chats propios.

## Usuarios / actores
- Visitante (juez o emprendedor).

## Historias de usuario
- H1: Como visitante quiero entender qué hace el agente antes de subir nada.
- H2: Como visitante quiero probarlo con chats de ejemplo con un solo clic.

## Alcance
**Incluye:**
- Gancho, problema y 4 pasos de cómo funciona, arriba de la carga.
- Botones para cargar los chats de ejemplo "antes" y "después".

**No incluye (fuera de alcance):**
- Página aparte, precios, registro.

## Requisitos funcionales (criterios de aceptación en EARS)
- RF-1: EL SISTEMA muestra arriba de la carga el gancho "Tus clientes ya te dijeron cómo venderles más. Nadie los está escuchando."
- RF-2: EL SISTEMA muestra los 4 pasos: subes tus chats, el agente encuentra las dudas, tú decides, el agente aplica.
- RF-3: CUANDO el visitante presiona "Probar con chats de ejemplo", EL SISTEMA carga los chats de muestra como si los hubiera subido.
- RF-4: CUANDO el visitante presiona "Chats de una semana después", EL SISTEMA carga las muestras "después".
- RF-5: SI no se pueden cargar las muestras, ENTONCES EL SISTEMA muestra un aviso y deja la carga normal disponible.
- RF-6: CUANDO alguien abre la página sin un análisis guardado, EL SISTEMA muestra la portada con el nombre "Convierte", el gancho, una línea de qué hace, el equipo y el botón "Empezar".
- RF-7: CUANDO el visitante presiona "Empezar", EL SISTEMA muestra la carga de chats.

## Requisitos no funcionales
- Se lee completo en una pantalla de 1366×768 sin desplazarse hasta el botón de carga.

## Casos límite
- N/A

## Criterios de finalización
- Demo manual: un clic en "Probar con chats de ejemplo" deja listo "Analizar".

## Preguntas abiertas
