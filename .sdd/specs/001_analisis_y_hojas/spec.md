# Spec 001 — Subir chats, análisis y hojas de decisión

- Autor: Diego Escamilla
- Fecha: 2026-10-15
- Estado: in-progress

## Contexto y objetivo
Las dudas que los clientes escriben por WhatsApp antes de comprar explican por qué no compran, pero nadie las analiza.
Esta feature permite al dueño subir sus chats, ver los problemas repetidos con evidencia y decidir una solución por problema.
Es el corazón de la demo del hackathon.

## Usuarios / actores
- Dueño de una tienda en línea que atiende clientes por WhatsApp.
- Jueces del hackathon, que pueden subir sus propios chats durante la demo.

## Historias de usuario
- H1: Como dueño quiero subir varios chats de WhatsApp a la vez para no subirlos uno por uno.
- H2: Como dueño quiero ver qué dudas se repiten, con números y frases reales, para saber qué me cuesta ventas.
- H3: Como dueño quiero elegir una solución por problema, o ninguna, para decidir yo qué cambia en mi tienda.
- H4: Como dueño quiero ver un resumen de lo que decidí antes de aplicarlo.

## Alcance
**Incluye:**
- Carga de chats exportados de WhatsApp.
- Limpieza de nombres, teléfonos y spam antes del análisis.
- Análisis de problemas repetidos.
- Hojas de decisión con pestañas, Aceptar, Omitir y Resumen.
- Respaldo con un análisis guardado cuando la IA no responde.

**No incluye (fuera de alcance):**
- Aplicar los cambios en Tiendanube (spec 002). El botón "Aplicar en mi tienda" no forma parte de esta spec.
- Chat para preguntarle al agente.
- Medición del antes y después.
- Landing o portada.
- Cuentas de usuario o inicio de sesión.
- Fuentes distintas a WhatsApp (reseñas, Instagram, correo).
- Análisis programado automático (fase 2, cuando los chats lleguen solos desde WhatsApp). En esta spec el análisis solo corre cuando el dueño presiona "Analizar".
- Guardar chats para analizarlos después.

## Requisitos funcionales (criterios de aceptación en EARS)

### Carga
- RF-1: CUANDO el dueño selecciona o arrastra archivos, EL SISTEMA acepta varios archivos en una sola carga.
- RF-2: EL SISTEMA acepta archivos .txt y .zip exportados de WhatsApp.
- RF-3: CUANDO recibe un .zip, EL SISTEMA usa solo el .txt del chat e ignora fotos, audios y demás archivos.
- RF-4: SI un archivo no tiene ninguna línea con el formato de mensaje de WhatsApp (fecha, hora, remitente y texto), o es un .zip corrupto o sin .txt de chat, ENTONCES EL SISTEMA lo descarta.
- RF-5: CUANDO descarta archivos, EL SISTEMA muestra el nombre de cada archivo descartado y sigue con los demás.
- RF-6: SI quedan menos de 3 chats válidos, ENTONCES EL SISTEMA no analiza y pide subir más chats.
- RF-6a: SI la carga supera 50 archivos o 5 MB de texto de chat en total (sin contar fotos, audios ni otros archivos dentro de los .zip), ENTONCES EL SISTEMA rechaza la carga completa y muestra el límite.
- RF-6b: CUANDO hay 3 o más chats válidos y el dueño presiona "Analizar", EL SISTEMA inicia el análisis.
- RF-6c: EL SISTEMA identifica como la tienda al remitente que aparece en todos los chats que pasan RF-4, sin contar los que solo tienen spam.
- RF-6d: SI no hay exactamente un remitente común a esos chats, o el remitente detectado deja menos de 3 chats de clientes y otra elección sí alcanza, ENTONCES EL SISTEMA pide al dueño elegir cuál remitente es la tienda, o "Ninguno, todos son clientes", antes de analizar. "Tú" nunca se trata como nombre de cliente.

