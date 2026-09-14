# Carga progresiva de vendedores

## Objetivo

Separar la lista rápida de vendedores de los cálculos costosos de saldo, total pendiente y alertas, preservando exactamente la lógica actual de cálculo.

## Contratos

- La ruta de lista entrega una página ligera con campos de identidad, estado, fechas, sucursales, pago mensual y acciones, sin ejecutar los lookups de ventas, deudas o actividad.
- Una ruta de métricas recibe los IDs de la página y devuelve `pago_pendiente` calculado con las mismas etapas y reglas existentes.
- Una ruta de resumen acepta los mismos filtros de la lista y devuelve `totalPendingPayment`.
- Rutas de alerta devuelven conteos. Los detalles se cargan de forma paginada sólo cuando se solicitan.

## Invariantes

- `pago_pendiente` mantiene su fórmula vigente: saldo de ventas internas y paquete simple menos deudas aplicables.
- Los filtros y estados conservan las condiciones actuales.
- La lista, métricas y resumen usan una normalización común de filtros para evitar que sus resultados diverjan.
- El orden por `pago_pendiente` se resuelve con la agregación global existente, porque no puede derivarse de una página ligera.

## Alcance

- No se crean índices en esta entrega.
- No se alteran documentos ni datos históricos.
- Se preserva el endpoint y cambios existentes para cancelar solicitudes de pago.

## Verificación

- Comparar métricas de una muestra de vendedores contra la respuesta anterior.
- Verificar que el resumen y alertas respeten filtros y no bloqueen la lista.
- Compilar backend y frontend y comprobar los flujos de orden, filtros y paginación.
