# Identidad y código de guía de paqueterías

## Objetivo

Mejorar el formulario de alta y edición de paqueterías para que el código de
guía sea comprensible, no pueda repetirse y la identidad visual se configure
sin URL ni códigos de color manuales.

## Código de guía

- El código seguirá siendo un entero desde `2`.
- Bajo el campo se mostrará un ejemplo vivo con el formato `AB-00000-N`.
- El prefijo y cuerpo del ejemplo serán neutros; el sufijo `-N` se destacará
  con el color principal actualmente seleccionado.
- Al abandonar el campo y antes de guardar, el formulario comprobará si el
  código ya está asignado a otra paquetería. Al editar se excluirá el registro
  que se está modificando.
- El backend conservará la restricción única y rechazará el duplicado aunque
  se intente guardar desde otra sesión o cliente.

## Logo

- Se sustituye el campo de URL por un cargador de un solo archivo.
- Se aceptan PNG, JPG/JPEG y WebP de hasta 5 MB.
- Se mostrará una previsualización cuadrada y se podrá reemplazar el archivo
  antes de guardar.
- El archivo se enviará a una ruta protegida específica de paqueterías, que lo
  almacenará en AWS S3 y actualizará `logo_url` con su URL pública.
- Si la carga falla, se mostrará el error y la operación de guardado no se
  considerará terminada.

## Colores

- Los campos de texto se sustituyen por `ColorPicker` visual para color
  principal y secundario.
- El formulario usará azul y blanco como valores iniciales para una
  paquetería nueva.
- El color principal se refleja de inmediato en el ejemplo de guía y en el
  marco de la previsualización del logo.

## Seguridad y verificación

- Solo los administradores ya autorizados para administrar paqueterías podrán
  consultar disponibilidad de códigos y subir logos.
- El backend validará tipo MIME/extensión y límite de 5 MB antes de S3.
- Se verificará: código disponible, código repetido, edición sin falso
  positivo, archivo válido, archivo inválido/sobredimensionado, persistencia
  de la URL y conservación de las rutas y pedidos existentes.
