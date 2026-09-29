# Categoría automática para productos temporales

## Objetivo

Eliminar la selección manual de categoría al registrar un producto temporal y clasificarlo automáticamente en la categoría `Temporal`.

## Regla de negocio

- Los productos temporales no muestran ni validan el campo Categoría en el formulario.
- Al crearlos, se les asigna la categoría `Temporal`.
- Si `Temporal` no existe, el backend la crea y reutiliza en las siguientes altas.
- Los productos no temporales conservan la selección de categoría actual.

## Diseño técnico

La interfaz identificará el alta temporal y omitirá el selector y su validación. El backend resolverá de forma atómica o idempotente la categoría por su nombre antes de persistir el producto, de modo que las integraciones y llamadas directas a la API respeten la misma regla.

La categoría se guardará en los campos de categoría que ya exige el modelo; no se modifica el esquema de productos ni los reportes existentes.

## Verificación

- Registrar un temporal sin enviar categoría: se crea correctamente y queda en `Temporal`.
- Repetir el registro: reutiliza la misma categoría.
- Registrar un producto normal: Categoría sigue siendo obligatoria.
- Compilan frontend y backend.
