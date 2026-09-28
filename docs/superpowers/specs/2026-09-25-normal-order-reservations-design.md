# Reservas de pedidos normales en inventario

## Objetivo

Extender el indicador de reservas para incluir pedidos internos normales pendientes, sin añadir consultas costosas a la carga de la lista de productos ni cambiar las reglas actuales de stock, filtros o compra.

## Alcance

- Cada combinación de producto almacenará reservas normales pendientes separadas de las reservas de catálogo.
- El campo expuesto `stockEnReserva` será la suma de ambas fuentes de reserva.
- La lista de productos conservará una variante cuando tenga stock disponible o reservas activas.
- Una variante con `stock = 0` y `stockEnReserva > 0` mostrará `0 +N`, se verá agotada y no se podrá añadir al carrito.
- Una variante con `stock = 0` y sin reservas permanece oculta, igual que hoy.

## Reglas de negocio

1. Una venta vinculada a un pedido interno con estado `En Espera`, `En camino` o `LISTO PARA RECOGER` crea o incrementa una reserva normal de su variante.
2. Las ventas inmediatas con estado `interno` no crean reservas.
3. Al modificar la cantidad de una venta pendiente, la reserva normal se ajusta por la misma diferencia que el stock.
4. Al eliminar una venta o cancelar/rechazar un pedido normal, se elimina o ajusta la reserva junto con la restauración de stock ya existente.
5. Al entregar un pedido normal, su reserva se elimina sin restaurar stock.
6. Las reservas normales se identifican por pedido y combinación, para que varios productos del mismo pedido se acumulen correctamente y las operaciones sean idempotentes.
7. No se cambian estados de pedidos ni se suma `stockEnReserva` al stock comprable.

## Rendimiento y filtros

La lista de productos no consultará ventas ni pedidos al cargarse. Solo sumará los arreglos de reserva ya persistidos dentro de cada combinación, por lo que conserva su consulta y filtros por sucursal, vendedor, categoría y búsqueda.

La condición de visibilidad con `inStock` pasará de `stock > 0` a `stock > 0 OR stockEnReserva > 0`. Esto permite ver exclusivamente las variantes agotadas que tienen reservas reales; no muestra productos completamente agotados.

## Migración de datos

Un script único recorrerá las ventas existentes de pedidos internos pendientes y reconstruirá las reservas normales en sus combinaciones correspondientes. El script será idempotente: puede ejecutarse de nuevo sin duplicar cantidades. No cambia stock ni estados de pedidos.

## Interfaz

La tabla conserva el stock real como valor principal. Cuando haya reservas, muestra un `+N` secundario con tooltip `En reserva`. En una fila con stock cero, la apariencia actual de agotado se mantiene; el click conserva el mensaje de falta de stock y no agrega el producto al carrito.

## Verificación

1. Crear un pedido interno pendiente por 5 aguas y comprobar que la lista muestra el stock restante y `+5`.
2. Con stock restante cero, comprobar que se muestra `0 +5`, conserva filtros correctos y no permite añadirlo.
3. Comprobar que `0 +0` no aparece en la lista.
4. Entregar, cancelar o rechazar el pedido y comprobar que el indicador desaparece con el comportamiento de stock actual.
5. Editar y eliminar productos de un pedido pendiente para comprobar que la reserva coincide con la cantidad pendiente.
6. Ejecutar la migración dos veces y comprobar que no duplica reservas ni modifica stock.
