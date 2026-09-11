# Pago inicial del vendedor en pedidos simples

## Objetivo

Cuando se creen pedidos simples, registrar el importe `amortizacion_vendedor` como un ingreso si es mayor a cero y el usuario eligio efectivo o QR. El mismo pago debe verse en Flujos financieros y en Historial de ventas, pero el cierre de caja debe contabilizarlo una sola vez.

## Alcance

- Solo aplica a paquetes con `service_origin: "simple_package"` al pulsar **Crear pedidos**.
- No cambia pedidos externos.
- No cambia el cobro al comprador ni el selector de efectivo/QR al marcar un pedido como entregado.
- El importe a registrar es `amortizacion_vendedor`; el importe cobrado al entregar sigue siendo `deuda_comprador`.

## Flujo

1. El usuario elige Efectivo o QR en el metodo general y crea los pedidos simples.
2. Para cada paquete con `amortizacion_vendedor > 0`, el backend guarda una marca de pago inicial con fecha, metodo e identificador de trazabilidad.
3. El backend registra el ingreso financiero asociado en la sucursal de origen. El flujo es visible en el listado general de Flujos financieros.
4. Historial de ventas proyecta una fila por paquete, con la fecha de creacion, importe y metodo: `Pago vendedor efectivo` o `Pago vendedor QR`.
5. La respuesta de historial expone, ademas de sus totales visuales, totales para cierre que excluyen exclusivamente esas filas proyectadas. El cierre suma esos totales para cierre y los ingresos de servicio; por ello toma el flujo financiero una vez.
6. Al marcar el pedido como entregado, los subtotales del pedido conservan su uso actual: registran solo el cobro de `deuda_comprador`.

## Trazabilidad e idempotencia

Cada paquete simple debe conservar una clave de origen unica para su pago inicial y la referencia al flujo financiero creado. Si una solicitud se reintenta o se vuelve a ejecutar, no se crea un segundo flujo ni una segunda proyeccion de historial.

Los flujos de pago inicial de simples se identifican por esa clave, no por el texto del concepto. Esto permite distinguirlos de otros ingresos de servicio y limitar la exclusion del cierre al nuevo flujo.

## Compatibilidad

- Los paquetes antiguos sin la nueva referencia no generan filas retroactivas ni movimientos nuevos.
- Los subtotales existentes de pedidos simples y externos no se recalculan.
- Los totales visuales de Historial de ventas incluyen el pago inicial del vendedor; solo el total consumido por Cierre de caja evita contarlo dos veces.

## Verificacion

1. Crear un pedido simple con deuda de vendedor y pago en efectivo: existe un unico flujo, una fila de historial y el cierre lo suma una vez en efectivo.
2. Repetir con QR: el comportamiento es equivalente en QR.
3. Crear sin pago de vendedor o con deuda de vendedor igual a cero: no se crea el flujo ni la fila adicional.
4. Entregar el pedido y cobrar al comprador: los subtotales reflejan solo la deuda del comprador y se agregan al cierre junto al pago inicial, sin duplicar ninguno.
5. Reintentar la solicitud de creacion: no se duplica el flujo ni la fila de historial.
