# Plan: persistencia y cobro de herramientas personales

## 1. Diagnóstico reproducible

- Comprobar el payload de alta y edición, los documentos guardados y las respuestas de listado y detalle del vendedor. Revisar el origen usado por `SellerInfoBase.buildSellerFormValues` para evitar que una fila incompleta sobrescriba los checks persistidos.
- Registrar pruebas que distingan un fallo de escritura de uno de recuperación y cubran los tres checks en alta y edición.

## 2. Modelo y validación

- Añadir importes mensuales de Dashboard e Inventario en el vendedor, independientes de `pago_sucursales`; valores ausentes equivalen a cero.
- Ampliar los detalles de `FlujoFinanciero` para identificar herramientas y el período cubierto sin asignar una sucursal ficticia. Preservar los registros antiguos sin migración ni recálculo.
- Validar importes finitos no negativos y restringir la configuración al administrador. Mantener los permisos existentes para los demás campos.

## 3. Cobro inicial y de activación

- Mantener intacto el cálculo de servicios por sucursal y sumar por separado los importes de las herramientas habilitadas.
- En el alta, registrar un cargo inicial que detalle servicios por sucursal y herramientas sin sucursal.
- En edición, detectar transiciones de deshabilitado a habilitado y cobrar de inmediato si no existe cargo para esa herramienta y período. Hacer la comprobación y creación resistentes a solicitudes concurrentes, con una clave única por vendedor, herramienta y período.
- No alterar importes o registros históricos al cambiar precio o desactivar. Reactivar durante un período ya cubierto no crea un segundo cargo.

## 4. Renovaciones y pagos

- Revisar `renewSellerWithMonths`, renovación automática, cálculo de deuda y desglose de flujo; agregar cada herramienta activa una vez por período usando su precio vigente en la renovación.
- Conservar descuentos, estado de deuda y comportamiento de pago existentes. Verificar que cambios de configuración no generen cargos parciales o duplicados ante errores y reintentos.

## 5. Formularios y visualización

- En `SellerFormModal` y `SellerInfoBase`, conservar checks guardados y mostrar el importe mensual de cada herramienta habilitada, junto a un texto que explique el cobro inmediato al activar.
- Permitir un vendedor sin sucursal cuando no tenga servicios por sucursal; preservar la validación habitual cuando sí se agregue una sucursal.
- Mostrar los cargos de herramientas identificados en el historial y los totales de servicio, sin atribuirlos a una sucursal.

## 6. Pruebas y regresión

- Alta y edición con checks y recarga; sin sucursal; activación, reactivación, cambio de precio y renovación; concurrencia y reintentos.
- Comparar los resultados de alta, deuda, pago y renovación con solo servicios por sucursal frente al comportamiento anterior; probar también una combinación de ambos tipos.
- Ejecutar verificaciones de backend y frontend, e inspeccionar las vistas en escritorio y móvil. Mantener separado el inventario personal de las estadísticas operativas.