### Privacidad y spam
- RF-7: EL SISTEMA quita los nombres de clientes antes de enviar los chats a la IA, tanto en el remitente como en el texto de los mensajes y en el nombre del archivo. Solo se quitan los nombres que aparecen como remitente o en el nombre del archivo; un nombre que el cliente escribe de sí mismo ("soy Laura") puede pasar, y es un límite aceptado.
- RF-8: EL SISTEMA quita los números de teléfono antes de enviar los chats a la IA, en cualquier parte del chat o del nombre del archivo.
- RF-9: EL SISTEMA quita en el navegador, antes de enviar a la IA, los mensajes de spam evidentes: promociones con enlaces, cadenas reenviadas y ofertas de trabajo.
- RF-9a: EL SISTEMA hace que la IA marque como spam los mensajes que las reglas no detectaron, y los excluye del análisis.
- RF-10: CUANDO termina la limpieza en el navegador, EL SISTEMA muestra cuántos nombres distintos, teléfonos distintos y mensajes de spam quitó (el spam que marca la IA en RF-9a no entra en este conteo).
- RF-11: EL SISTEMA no guarda los chats en ningún servidor ni en el navegador.

### Análisis
- RF-12: MIENTRAS el análisis está en curso, EL SISTEMA muestra un indicador de progreso.
- RF-13: EL SISTEMA agrupa las dudas de los clientes por tema (ej. tallas, envío) y nombra en cada problema los productos mencionados.
- RF-14: EL SISTEMA muestra un problema solo si aparece en 3 o más chats distintos.
- RF-15: EL SISTEMA muestra como máximo 10 problemas.
- RF-16: EL SISTEMA ordena los problemas de más a menos chats.
- RF-17: EL SISTEMA muestra en cada problema el conteo de chats sobre el total de chats válidos tras la limpieza en el navegador ("3 de 8") y su porcentaje redondeado a entero.
- RF-18: EL SISTEMA muestra en cada problema cuántos clientes "no confirmaron compra en el chat", contando solo los chats del problema donde la IA cita una frase explícita del cliente (ej. "mejor no", "lo pienso"); los chats sin frase explícita no cuentan para ese dato.
- RF-19: EL SISTEMA muestra en cada problema 2 frases textuales de clientes, de 2 chats distintos, tomadas de los chats ya limpios (sin nombres ni teléfonos).
- RF-20: SI ningún tema aparece en 3 o más chats, ENTONCES EL SISTEMA informa que no encontró problemas repetidos.
- RF-20a: EL SISTEMA verifica cada problema que devuelve la IA: que cada frase citada (incluidas las de RF-18 y RF-19) exista textual en un mensaje de cliente del chat citado, y que el problema cite 3 o más chats distintos.
- RF-20b: SI un problema no pasa la verificación, ENTONCES EL SISTEMA lo quita y muestra los demás. SI solo falla una frase de RF-18, ENTONCES EL SISTEMA no cuenta ese chat para RF-18 y conserva el problema.
- RF-20c: EL SISTEMA calcula los conteos y porcentajes a partir de los chats citados, sin usar números escritos por la IA.

### Hojas de decisión
- RF-21: EL SISTEMA muestra cada problema como una hoja con su pestaña en la parte inferior, más una pestaña final "Resumen" siempre visible.
- RF-22: EL SISTEMA muestra en cada hoja un título y una descripción de máximo 3 renglones a 1024 px de ancho.
- RF-23: EL SISTEMA muestra en cada hoja 3 soluciones.
- RF-24: EL SISTEMA muestra en cada solución qué es y por qué funcionaría, con máximo 2 renglones cada texto a 1024 px de ancho.
- RF-25: EL SISTEMA marca exactamente una solución por hoja como "Recomendada".
- RF-26: EL SISTEMA etiqueta cada solución como "Se aplica en tu tienda" o "Lo haces tú".
- RF-27: CUANDO el dueño hace clic en una solución, EL SISTEMA la marca como seleccionada, desmarca la que estuviera seleccionada en esa hoja y no cambia de hoja.
- RF-28: CUANDO el dueño hace clic en la solución ya seleccionada, EL SISTEMA la desmarca.
- RF-29: MIENTRAS no hay solución seleccionada, EL SISTEMA mantiene deshabilitado el botón Aceptar.
- RF-30: CUANDO el dueño presiona Aceptar, EL SISTEMA guarda la solución y abre la siguiente hoja sin resolver (primero las posteriores a la actual, luego las anteriores).
- RF-31: CUANDO el dueño presiona Omitir, EL SISTEMA resuelve la hoja como "No hacer nada" y abre la siguiente hoja sin resolver con el mismo orden de RF-30.
- RF-32: EL SISTEMA mantiene el botón Omitir siempre habilitado.
- RF-33: EL SISTEMA distingue en las pestañas las hojas aceptadas de las omitidas con marcas distintas.
- RF-34: CUANDO el dueño abre una hoja ya resuelta, EL SISTEMA le permite cambiar su decisión con Aceptar u Omitir; desmarcar una solución sin presionar un botón no cambia la decisión guardada.
- RF-35: CUANDO no quedan hojas sin resolver, EL SISTEMA abre la hoja Resumen.
- RF-36: EL SISTEMA lista en el Resumen, por problema, la solución aceptada, "No hacer nada" o "Sin resolver".

