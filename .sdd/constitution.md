# Constitution — Convierte (HackathonIA)

- Versión: 1.1
- Última actualización: 2026-10-15
- Idioma: inglés en código; español en textos de pantalla, mensajes y documentación

Principios innegociables. Toda spec, plan y tarea debe cumplirlos.

1. **Demo primero**: todo se diseña para que el pitch de 5 min funcione. Lo que no se ve en la demo, no se construye.
2. **Mínimo de piezas**: HTML y JS sin framework, funciones serverless en Vercel solo las necesarias, y una base de datos clave-valor solo para la fila de cambios por aplicar.
3. **Nunca falla en vivo**: si la IA o Tiendanube no responden, se muestra un resultado guardado.
4. **La IA justifica cada número**: cada hallazgo cita mensajes reales del chat. No se inventan cifras.
5. **El dueño decide**: el agente propone; un cambio en la tienda solo se aplica después de que el dueño lo aprueba.
6. **Sin datos personales**: se quitan nombres y teléfonos del chat antes de mandarlo a la IA, y no se guardan chats. Lo único que se guarda son los cambios aprobados para la tienda, que no llevan datos de clientes.
7. **Secretos fuera del repo**: la llave de la API solo vive en las variables de entorno de Vercel.
