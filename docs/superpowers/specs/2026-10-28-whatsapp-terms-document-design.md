# Documento T&C en mensajes de entrega

## Objetivo

Permitir que un superadmin actualice desde Tu Punto el PDF de términos y condiciones de paquetería. El mensaje de WhatsApp debe ofrecerlo como botón sin que actualizar el documento obligue a modificar o aprobar de nuevo las plantillas.

## Interfaz

En la pantalla de Envíos se mostrará un botón secundario y discreto con la etiqueta `T&C`, junto al control actual de Escalonamiento. Solo los superadmins podrán verlo o abrirlo.

El botón abrirá un modal de términos y condiciones de paquetería con:

- un enlace para abrir el documento vigente;
- un selector para cargar un único archivo PDF;
- una acción `Actualizar documento`.

Los demás roles no tendrán el control y el servidor rechazará igualmente cualquier intento de actualización que no provenga de un superadmin.

## Almacenamiento y enlace estable

El documento se guardará en S3 con una clave fija: `public/terminos-paqueteria.pdf`.

Cada actualización validará el archivo como PDF y sobrescribirá esa misma clave. Si la subida falla, el objeto previo se conserva. La URL pública estable será:

`https://tu-punto-files.s3.us-east-2.amazonaws.com/public/terminos-paqueteria.pdf`

La plantilla de Meta usará dicha URL como botón estático `Ver Términos y Condiciones`. El contenido del PDF es actualizable aunque la URL no cambie.

## Mensajes de WhatsApp

Para compradores, la ubicación pasa al cuerpo del mensaje antes de los horarios:

`Ubicación: {{8}}`

El primer botón se reserva para términos y condiciones; el segundo conserva el seguimiento del pedido. La plantilla de comprador que aplica multas incluye los importes de recojo en `{{6}}` y `{{7}}` y el texto de siete días.

Las entregas simples no mostrarán el texto ni las variables de multa. El servicio seleccionará una plantilla de comprador sin multa para simples y otra con multa para externas que correspondan al nuevo régimen. Ambas recibirán la ubicación y el botón de términos. La plantilla de vendedor también incluirá el botón de términos.

Meta debe aprobar las plantillas actualizadas antes de habilitar el envío en producción.

## API y validación

Se incorporarán endpoints autenticados para obtener el documento actual y para reemplazarlo. El de reemplazo aceptará un único PDF, limitará el tamaño conforme al middleware de archivos existente y requerirá el rol `superadmin`.

El envío de WhatsApp usará la URL estable del documento, moverá la URL de Maps al parámetro de cuerpo correspondiente y conservará el botón de tracking como segundo botón para compradores.

## Verificación

- Un superadmin puede abrir el modal, subir un PDF y abrir el documento actualizado.
- Otro rol no ve el botón y recibe autorización denegada al invocar el endpoint.
- Si falla una carga, el PDF previo sigue disponible.
- Los payloads de comprador externo incluyen ubicación, términos, tracking, importe y multa.
- Los payloads de entrega simple no incluyen aviso ni variables de multa.
- Los payloads de vendedor incluyen el botón de términos.
- El backend compila con TypeScript.
