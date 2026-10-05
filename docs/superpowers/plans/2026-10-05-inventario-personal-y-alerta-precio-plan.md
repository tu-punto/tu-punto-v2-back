# Plan de implementación: inventario personal y alerta de precio

> Implementar en dos repositorios: `tu-punto-v2-back` y `tu-punto-v2-front`.

## 1. Modelos personales aislados (backend)

Crear en `src/entities/implements/` los esquemas y modelos Mongoose de productos, ventas, gastos y movimientos personales. Todos contendrán `sellerId` indexado; los productos guardarán `name`, `salePrice`, `purchaseCost?`, `stock`, timestamps; las ventas guardarán sus líneas como una fotografía de nombre/precio/cantidad; los movimientos guardarán tipo, delta, motivo y referencias opcionales.

Usar una colección nueva por modelo, sin referencias a `Producto`, `Venta`, `FlujoFinanciero`, `Ingreso` ni `Vendedor` operativo. Añadir índices de propietario y fecha para el historial.

## 2. Servicio transaccional personal (backend)

Crear `src/services/personalInventory.service.ts` y un repositorio específico. El servicio debe ofrecer:

- CRUD de productos personales y ajuste de stock.
- Creación de gasto.
- Consulta de historial paginada y ordenada de ventas, gastos y movimientos, filtrada por tipo, fecha y producto.
- Venta personal atómica: validar líneas, decrementar cada producto con una condición `stock >= quantity`, crear venta y movimientos, y revertir/abortar si una línea no puede reservarse.

Cuando MongoDB tenga sesión de transacción disponible, usarla; el camino de actualización condicional debe seguir impidiendo stock negativo en despliegues Mongo standalone.

## 3. Controlador, rutas y autorización (backend)

Crear `src/controllers/personalInventory.controller.ts` y `src/routes/personalInventory.routes.ts`, registrando el router en `src/routes.ts` bajo `/personal-inventory` con `requireAuth` y `requireRole("seller")`.

Contratos iniciales:

- `GET/POST /products`, `PATCH/DELETE /products/:id`, `POST /products/:id/stock-adjustments`
- `POST /sales`
- `GET/POST /expenses`
- `GET /history`

El controlador obtiene siempre el vendedor desde el token, jamás desde un `sellerId` enviado por el cliente. Responderá con errores 400 de validación, 404 para recursos propios ausentes y 409 para falta de stock concurrente.

## 4. Cambio de precio persistente (backend)

Extender el subesquema `CombinacionSchema` de `src/entities/implements/ProductoSchema.ts` con `previousPrice` y `priceChangedAt`. Adaptar `ProductRepository.updatePriceInSucursal` y `ProductService.updatePrice` para leer el precio vigente y, solo cuando cambie, persistir el valor anterior y la fecha en la misma actualización.

Revisar los otros flujos que modifican `sucursales.combinaciones.precio` (creación/duplicación/actualizaciones administrativas) para determinar si son una edición de precio existente. Solo las ediciones de una combinación existente deben generar alerta; la creación inicial no.

## 5. Exponer alerta temporal al carrito (backend)

En el mapeo de `ProductService.getFlatProductList` y su variante paginada, calcular `priceChangeAlert` cuando `priceChangedAt` no tenga más de siete días. El objeto contiene únicamente `previousPrice`, `currentPrice` y `changedAt`; cuando venza, devolver `null`/omitirlo. Mantener sin alteraciones los objetos de promoción (`pricingPromotion`).

## 6. Pruebas backend

Agregar pruebas al patrón de pruebas existente para: propiedad entre dos vendedores; producto, ajuste y gasto inválidos; venta que descuenta stock y crea movimiento; venta que no permite stock negativo; filtros cronológicos; edición de precio real; edición sin cambio; alerta vigente y vencida. Confirmar que los servicios/reportes actuales no importan los modelos personales.

## 7. Cliente API y rutas personales (frontend)

Crear `src/api/personalInventory.ts` y tipos en `src/models/` para los contratos personales. Añadir `/my-inventory` en `src/routes/protectedRoutes.tsx` y su entrada `Mi inventario` en `src/constants/menu.ts` y `src/constants/accessControl.ts`, visible solo al rol vendedor. Ajustar la navegación móvil para que la opción esté disponible desde el menú `Más` sin desplazar las acciones operativas existentes.

## 8. Pantalla móvil primero de inventario personal (frontend)

Crear `src/pages/PersonalInventory/` con una página contenedora y secciones: productos, carrito de venta, gastos e historial. Reutilizar únicamente componentes de presentación genéricos de Ant Design; no importar hooks ni APIs de ventas, stock o finanzas operativas.

Implementar tarjetas de producto con acciones rápidas, búsqueda, formulario de producto simple, diálogo de ajuste de stock y carrito con límite de cantidad en stock. En pantallas grandes se puede complementar con tabla, pero la interacción esencial debe ser viable mediante tarjetas, drawers o modales compactos en móvil.

## 9. Gastos e historial personal (frontend)

Crear el formulario de gasto (importe, descripción, fecha) y una cronología única que normalice ventas, gastos y ajustes. Incluir filtros de tipo, fechas y producto. Tras crear una venta, gasto o ajuste, invalidar/refrescar los productos y el historial; no mostrar balances, gráficas, categorías ni gastos recurrentes.

## 10. Indicador neutral de precio actualizado (frontend)

Extender los tipos usados por `useProductsFlat` y el mapeo de productos de `src/pages/Sales/Sales.tsx` para conservar `priceChangeAlert` al añadir un producto al carrito. Crear un componente pequeño, por ejemplo `PriceChangeNotice`, y renderizarlo en `src/pages/Sales/EmptySalesTable.tsx` junto al precio.

El componente mostrará icono informativo, texto `Precio actualizado` y `Antes: Bs. X · Ahora: Bs. Y` con tono neutro. Debe convivir con `PromotionPrice` y `ConditionalPromotionDetails` sin usar sus colores ni su semántica de promoción.

## 11. Verificación integrada

Ejecutar `npm run build` en backend y `npm run lint` seguido de `npm run build` en frontend. Probar manualmente con un vendedor: alta de producto, ajuste, venta, gasto, filtros y vista móvil. Probar un precio de combinación editado y verificar la marca antes de 7 días, sin promociones falsas y sin impacto visible en estadísticas/caja/flujo existentes.
