# Pantallas especiales configurables para vendedores

## Objetivo

Conservar sin cambios el acceso de los vendedores normales y permitir que un administrador habilite de forma individual las pantallas especiales `Mi Dashboard` y `Mi inventario`.

Un vendedor marcado como externo no verá las pantallas normales de vendedor; solo verá las pantallas especiales que el administrador haya marcado.

## Configuración

El vendedor incorpora tres booleanos, todos con valor inicial `false`:

- `is_external`: identifica al vendedor externo.
- `can_access_seller_dashboard`: habilita `Mi Dashboard`.
- `can_access_personal_inventory`: habilita `Mi inventario`.

La sección `Pantallas especiales` se muestra en el formulario de alta y edición de vendedor con los checks `Externo`, `Mi Dashboard` y `Mi inventario`. Explica que `Externo` oculta el menú habitual.

Los vendedores existentes y los nuevos sin checks se tratan como vendedores normales y conservan el acceso actual. Dashboard e inventario personal pueden habilitarse para vendedores normales o externos.

## Reglas de acceso

- Un vendedor normal conserva las reglas existentes de servicios, sucursales, comisión, stock, ventas, pedidos, paquetes e información.
- En un vendedor normal, las pantallas especiales se suman solo cuando sus checks estén activos.
- Un vendedor externo no recibe rutas ni entradas de menú de las pantallas normales de vendedor, sin importar las configuraciones de servicio actuales.
- Un vendedor externo solo ve Dashboard e Inventario personal si sus checks están activos.
- El backend expone los tres valores en la información de usuario autenticado para que el frontend forme el menú correctamente.
- El frontend protege rutas especiales y normales. Una URL escrita manualmente no puede evadir el menú; un acceso denegado redirige a una pantalla especial habilitada o a `unauthorized` cuando no exista una.

## Compatibilidad y seguridad

- Los campos nuevos tienen `default: false`; no se requiere migración y no cambian el comportamiento de vendedores existentes.
- La autorización de las APIs de inventario personal comprueba el check `can_access_personal_inventory`, además del rol `seller`.
- Las rutas de Dashboard requieren el check correspondiente para vendedores, manteniendo intacto el acceso administrativo que ya corresponda.
- Administradores y operadores no cambian de comportamiento.

## Verificación

- Vendedor normal sin checks: mismo menú y rutas que antes.
- Vendedor normal con Dashboard o Inventario: conserva su menú normal y gana solo la pantalla marcada.
- Vendedor externo con una o ambas pantallas: no puede abrir rutas normales ni desde menú ni por URL; ve únicamente los módulos marcados.
- Vendedor externo sin pantallas especiales: recibe una explicación de que no tiene módulos habilitados.
- Los cambios de checks persisten al editar y se reflejan al renovar la sesión.
