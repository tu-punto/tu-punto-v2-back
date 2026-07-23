# External Orders Edit And Delete Design

## Objetivo

Habilitar una edicion mas completa y segura de `pedidos externos` y un borrado duro controlado, con reversion de efectos economicos cuando exista trazabilidad suficiente, sin afectar `pedidos simples`.

## Alcance

Esta especificacion cubre solo `ventas externas` (`service_origin = external`) y excluye `simple_package`.

Incluye:

1. Edicion por bloques en frontend.
2. Guardado inmediato por bloque.
3. Habilitacion de edicion mas amplia para `admin`, `operator` y `superadmin`.
4. Borrado duro con reversion economica para pedidos nuevos con trazabilidad.
5. Borrado forzado solo para `superadmin` en pedidos antiguos sin trazabilidad suficiente.

## Fuera de alcance

- No se cambiara el comportamiento de `simple_package`.
- No se redisenara el modulo completo de historial de ventas.
- No se hara un backfill obligatorio para reconstruir trazabilidad economica de pedidos externos antiguos.
- No se abrira una excepcion a la regla de mas de 5 dias entregado en esta fase.

## Estado actual observado

- Los `pedidos externos` ya pueden ser editados por backend, pero la UX actual no esta pensada como edicion por bloques.
- La regla de bloqueo por mas de 5 dias entregado ya existe para editar y eliminar.
- Al crear externos, algunos efectos economicos se agregan de forma agrupada por metodo de pago, no por pedido individual.
- El borrado actual elimina el pedido, pero no revierte automaticamente los efectos economicos asociados.

## Reglas funcionales acordadas

### Roles

- `admin`, `operator` y `superadmin` pueden editar pedidos externos.
- `admin` y `operator` pueden borrar pedidos externos solo cuando exista trazabilidad suficiente para revertir efectos de forma segura.
- `superadmin` puede forzar el borrado de pedidos externos antiguos sin trazabilidad suficiente, con advertencia explicita.

### Regla de tiempo

- Si un pedido externo ya fue marcado como `Entregado` y pasaron mas de 5 dias, no se permite editar ni borrar.
- Esta regla aplica tambien para `superadmin` en esta fase.

### Exclusiones

- Nada de esta especificacion aplica a `simple_package`.

## Edicion por bloques

### Objetivo

Permitir modificar mas campos sin convertir el modal en una edicion riesgosa de todo a la vez.

### Bloques de UI

1. `Comprador`
2. `Ruta y sucursales`
3. `Paquete y precios`
4. `Cobros y pagos`
5. `Estado y entrega`

### Comportamiento

- Cada bloque inicia en modo lectura.
- Cada bloque tiene su propio boton o icono `Editar`.
- Al entrar en modo edicion, solo ese bloque se vuelve editable.
- Cada bloque tiene `Guardar` y `Cancelar`.
- Al presionar `Guardar`, ese bloque se persiste inmediatamente.
- Los cambios guardados en un bloque no dependen del `Guardar` general del modal.
- El modal general queda como contenedor visual y cierre, no como confirmacion obligatoria de todos los cambios.

### Beneficios

- Reduce errores accidentales.
- Permite advertencias mas especificas segun el bloque.
- Facilita validaciones distintas por seccion.
- Evita perder cambios ya confirmados si el usuario cierra el modal despues.

## Arquitectura de backend para edicion

### Enfoque recomendado

- Mantener una ruta de actualizacion comun para externos, pero permitir payloads parciales bien delimitados por bloque.
- Agregar un campo o contexto de `editBlock` opcional para mejorar validacion, logging y mensajes de error.
- Aplicar validacion estricta distinta por bloque.

### Bloques y payloads esperados

#### Comprador

- `comprador`
- `telefono_comprador`

Restricciones:

- Si el pedido es antiguo y el cambio toca comprador, sigue aplicando la regla actual de mismo dia para comprador/cobro.
- Para `simple_package`, no aplica porque queda fuera de alcance.

#### Ruta y sucursales

- `origen_sucursal_id`
- `destino_sucursal_id`
- `delivery_spaces`
- `package_size`

Restricciones:

- Recalcula ruta y precios solo para `external`.
- Debe validar sucursales existentes y configuracion de ruta.

#### Paquete y precios

- `descripcion_paquete`
- `precio_paquete`
- `costo_delivery`

Restricciones:

- Para `external`, recalcula o valida coherencia con la ruta cuando corresponda.

