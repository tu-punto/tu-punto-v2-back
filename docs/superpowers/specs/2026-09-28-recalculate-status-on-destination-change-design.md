# Recalcular estado al cambiar destino

## Objetivo

Al modificar la sucursal destino de un pedido externo o paquete simple que ya fue creado, el estado debe reflejar automáticamente si requiere traslado entre sucursales.

## Regla de negocio

- Si el pedido ya está `Entregado`, conservar ese estado sin cambios.
- Para cualquier pedido no entregado cuyo origen o destino cambie:
  - origen y destino iguales: establecer `LISTO PARA RECOGER` y registrar la fecha de disponibilidad.
  - origen y destino distintos: establecer `PARA ENVIAR A OTRA SUCURSAL` y eliminar la fecha de disponibilidad para recoger.

La regla no modifica las restricciones existentes de permisos, pedidos anulados o la ventana de edición posterior a la entrega.

## Diseño técnico

La lógica se aplicará en el servicio de backend que actualiza ventas externas, que también procesa los pedidos simples ya convertidos en pedidos. El estado calculado por la ruta tendrá prioridad sobre el estado enviado por la interfaz únicamente cuando se modificó la ruta y el registro no estaba entregado.

Se mantendrán los recálculos existentes de precio, ruta, tamaño y espacios de delivery. Las pantallas no necesitan decidir el nuevo estado: al recargar, el pedido aparecerá en la lista de envíos cuando corresponda.

## Verificación

- Cambiar un pedido no entregado de 1 → 2 a 1 → 1: queda `LISTO PARA RECOGER`.
- Cambiar un pedido no entregado de 1 → 1 a 1 → 2: queda `PARA ENVIAR A OTRA SUCURSAL` y es elegible para el flujo de envíos.
- Cambiar destino de un pedido `Entregado`: conserva `Entregado`.
- Confirmar que el proyecto compila.