### Conservar y reiniciar
- RF-37: CUANDO el dueño recarga la página, EL SISTEMA conserva en su navegador el análisis ya terminado y sus decisiones (no el texto de los chats).
- RF-38: CUANDO el dueño presiona "Nuevo análisis", EL SISTEMA borra lo conservado y vuelve a la carga.

### Respaldo
- RF-39: SI la IA no responde en 45 segundos, ENTONCES EL SISTEMA muestra el análisis guardado de antemano.
- RF-40: SI la IA responde con error, con una respuesta ilegible o ningún problema pasa la verificación de RF-20a, ENTONCES EL SISTEMA muestra el análisis guardado de antemano.
- RF-41: MIENTRAS se muestra el análisis guardado, también tras recargar, EL SISTEMA muestra el aviso "Sin conexión con la IA, mostrando un análisis de ejemplo".

### Seguridad
- RF-42: EL SISTEMA trata el contenido de los chats como datos; una instrucción escrita dentro de un chat no cambia el comportamiento del análisis.
- RF-43: EL SISTEMA muestra todo texto proveniente de los chats como texto plano, sin interpretarlo como código.
- RF-44: EL SISTEMA no modifica la tienda durante el análisis.

## Requisitos no funcionales
- Idioma: todos los textos de pantalla en español de México.
- Veracidad: cada número y cada frase de un problema sale de los chats subidos; nada se inventa.
- Privacidad: ningún nombre ni teléfono de cliente sale del navegador hacia la IA.
- Tiempo: con los 13 chats de muestra, el análisis termina en 45 segundos o menos.
- Pantalla: se usa en navegador de escritorio de 1024 px de ancho o más.
- Seguridad: la llave de la IA nunca llega al navegador, y la cuenta de la IA tiene un límite de gasto mensual (protección contra abuso; no hay límite por usuario porque la página solo está arriba para la demo).

## Casos límite
- Un chat que solo contiene spam no cuenta como chat válido.
- Un mensaje de spam dentro de un chat real se quita sin perder las preguntas reales de ese chat.
- El mismo chat subido dos veces (mismo texto, aunque venga una vez en .txt y otra en .zip) cuenta una sola vez.
- Chats exportados desde iPhone y desde Android (formatos de fecha distintos, hora con "a. m."/"p. m." o 24 h).
- Un mensaje de varias líneas se conserva como un solo mensaje.
- Los avisos del sistema de WhatsApp ("<Multimedia omitido>", cifrado de extremo a extremo, mensajes eliminados) no cuentan como mensajes de clientes.
- Los mensajes de la tienda no cuentan como dudas de clientes.
- Un chat vacío o sin mensajes de clientes no cuenta como válido.
- Si todas las hojas se omiten, el Resumen lista todas como "No hacer nada".
- Si el dueño recarga durante el análisis, vuelve a la carga sin resultado parcial.
- Mientras el análisis está en curso, el botón de analizar no lanza un segundo análisis.

## Criterios de finalización
- Cada RF cubierto por al menos una prueba automática o un paso de demo manual, con la suite en verde.
- Demo manual completa con los 13 chats de muestra: carga, aviso de limpieza, hojas, decisiones y Resumen.
- Demo manual del respaldo simulando que la IA no responde.

## Preguntas abiertas