#### Cobros y pagos

- `esta_pagado`
- `monto_paga_vendedor`
- `monto_paga_comprador`
- `metodo_pago`
- `tipo_de_pago`
- `subtotal_qr`
- `subtotal_efectivo`

Restricciones:

- Mantener reglas actuales de consistencia de montos.
- Mantener regla de mismo dia para cambios de cobro.
- Si cambia el pago al vendedor, ajustar el efecto economico asociado con trazabilidad por pedido.

#### Estado y entrega

- `estado_pedido`
- `hora_entrega_real`
- `retirado_por_vendedor`
- `seller_withdrawn_at`

Restricciones:

- Mantener regla de bloqueo de 5 dias si ya fue entregado.
- Mantener calculos actuales vinculados a entrega y recargos.

## Trazabilidad economica para pedidos externos nuevos

### Problema

Hoy los efectos economicos se generan de forma agregada. Eso dificulta revertir solo la parte correspondiente a un pedido individual.

### Solucion propuesta

Desde esta implementacion, cada `pedido externo` nuevo debe guardar trazabilidad explicita de los efectos economicos creados por su alta o por cambios posteriores.

### Requerimiento de datos

Agregar un bloque de metadata en la entidad de venta externa, por ejemplo:

- `economic_effects`
  - `kind`
  - `finance_flux_id`
  - `seller_id`
  - `amount`
  - `payment_method`
  - `applied_at`
  - `group_key`
  - `reversible`

El nombre exacto puede ajustarse al modelo actual, pero la idea obligatoria es:

- poder saber que efecto genero ese pedido
- poder restar solo su parte
- poder decidir si el efecto es reversible automaticamente

### Agrupacion

Si se crean 6 pedidos externos juntos y hoy corresponde un solo flujo agrupado:

- los 6 pedidos deben apuntar al mismo `finance_flux_id` o a la misma clave de agrupacion
- cada pedido debe guardar cuanto aporto a ese flujo
- al borrar uno, se descuenta solo su monto
- al borrar el ultimo, si el flujo queda en `0`, se elimina el flujo en lugar de dejarlo vivo con monto cero

### Efectos a trazar

Como minimo:

- flujos de ingreso por pago al vendedor
- ajustes de saldo pendiente del vendedor
- cualquier otro ajuste economico automatico que nazca del pedido externo

## Borrado duro

### Definicion

El borrado elimina definitivamente el pedido externo de la coleccion principal.

### Reglas para pedidos nuevos con trazabilidad

Cuando exista trazabilidad suficiente:

1. verificar regla de 5 dias
2. calcular todos los efectos economicos a revertir
3. revertirlos de forma atomica o con estrategia consistente
4. borrar el pedido
5. registrar auditoria del borrado

### Reversion de flujo agrupado

Si un flujo agrupado fue compartido por varios pedidos:

- restar solo el monto del pedido borrado
- si el nuevo monto del flujo es mayor que `0`, actualizarlo
- si el nuevo monto del flujo queda en `0`, eliminar el flujo

### Reversion de saldo vendedor

- si el pedido habia incrementado saldo del vendedor, restar solo el delta de ese pedido
- no tocar otros pedidos del mismo vendedor

### Requisitos de consistencia

- no dejar flujos con monto negativo
- no dejar flujos con monto cero salvo durante una transaccion intermedia
- no revertir dos veces el mismo efecto

## Pedidos antiguos sin trazabilidad suficiente

### Regla general

- `admin` y `operator` no pueden borrarlos si tienen efectos economicos que no se pueden revertir con precision.

### Borrado forzado por superadmin

`superadmin` puede forzar el borrado, pero:

- el pedido se elimina
- no se revierten automaticamente ingresos, saldos ni otros efectos economicos historicos insuficientemente trazados
- debe mostrarse una advertencia explicita antes de confirmar

### Mensaje de confirmacion recomendado

`Este pedido externo fue creado antes de la trazabilidad economica. Se eliminara el pedido, pero NO se revertiran automaticamente ingresos, saldos ni otros efectos economicos relacionados. Esta accion no se puede deshacer.`

### Comportamiento UX

- `admin/operator`: boton deshabilitado o error explicito
- `superadmin`: boton de `Forzar borrado`
- confirmacion obligatoria antes de ejecutar

## Confirmaciones en UI

### Borrado normal reversible

Mostrar resumen de efectos a revertir:

