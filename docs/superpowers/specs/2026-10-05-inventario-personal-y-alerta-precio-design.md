# Inventario personal de vendedores y alerta de precio

## Objetivo

Permitir que todos los vendedores externos administren un inventario personal simple, registren sus ventas y gastos, y consulten un historial propio. Esta información debe permanecer completamente aislada de la operación de Tu Punto.

Además, avisar de forma informativa en el carrito operativo de Tu Punto cuando el precio base de un producto haya cambiado durante los últimos siete días.

## Alcance y aislamiento

- El módulo personal se habilita automáticamente para el rol `seller` y se presenta como `Mi inventario`.
- No reutiliza documentos, servicios, endpoints ni consultas de ventas, stock, flujo financiero, caja, promociones, reportes o estadísticas existentes.
- Se crearán modelos independientes con propietario obligatorio: `PersonalProduct`, `PersonalSale`, `PersonalExpense` y `PersonalInventoryMovement`.
- Todos los datos personales se vinculan al vendedor autenticado. El backend comprueba esa propiedad en cada lectura o mutación; la interfaz no es la única barrera de acceso.
- Las estadísticas, caja, flujo financiero, inventario, ventas y reportes actuales no se modificarán para incluir registros personales.

## Inventario personal y experiencia

El módulo tendrá cuatro acciones: `Productos`, `Vender`, `Gastos` e `Historial`.

### Productos

- Un producto personal es independiente del catálogo oficial y no tiene variantes, sucursales, promociones ni vendedores asociados.
- Campos: nombre, precio de venta y stock inicial obligatorios; costo de compra opcional.
- La vista permite buscar productos y ejecutar las acciones `Nuevo producto`, `Ajustar stock` y `Vender`.
- Un ajuste de stock registra un movimiento personal con la cantidad, motivo y fecha.

### Ventas

- `Vender` abre un carrito personal, alimentado solo por productos del dueño.
- Se pueden cambiar cantidades, pero nunca superar el stock disponible ni usar cantidades menores que uno.
- Al confirmar, el backend crea la venta y el movimiento de salida, y descuenta el stock en una única operación atómica. Si no hay stock por una operación concurrente, rechaza la venta sin persistir datos parciales.

### Gastos e historial

- Un gasto exige importe positivo, descripción y fecha.
- El historial es una sola cronología de ventas, gastos y ajustes de stock.
- Incluye filtros por tipo de movimiento, rango de fechas y producto cuando aplique.
- La primera versión no incluye categorías, gastos recurrentes, balances, márgenes, gráficos ni panel de rentabilidad.
- En móvil se usarán acciones grandes y filas o tarjetas compactas; las tablas extensas solo se usarán cuando tengan una alternativa legible en pantallas pequeñas.

## Alerta de cambio de precio en el carrito operativo

- Afecta exclusivamente al carrito operativo actual de Tu Punto. No forma parte del carrito personal.
- Cada combinación o producto operativo que cambie realmente de precio base persiste `previousPrice` y `priceChangedAt` junto al precio vigente. Un guardado con el mismo precio no genera evento.
- Cuando exista otro cambio, se reemplaza el precio anterior y se reinicia la ventana de siete días desde el último cambio.
- La respuesta que alimenta el carrito expone el metadato solo mientras `priceChangedAt` tenga una antigüedad menor o igual a siete días. Tras ese plazo, el producto se entrega sin marca.
- El carrito muestra una insignia neutra e informativa, no promocional, junto con `Precio actualizado` y `Antes: Bs. X · Ahora: Bs. Y`. No utiliza precio tachado, lenguaje de descuento ni tratamiento visual de promoción.
- Las promociones y sus reglas de precio actuales siguen funcionando sin cambios; la alerta describe únicamente el cambio del precio base.

## Integración técnica

- El backend incorpora rutas y controladores personales separados bajo un prefijo exclusivo, protegidos para `seller`.
- El frontend agrega una ruta protegida y entrada de menú `Mi inventario` para vendedores, sin cambiar las rutas operativas existentes.
- La pantalla personal usa APIs y tipos exclusivos, evitando importaciones de los servicios operativos de ventas, stock o finanzas.
- La lógica de actualización del catálogo oficial centraliza el registro de la marca temporal de precio para cubrir los caminos de edición que ya existen.

## Errores, seguridad y verificación

- Se rechazan productos inexistentes, importes inválidos, cantidades inválidas, ventas sin stock y lecturas o cambios de datos de otro vendedor.
- Los errores comunican una causa accionable y no dejan ventas, gastos ni movimientos parciales.
- Pruebas backend: aislamiento por propietario, creación y ajuste de stock, venta atómica, validación de gastos, filtros de historial y marca de precio reciente/vencida/sin cambio.
- Pruebas frontend: recorrido de producto a venta, registro de gasto, filtros del historial, indicador de precio anterior y diseño usable tanto en escritorio como en móvil.
- Se verificará expresamente que las consultas existentes de estadísticas, caja, flujo financiero, inventario y reportes no incluyan los modelos personales.
