# Persistencia y cobro de pantallas especiales

## Objetivo

Corregir el guardado y la recuperación de los checks `Externo`, `Mi Dashboard` y `Mi inventario` tanto en el alta como en la edición de vendedores. Permitir un cobro mensual independiente para cada herramienta, sin sucursal asociada, integrado a las deudas y renovaciones existentes.

## Configuración y acceso

- El administrador activa o desactiva Dashboard e Inventario por vendedor y asigna a cada herramienta un importe mensual propio, mayor o igual a cero.
- Los checks y los importes se guardan y se recuperan de forma consistente en alta, listado, detalle y edición; el estado de la sesión refleja los permisos guardados al volver a ingresar.
- Un vendedor puede contratar únicamente herramientas, sin sucursales. La creación y edición no deben exigir una sucursal cuando no hay servicios por sucursal.
- La opción `Externo` sigue ocultando las pantallas habituales de vendedor. Los checks de herramientas determinan cuáles módulos especiales están habilitados, tanto para vendedores normales como externos.

## Cobro y períodos

- En el alta, cada herramienta habilitada se incluye en el primer cargo junto a los servicios por sucursal que existan. El importe de la herramienta no requiere ni inventa una sucursal.
- Al habilitar una herramienta desde la edición, se genera inmediatamente su primer cargo para el período vigente.
- Cada cargo conserva la identidad de la herramienta, el importe aplicado y el período que cubre. Un período ya cubierto por un cargo de esa herramienta no se cobra de nuevo al desactivarla y reactivarla durante dicho período.
- Al cambiar el precio de una herramienta ya habilitada, el nuevo importe se aplica en la siguiente renovación. No modifica cargos anteriores ni crea un cargo adicional para el período actual.
- Las renovaciones incluyen cada herramienta habilitada una sola vez, además de los servicios existentes. Desactivar una herramienta no elimina ni altera deudas o pagos previamente registrados.
- El cargo de herramientas sigue el flujo actual de deuda, pago, descuentos aplicables y renovación; los registros históricos conservan sus importes originales.

## Aislamiento y compatibilidad

- Los precios y el estado de herramientas se almacenan en campos propios del vendedor. Los detalles de cobro identifican explícitamente cada herramienta y no usan una sucursal ficticia.
- Los vendedores sin configuración de herramientas conservan el comportamiento y cálculo anteriores. Los servicios por sucursal, su normalización, importes y reglas de acceso no cambian.
- No se recalculan ni modifican deudas, pagos, cargos o renovaciones históricas durante el despliegue.
- El backend valida importes, permisos de administración y duplicidad de cargos por herramienta y período. Una operación fallida no debe presentar un cargo parcial como éxito.

## Verificación

- Crear y editar vendedores con cada combinación de checks; recargar y verificar que los valores persisten y los accesos corresponden.
- Crear vendedor con solo herramientas y sin sucursal; generar el cargo inicial correcto.
- Activar una herramienta desde edición; verificar un cargo inmediato y evitar duplicados al reactivarla en el mismo período.
- Cambiar el precio y comprobar que la deuda actual no cambia y la próxima renovación usa el nuevo importe.
- Comparar alta, deuda, pago y renovación de un vendedor con solo servicios por sucursal antes y después del cambio; deben ser idénticos.
- Probar un vendedor con ambas clases de servicio, sus totales y detalles; verificar también que el historial y las estadísticas personales no se mezclen con la operación existente.