- pedido a eliminar
- monto a descontar de ingresos si aplica
- saldo vendedor a revertir si aplica
- si se eliminara o solo ajustara un flujo agrupado

Ejemplo:

`Se eliminara el pedido externo y se revertiran sus efectos economicos. El flujo agrupado de efectivo se reducira en Bs X.XX.`

### Borrado forzado sin reversion completa

Mostrar advertencia fuerte y requerir confirmacion adicional para `superadmin`.

## API propuesta

### Actualizacion por bloque

Opciones validas:

1. Mantener `PUT /external/update/:id` con payload parcial y un campo `editBlock`.
2. Crear endpoints por bloque.

Recomendacion:

- Mantener una sola ruta de update para minimizar ruptura.
- Enviar `editBlock` desde frontend para aplicar validacion y mensajes mas precisos.

### Eliminacion

Separar claramente:

- `DELETE /external/:id`
  - borrado normal
  - solo si puede revertir con seguridad
- `DELETE /external/:id?force=true`
  o ruta separada
- solo para `superadmin`
- solo para pedidos sin trazabilidad suficiente

Recomendacion:

- usar una ruta separada para evitar ambiguedad semantica:
  - `DELETE /external/:id`
  - `POST /external/:id/force-delete`

## Modelo de frontend

### Modal de detalle/edicion

- Vista por bloques
- Estado local independiente por bloque
- Guardado inmediato al presionar `Guardar` del bloque
- Refresco parcial del bloque o del registro al completar guardado

### Estado visual

- Modo lectura por defecto
- Modo edicion solo para el bloque activo
- Indicador de ultimo guardado por bloque opcional
- Mensajes de error localizados por bloque

### Borrado

- Accion visible segun rol
- Confirmacion con resumen
- Refresco de tabla/lista despues del borrado

## Manejo de errores

- `400` para payload invalido o cambios no permitidos por regla de negocio
- `403` para rol insuficiente o borrado forzado no autorizado
- `409` recomendado para casos donde el pedido no puede borrarse por falta de trazabilidad reversible
- mensajes claros y orientados a usuario interno

## Auditoria y observabilidad

Registrar:

- quien edito
- que bloque edito
- quien borro
- si el borrado fue normal o forzado
- que efectos economicos fueron revertidos
- que efectos no pudieron revertirse en borrado forzado

## Compatibilidad con historicos

### Pedidos nuevos

- obligatoriamente con trazabilidad

### Pedidos antiguos

- si no tienen efectos economicos reversibles detectables, pueden borrarse normal
- si tienen efectos sin trazabilidad suficiente:
  - `admin/operator`: bloqueo
  - `superadmin`: borrado forzado con advertencia

## Plan de implementacion recomendado

1. Extender modelo de externos con metadata de efectos economicos.
2. Registrar trazabilidad al crear externos nuevos y lotes.
3. Ajustar update para soportar guardado parcial por bloque.
4. Implementar reversion economica segura para borrado normal.
5. Implementar borrado forzado solo para `superadmin`.
6. Implementar frontend por bloques con guardado inmediato.
7. Agregar confirmaciones de borrado con resumen o advertencia.

## Criterios de exito

- `admin`, `operator` y `superadmin` pueden editar externos por bloques.
- Cada bloque guarda de inmediato sin depender del guardado general del modal.
- Los externos nuevos pueden borrarse con reversion precisa de efectos economicos.
- Los flujos agrupados se ajustan por contribucion y se eliminan solo cuando llegan a cero.
- Los externos antiguos sin trazabilidad suficiente no se borran normal.
- `superadmin` puede forzar borrado de antiguos con advertencia explicita.
- La regla de 5 dias entregado se mantiene para editar y borrar.

## Riesgos abiertos

- Puede requerirse una transaccion o estrategia compensatoria si varias colecciones cambian en el mismo borrado.
- Los historicos viejos pueden no tener suficiente informacion para inferencia segura.
- Habra que revisar con detalle todos los efectos economicos reales que hoy genera un externo, no solo `finance flux`.

## Decision final

Se implementara una edicion por bloques con guardado inmediato para `pedidos externos`, junto con borrado duro seguro para registros nuevos con trazabilidad economica y borrado forzado solo para `superadmin` en registros antiguos sin trazabilidad suficiente. La regla de 5 dias entregado se mantiene para todos y `simple_package` queda fuera de alcance.
