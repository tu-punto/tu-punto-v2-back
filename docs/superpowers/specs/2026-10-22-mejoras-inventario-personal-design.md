# Mejoras del inventario personal

## Alcance

Mejorar únicamente el inventario personal de vendedores. Sus productos, ventas, gastos y resúmenes seguirán separados de la operación y estadísticas generales de Tu Punto. Mantener la interfaz existente y facilitar su uso en computadoras y móviles.

## Productos y ventas

- Agregar un código de producto opcional, editable y consultable junto al nombre. Los productos existentes podrán seguir sin código.
- Incorporar búsqueda por nombre o código en las secciones Productos y Vender, con un estado claro cuando no haya resultados.
- Permitir editar el nombre, código, precio de venta y costo desde la tarjeta del producto. El costo se identificará como «Costo de compra o producción» y seguirá siendo opcional.
- En el carrito se podrá modificar el precio unitario de cada línea para esa venta; no cambiará el precio habitual del producto. Los importes se validarán en el servidor y el total reflejará el precio elegido.
- El motivo de un ajuste de stock será opcional tanto en la interfaz como en el servidor, conservando las validaciones de cantidad y stock.

## Historial y resumen

Mostrar cuatro indicadores compactos y adaptables a móvil: total de ventas, total de gastos, costo de productos vendidos y ganancia estimada (ventas menos gastos menos costos). Sus importes reflejarán los filtros de tipo, producto y fechas del historial. Un filtro por producto considerará únicamente las líneas de venta de ese producto; no incluirá gastos, ya que no están asociados a productos. Un filtro por tipo solo incluirá movimientos de ese tipo.

Cada venta nueva conservará el precio y el costo unitario del producto en el momento de registrarla, incluyendo la distinción entre costo cero y costo no registrado. Editar el costo o precio del producto después no modificará ventas anteriores. Las ventas anteriores y las nuevas sin costo seguirán disponibles; el costo desconocido no se inventará y se mostrará una nota discreta cuando los resultados incluyan alguna línea sin costo. En ese caso la ganancia es incompleta y se identificará como estimada.

## Seguridad y validación

Las operaciones conservarán la separación por vendedor. El servidor validará código, importes y cantidades, y mantendrá las protecciones existentes contra stock insuficiente. No se modificarán servicios de sucursales ni estadísticas generales. Los cambios de esquema serán compatibles con los documentos existentes.

## Comprobaciones

Verificar creación y edición con y sin código y costo, búsquedas, venta con precio modificado y stock insuficiente, ajuste sin motivo, preservación de valores históricos, ventas antiguas sin costo y combinaciones de filtros, incluyendo venta con varios productos. Comprobar presentación y controles en móvil y escritorio, y ejecutar las pruebas y compilaciones pertinentes.
