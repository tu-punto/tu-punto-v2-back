# Reporte QR: variantes no escaneadas con desfase

## Objetivo

Al descargar el Excel de un inventario QR, incluir las variantes que tenían stock al iniciar y nunca fueron escaneadas. Estas filas deben hacer visible el faltante: `Contado = 0` y `Diferencia = -Stock al iniciar`.

## Alcance

- Se modifica exclusivamente el reporte Excel de inventario QR (`GET /qr-inventory/:id/export/xlsx`).
- La pantalla de conteo conserva su comportamiento actual: sigue mostrando solamente las variantes escaneadas o corregidas.
- No se actualiza el stock real de productos ni se altera el historial del inventario.

## Fuente de datos y flujo

1. Al crear un inventario, el backend ya guarda `stockSnapshot` con `productId`, `variantKey` y el stock inicial de cada variante de la sucursal.
2. Al exportar, se mantienen todas las filas existentes de `inventory.rows`, que representan variantes escaneadas o corregidas.
3. Para cada entrada de `stockSnapshot` cuyo stock inicial sea mayor que cero y que no tenga una fila equivalente en `inventory.rows`, el backend recupera del producto los datos de presentación de esa variante: producto y etiqueta de variante.
4. El exportador añade una fila sintética con `Stock al iniciar` igual al snapshot, `Contado` igual a cero, `Diferencia` negativa, y sin fecha ni usuario de última actualización.
5. Las variantes con stock inicial igual a cero que no fueron escaneadas no se incluyen. Las que sí fueron escaneadas conservan la fila real existente, incluido cualquier excedente contado.

La identificación de una variante es la pareja `productId + variantKey`; por tanto, una variante escaneada nunca se duplica como “no escaneada”. El snapshot, y no el stock actual, determina el desfase para proteger el reporte contra ventas, ingresos u otros movimientos posteriores al inicio del conteo.

## Excel

Las columnas actuales no cambian:

`Producto`, `Variante`, `Stock al iniciar`, `Contado`, `Diferencia`, `Ultima actualizacion`, `Ultimo usuario`.

Las filas sintéticas usan los mismos encabezados. Sus dos columnas finales quedan vacías. No hay nueva API ni cambio requerido en el cliente, porque el botón existente descarga el mismo archivo.

## Errores y compatibilidad

- Inventarios históricos cuyo snapshot no permita encontrar un producto o combinación se exportan sin fallar: se usa una etiqueta identificable de variante cuando sea posible y campos de presentación vacíos como último recurso.
- Si la variante ya existe como fila real, esta prevalece sobre el snapshot, incluso si su conteo es cero debido a una corrección manual.
- Se conserva la validación actual de ID y la respuesta de archivo XLSX.

## Pruebas

- Snapshot con una variante de stock 5 no escaneada: aparece con contado 0 y diferencia -5.
- Variante escaneada: aparece una sola vez con su conteo real.
- Variante corregida a 0: aparece una sola vez como fila real, no como fila sintética duplicada.
- Snapshot con stock 0 no escaneado: no aparece.
- Movimientos de stock después de iniciar el inventario: el reporte continúa usando el stock del snapshot.
- La descarga mantiene los encabezados y un XLSX válido.
