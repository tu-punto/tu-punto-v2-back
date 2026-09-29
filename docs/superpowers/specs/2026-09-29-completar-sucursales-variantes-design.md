# Completar variantes en sucursales habilitadas

## Objetivo

Permitir que un superadministrador corrija de forma intencional las variantes faltantes de un vendedor entre sus sucursales habilitadas, sin cambiar el comportamiento normal al asignar una sucursal al vendedor.

## Alcance y reglas de negocio

- La acción se ofrece en `Control global de variantes` solo después de seleccionar un vendedor.
- Solo se consideran las sucursales activas del vendedor en `pago_sucursales`; nunca se crean variantes para una sucursal que el vendedor no tenga habilitada.
- Para cada producto se obtiene la unión de sus variantes existentes. Si una variante falta en una sucursal habilitada, se crea allí.
- Si el producto no tiene aún el contenedor de una sucursal habilitada, se crea junto con las variantes faltantes.
- La variante nueva conserva la configuración de su primera copia existente según el orden de `pago_sucursales` (atributos, `variantKey`, precio, imágenes, descripción, uso, promoción y visibilidad), pero inicia con `stock: 0` y sin reservas. Esto hace determinista el resultado si dos sucursales contienen datos distintos para la misma variante.
- Las variantes ya presentes no se modifican, incluso si su stock es cero.
- No se incluye reversión automática. El administrador puede eliminar manualmente una variante por sucursal mediante la función existente.

## Diseño técnico

Se incorporará un endpoint exclusivo para superadmin que reciba el vendedor seleccionado. El servicio vuelve a leer el vendedor y sus productos, calcula los faltantes desde la base de datos y ejecuta la actualización como una operación atómica: ante una validación o persistencia fallida no debe quedar una corrección parcial.

El frontend pedirá primero una previsualización de la cantidad de variantes y sucursales que se crearían. El modal de confirmación advertirá que se crearán con stock cero y sin reversión automática. Tras confirmar, ejecutará el endpoint, mostrará el total creado y recargará la tabla.

El cálculo y la ejecución no dependerán de los filtros, el texto de búsqueda ni la página visibles en la interfaz.

## Errores y seguridad

- El endpoint exige autenticación y rol `superadmin`.
- Rechaza vendedores inexistentes y vendedores sin sucursales habilitadas.
- La confirmación informa cuando no existan faltantes, en cuyo caso no realiza cambios.
- El backend valida de nuevo las sucursales habilitadas al ejecutar, aun si la previsualización se calculó antes.

## Verificación

- Un vendedor con dos sucursales habilitadas y una variante faltante en una de ellas obtiene esa variante con stock cero.
- Una sucursal no incluida o inactiva en `pago_sucursales` no recibe contenedores ni variantes.
- Una variante existente conserva sin cambios su stock y sus campos.
- Un producto sin entrada para una sucursal habilitada crea la entrada y sus variantes faltantes.
- La previsualización y la ejecución muestran el mismo alcance cuando no hay cambios concurrentes.
- Compilan backend y frontend.
