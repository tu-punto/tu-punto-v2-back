# Paqueterías externas

## Objetivo

Permitir que empresas de paquetería externas utilicen el flujo de entregas de Tu Punto sin acceder a la operación interna. Cada empresa podrá crear, consultar, editar y anular sus propios paquetes en estado `En Espera`; Tu Punto conserva la impresión de etiquetas, los mensajes de WhatsApp y los cambios operativos de estado.

No forma parte del alcance `tp-catalog`.

## Modelo y administración

Se incorporará una entidad `Paquetería`, distinta de una sucursal. Una paquetería puede participar como punto de origen o destino elegible en las rutas, pero no tiene inventario, caja, trabajadores, alquileres ni permisos propios de una sucursal.

La gestión interna estará a cargo de administradores de Tu Punto e incluirá:

- nombre comercial, estado activo, logo y paleta de colores;
- código numérico de guía, único y asignado desde `2`;
- tarifa fija por paquete;
- intervalo en días y monto de multa;
- usuarios vinculados y rutas habilitadas.

Habrá un único rol `paqueteria`. No existirán subroles de paquetería ni capacidad de modificar tarifa, multas, rutas, identidad visual o usuarios desde su portal.

## Aislamiento y portal

El portal estará disponible bajo el dominio actual, por ejemplo `paqueteria.tupunto.bo`. Tras autenticarse, el usuario recibe la identidad visual de la paquetería a la que pertenece. No se expondrán datos de una paquetería antes de autenticar.

Un usuario de rol `paqueteria` podrá:

- crear paquetes para su propia empresa;
- consultar su historial y detalle, con filtros por estado y fecha;
- editar o anular únicamente los paquetes de su empresa que continúen en estado `En Espera`;
- indicar en cada paquete si paga la paquetería, el comprador o ambos.

El backend impondrá la pertenencia a la paquetería en todos los endpoints. El rol no podrá leer ni mutar datos de otra empresa, usar rutas no habilitadas, imprimir etiquetas, ni invocar vistas previas o envíos de WhatsApp, incluso mediante llamadas directas a la API.

## Pedido, importes y multas

Al crear un paquete, el servidor obtiene la tarifa fija y la regla de multa de la paquetería. El cliente no puede proporcionar ni alterar esos valores.

Cada pedido persistirá un snapshot de la tarifa, intervalo y monto de multa. Cambiar una configuración futura no modifica los pedidos ya registrados.

La multa no empieza al crear el paquete. Inicia cuando operaciones lo cambia a `Listo para recoger`; a partir de ese momento, cada X días se acumula Bs. Y sobre el saldo del comprador. La acumulación termina al recoger, entregar o anular el pedido. El portal muestra importe base, responsable de pago, estado y multa acumulada, sin permitir editar los valores calculados.

Al salir de `En Espera`, el paquete deja de ser editable o anulable para la paquetería. Operaciones de Tu Punto conserva sus flujos actuales de impresión, WhatsApp y transición de estados.

## Guías

Se mantiene el contador global de guías y su expansión existente de letras: `AA` hasta `ZZ`, después `AAA`, `AAB`, y así sucesivamente. No se reservan prefijos de letras para paqueterías.

El último segmento de la guía será el código numérico de la empresa propietaria:

- Los pedidos internos existentes conservan `-0` y `-1` sin modificaciones.
- Las paqueterías usan códigos desde `-2`, por ejemplo `AA-01234-2` y `AA-01235-3`.

En pedidos de paquetería, ese segmento identifica la empresa; la ruta se conserva en los campos estructurados de origen y destino. La generación deberá validar que el código de la paquetería sea único y que la guía completa siga siendo única.

## Interfaz

Tu Punto tendrá una pantalla de administración de paqueterías para configurar empresa, branding, tarifa, multa, usuarios y rutas. El portal de paquetería tendrá una acción principal para crear paquetes y una vista de historial/detalle. No incluirá controles de impresión, configuración de impresora, etiquetas QR, WhatsApp ni acciones operativas internas.

## Errores y verificación

Se rechazarán configuraciones de tarifa o multa inválidas, rutas no habilitadas, códigos de paquetería duplicados, intentos de modificar importes protegidos y edición/anulación de paquetes ya procesados.

La implementación verificará como mínimo:

1. Aislamiento completo de datos entre dos paqueterías.
2. Cálculo de tarifa y snapshot al crear paquetes.
3. Inicio, acumulación periódica y detención de multas.
4. Bloqueo efectivo de impresión y WhatsApp para el rol `paqueteria`.
5. Edición y anulación solamente en estado `En Espera` y por su propia empresa.
6. Generación de guías con sufijos `-2`, `-3` y compatibilidad de guías internas `-0`/`-1`.
7. Compilación y pruebas pertinentes de backend y frontend.
