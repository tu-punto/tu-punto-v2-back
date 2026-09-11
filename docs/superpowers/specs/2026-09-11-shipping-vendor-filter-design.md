# Filtro global de vendedores en Pedidos

## Objetivo

El selector **Vendedores** de Pedidos debe incluir a cada vendedor registrado con al menos un pedido normal o simple, aunque dicho pedido no esté en la página actual ni coincida con los demás filtros de la pantalla. La opción **Externo** se mantiene separada y no representa vendedores registrados.

La búsqueda de pedidos debe ignorar mayúsculas, minúsculas y diacríticos: por ejemplo, `Televisión` y `television` deben producir las mismas coincidencias.

## Flujo y límites

1. El endpoint del tablero de pedidos calculará una lista global y deduplicada de IDs de vendedor a partir de todos los pedidos internos no catalogados como venta interna. Incluirá la asociación por venta, producto temporal y el vínculo que tenga un pedido simple.
2. Ese cálculo no aplicará paginación, pestaña, fecha, sucursal, destino, cliente, guía ni el vendedor seleccionado. Por tanto, el selector puede contener vendedores sin resultados dentro de los filtros visibles actuales.
3. La consulta que carga la tabla conservará íntegramente sus filtros actuales y su paginación. Seleccionar un vendedor únicamente añade el filtro de ese vendedor; no cambiará los criterios existentes ni reducirá pedidos fuera de dicha selección.
4. El cliente usará exclusivamente la lista global entregada por el endpoint para poblar el selector. La opción genérica **Externo** se conserva tal como está.
5. Las comparaciones de texto de la búsqueda de pedidos se normalizarán sin acentos, tanto para el término introducido como para los valores de cliente, teléfono, carnet y guía, sin afectar el texto almacenado ni mostrado.

## Alternativa descartada

Construir el selector desde las filas paginadas es simple, pero omite vendedores fuera de la página. Construirlo con los filtros activos también puede ocultar vendedores que tienen pedidos. Se descartan ambas alternativas porque contradicen el requisito de una lista global.

## Errores y compatibilidad

Si la lista global no puede cargarse, el selector seguirá comportándose de forma segura sin opciones de vendedores, y la tabla no se modificará. No se migrarán datos ni se cambiará la representación de pedidos externos.

## Verificación

- Confirmar que un vendedor presente solo en pedidos simples aparece en el selector.
- Confirmar que vendedores de páginas posteriores aparecen en el selector.
- Confirmar que alterar fecha, sucursal, pestaña, destino o búsqueda no cambia el conjunto del selector.
- Confirmar que seleccionar un vendedor mantiene los filtros de tabla actuales.
- Confirmar que `Televisión` y `television` devuelven las mismas coincidencias.
- Compilar el backend y el frontend afectados.
