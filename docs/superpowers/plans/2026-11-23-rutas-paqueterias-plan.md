# Plan: rutas hacia paqueterías externas

1. Extender el esquema de `SimplePackageBranchPrice` con un destino tipado,
   conservando `destino_sucursal` para las rutas históricas.
2. Ajustar repositorio, servicio y controlador para listar destinos de ambos
   tipos, validar paqueterías activas y rechazar duplicados.
3. Actualizar la API de rutas para recibir un destino tipado sin romper el
   contrato anterior de sucursal a sucursal.
4. Adaptar el modal de Rutas: selector de destino agrupado y filas etiquetadas
   para paqueterías, usando los controles Ant Design existentes.
5. Ejecutar comprobaciones de tipos/construcción y revisar que el diff no
   altere rutas internas existentes.
