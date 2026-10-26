# Servicio Granjero y Adelanto a Tu Punto

## Objetivo

Incorporar un tipo de usuario `granjero` que pueda registrar, desde carrito, entregas inmediatas y pedidos para retiro con productos de vendedores que un administrador le haya autorizado. Todas sus operaciones deben cobrar obligatoriamente un adelanto a Tu Punto. El adelanto se registra como un cobro independiente y conciliable en cierre de caja.

El servicio también añade reglas empresariales globales de descuento por rango de precio y un saldo acumulado para cada granjero, liquidable únicamente por administradores.

## Compatibilidad

No cambia el comportamiento de los roles, pedidos, pagos, cierres de caja ni saldos de vendedores existentes. Los documentos históricos sin los nuevos campos se interpretan como si no pertenecieran al nuevo servicio. Los cierres emitidos no se recalculan ni se reescriben.

## Adelanto a Tu Punto

### Datos y estados

Se agrega el estado de pago de pedido `adelanto_tu_punto`, distinto de `adelanto` existente. Un pedido con este estado conserva:

- total del pedido;
- monto adelantado, mayor que cero y no superior al total;
- subtotal de adelanto en efectivo y QR, cuya suma debe ser el monto adelantado;
- saldo de cobro pendiente, calculado como `total - monto adelantado`.

El método del adelanto puede ser efectivo, QR o mixto. En mixto, los subtotales positivo de efectivo y QR deben sumar exactamente el adelanto. El cobro posterior al retirar el pedido usa el flujo y los métodos de pago existentes, restringido al saldo pendiente.

### Registro contable y cierre

Cada adelanto genera un registro financiero identificable e idempotente, enlazado al pedido, sucursal, usuario que lo registró, fecha y subtotales de efectivo/QR. No se mezcla con el cobro de la entrega ni con los adelantos previos.

El cierre de caja expone el total de adelantos a Tu Punto como rubro propio, separado de ventas en efectivo, QR y correctivas, con su desglose de efectivo y QR. El importe se incorpora al efectivo o QR esperado del día según corresponda, pues constituye dinero realmente recibido por Tu Punto; permanece visible también como subtotal independiente para conciliación.

Al cancelar un pedido antes de su entrega, el adelanto se revierte. Si no hay cierre histórico emitido que lo contenga, el registro se elimina y los totales diarios se actualizan. Si ya existe un cierre emitido, se crea una reversión/ajuste trazable en vez de modificar el cierre pasado.

## Rol granjero

### Usuario y permisos

`granjero` es un nuevo rol de usuario y requiere una sucursal asignada, igual que los usuarios operativos. Cada granjero mantiene una lista individual de vendedores autorizados, gestionada por administradores.

El granjero solo puede acceder a:

- carrito, limitado a productos de sus vendedores autorizados y su sucursal;
- su propio perfil, con entregas/pedidos registrados, saldo y pagos.

No puede acceder a cierres, configuración empresarial, gestión de usuarios, vistas de ventas generales, otros perfiles ni recursos de otros granjeros. Las restricciones se aplican en rutas y API; ocultar acciones en el frontend no es suficiente.

Administradores pueden ver el perfil de cualquier granjero, su historial y sus liquidaciones. Operarios y administradores conservan sus flujos actuales, con la nueva opción de adelanto disponible cuando corresponda.

### Carrito y operaciones

El backend filtra los productos para un granjero por su sucursal y vendedores autorizados. Un granjero puede crear una entrega inmediata o un pedido para retiro posterior desde carrito. En ambos casos:

- solo se permite `adelanto_tu_punto`;
- debe registrar monto y método del adelanto;
- no se muestran ni aceptan `si`, `no`, `adelanto` ni otros estados de pago;
- se valida que cada línea tenga una regla empresarial aplicable antes de persistirla.

Las validaciones de autorización, sucursal, monto y reglas se ejecutan de nuevo en servidor para impedir solicitudes manipuladas.

## Reglas empresariales de descuento

