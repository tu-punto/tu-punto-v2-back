# Indicador de reservas de catálogo en carritos internos

## Objetivo

Mostrar junto al stock disponible de una variante un indicador visual `+N` cuando existan unidades reservadas por pedidos originados en el catálogo y todavía no entregados. El indicador explica el descuento de stock ya aplicado; no modifica el stock, las validaciones de cantidad ni los estados de pedidos.

## Alcance

- El backend expondrá, junto al stock de cada producto/variante usado por los carritos internos, un campo numérico `stockEnReserva` calculado desde las reservas activas de catálogo de esa combinación.
- Los carritos internos que permiten seleccionar o editar productos reutilizarán ese campo para mostrar el stock real y, inmediatamente a su lado, un `+N` pequeño cuando `stockEnReserva > 0`.
- El `+N` tendrá un tooltip con el texto exacto `En reserva` al pasar el mouse.
- Productos sin reservas, productos no publicados en catálogo y variantes con `stockEnReserva = 0` conservarán exactamente la interfaz actual: no se mostrará `+0` ni un espacio/etiqueta vacía.

## Reglas de negocio

1. `stock` continúa siendo el inventario disponible real. Los límites de cantidad y todas las validaciones existentes usan exclusivamente este valor.
2. `stockEnReserva` es solo informativo y representa la suma de las reservas activas asociadas a la combinación por pedidos de catálogo.
3. La reserva se sigue mostrando cuando el pedido está `En Espera`, `En camino` o `LISTO PARA RECOGER`.
4. Al marcar un pedido de catálogo como `Entregado`, se eliminará su registro de reserva de la combinación sin devolver stock. Esto solo impide que el indicador se siga mostrando.
5. Al rechazar un pedido de catálogo se preserva el comportamiento actual: se devuelve stock y se elimina la reserva.
6. No se añade ni se modifica ningún estado de pedido. El flujo actual de estados se mantiene intacto.

## Diseño de datos y flujo

La combinación de producto ya almacena `catalog_reservations` con `orderId` y `quantity`. La transición existente de un pedido de catálogo a `Entregado` retirará el registro de esa reserva; el rechazo seguirá restaurando stock y retirándolo como lo hace hoy.

Los endpoints de productos en formato plano incluirán el total derivado `stockEnReserva`. Así, cada vista de carrito recibe una única fuente de verdad y no necesita consultar pedidos ni volver a calcular reservas.

En la interfaz se extraerá un componente/presentación reutilizable para el valor de stock. Este renderizará el número disponible y, condicionalmente, el indicador con tooltip. No habrá cambios en la cantidad máxima, botones, precios ni comportamiento de compra.

## Estados y errores

- Sin reservas: solo se muestra el stock actual.
- Con una o varias reservas: se muestra `stock +N` y el tooltip.
- Reserva entregada: en la siguiente carga/actualización de inventario ya no aparece el indicador.
- Rechazo: el stock restaurado se sigue mostrando conforme a la lógica actual, sin indicador para esa reserva.
- Si una respuesta antigua no incluye `stockEnReserva`, el frontend lo tratará como `0` y conservará el comportamiento actual.

## Verificación

1. Con 5 unidades, crear un pedido de catálogo por 2 y comprobar que el carrito muestra `3 +2` y que solo permite seleccionar hasta 3.
2. Confirmar que al hacer hover sobre `+2` aparece `En reserva`.
3. Confirmar que un producto sin reservas no muestra indicador.
4. Confirmar que una variante no publicada en catálogo no cambia visualmente.
5. Marcar el pedido como `Entregado` y confirmar que el stock permanece en 3, pero desaparece `+2`.
6. Rechazar un pedido de catálogo y confirmar que se restituye el stock y desaparece el indicador.
