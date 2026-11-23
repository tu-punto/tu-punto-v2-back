# Rutas hacia paqueterías externas

## Propósito

Permitir que el administrador conecte una sucursal de Tu Punto con una
paquetería externa desde la sección existente **Envíos → Rutas**. La conexión
habilita el destino operativo; no convierte la paquetería en una sucursal ni
altera su tarifa fija por paquete.

## Alcance

- El origen de una ruta seguirá siendo siempre una sucursal de Tu Punto.
- El destino podrá ser una sucursal o una paquetería externa activa.
- Al crear una paquetería quedará disponible como destino, pero no se creará
  automáticamente ninguna ruta.
- La administración creará explícitamente cada conexión, por ejemplo
  `Sucursal Central → Paquetería Entregas Norte`.
- Las rutas existentes entre sucursales seguirán siendo válidas y conservarán
  sus datos y comportamiento.

## Modelo de datos

La entidad de ruta actual almacenará de manera explícita el tipo de destino y
su referencia. Los registros históricos que solo contienen
`destino_sucursal` se interpretarán como destinos de tipo `sucursal`, por lo
que no requerirán migración destructiva.

Para un destino de paquetería se guardará su referencia a `Paqueteria`. La
unicidad será por origen, tipo de destino e id de destino, evitando duplicar
la misma conexión y permitiendo que los destinos de distinta clase permanezcan
separados.

La relación no llevará un segundo precio: los pedidos de paquetería conservan
la tarifa fija y la regla de multa configuradas en la propia paquetería.

## Interfaz de administración

En el modal existente **Rutas**:

- El selector de origen mostrará solo sucursales.
- El selector de destino agrupará las opciones activas en **Sucursales** y
  **Paqueterías**.
- Las filas creadas para una paquetería mostrarán una etiqueta visible
  `Paquetería`, para diferenciarlas de las conexiones entre sucursales.
- Al crear una ruta se ocultará del selector el destino que ya tenga una ruta
  para el origen seleccionado.

## Validaciones y seguridad

- Solo administradores podrán listar y crear estas rutas, igual que hoy.
- El backend comprobará que el origen sea una sucursal válida.
- El backend comprobará que el destino exista y que una paquetería esté activa.
- Una paquetería nunca será un origen de ruta y no aparecerá como sucursal en
  inventario, cierres, selectores de sucursal ni procesos internos.
- Las rutas existentes se conservarán como historial cuando una paquetería se
  desactive, pero esta dejará de poder seleccionarse para nuevas conexiones.

## Verificación

- Confirmar que las rutas sucursal → sucursal actuales se listan y continúan
  pudiendo crearse.
- Crear una ruta sucursal → paquetería y comprobar su representación en la
  lista.
- Intentar duplicarla y recibir una respuesta de validación.
- Desactivar la paquetería y confirmar que no aparece para rutas nuevas.
- Confirmar que no aparece como sucursal en módulos ajenos a Rutas.