Gestión empresarial contiene una tabla global, editable por administradores, con:

| Campo | Regla |
| --- | --- |
| Límite inferior | Precio unitario mínimo, inclusivo. |
| Límite superior | Precio unitario máximo, inclusivo. |
| Monto descontado | Descuento adicional aplicado a la utilidad del vendedor. |
| Monto para Tu Punto | Parte del descuento que corresponde a la empresa. |

La tabla puede filtrarse para consultarla y administrarla; su contenido es único para todos los granjeros. No se permiten rangos ambiguos/solapados ni límites inválidos. Para una línea creada por un granjero, se selecciona la única regla cuyo rango contiene el precio unitario. Si no existe regla, la operación se bloquea con una explicación clara.

Cada venta guarda una instantánea de la regla aplicada, para que cambios posteriores no alteren liquidaciones históricas.

## Efecto económico y liquidaciones

Por cada línea de cantidad `q` registrada por un granjero con regla aplicable:

- a la utilidad calculada normalmente del vendedor se suma un descuento adicional de `monto_descuentado * q`;
- el saldo pendiente del granjero aumenta en `(monto_descuentado - monto_para_tu_punto) * q`;
- `monto_para_tu_punto * q` queda registrado como importe de la empresa asociado a esa entrega.

El perfil del granjero muestra las entregas/pedidos que él registró, las reglas e importes aplicados y el saldo acumulado. El administrador es el único que puede aprobar/registrar una liquidación. La liquidación crea un comprobante y una entrada en pagos pendientes con monto, fecha, administrador y entregas incluidas; esas líneas ya no se vuelven a acumular. El granjero solo puede consultar esta información.

## Arquitectura y límites

El backend extiende los modelos y servicios actuales de pedido, venta, usuario, cierre de caja y pagos de vendedor mediante componentes específicos para adelantos a Tu Punto, reglas de granjero y liquidaciones de granjero. Las nuevas reglas no deben modificar los cálculos de los vendedores cuando la operación no fue registrada por un granjero.

El frontend amplía los tipos/API y reutiliza los patrones visuales actuales de selección de pago, carrito, perfil, pagos pendientes y gestión empresarial. El menú y las rutas se construyen desde permisos explícitos del rol.

No requiere cambios iniciales en `tp-catalog`, porque el nuevo servicio opera sobre el carrito y API internos. Se revisará la integración si alguna ruta compartida expone productos a un granjero.

## Errores y auditoría

- Una solicitud de granjero con vendedor no autorizado, otra sucursal, tipo de pago no permitido, adelanto inválido o regla inexistente se rechaza sin efectos parciales.
- Los registros de adelanto, reversión, regla aplicada y liquidación deben conservar referencias cruzadas para evitar duplicados y permitir auditoría.
- Las operaciones de cancelación y liquidación son idempotentes.
- El sistema muestra mensajes específicos para regla inexistente, autorización denegada y saldo de pago inválido.

## Verificación

1. Un admin crea un granjero con sucursal y vendedores autorizados; el granjero solo ve sus productos en carrito y su perfil.
2. El granjero intenta crear una operación sin regla de precio y el servidor la rechaza.
3. Con una regla válida, registra un pedido con adelanto efectivo, QR y mixto; el adelanto queda separado y el saldo de retiro es correcto.
4. El cierre del día muestra el adelanto en su rubro propio y también en el método recibido, sin duplicar la venta final.
5. Al cancelar antes de un cierre, desaparece el adelanto; después de un cierre, se registra un ajuste trazable sin cambiar el documento cerrado.
6. Una operación de granjero reduce la utilidad del vendedor por el monto descontado y aumenta el saldo del granjero por la fórmula acordada.
7. Un admin registra una liquidación; aparece en pagos pendientes, no duplica el saldo y el granjero puede consultarla sin aprobarla.
8. Las operaciones creadas por admin u operario y los pedidos/saldos históricos conservan exactamente sus cálculos y permisos actuales.
