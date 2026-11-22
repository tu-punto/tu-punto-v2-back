# Exportacion de productos para auditoria academica

## Objetivo

Generar un CSV puntual y de solo lectura para un proyecto universitario de auditoria, sin acceso a produccion ni copia completa de la base de datos.

## Datos incluidos

El script lee exclusivamente `Producto`. Cada combinacion de una sucursal genera una fila, para conservar el precio y stock de su variante.

Columnas del CSV:

- `producto_id_anonimo`: codigo consistente, nunca el `_id` de MongoDB;
- `nombre_producto`: nombre comercial real;
- `categoria`: nombre de categoria, cuando este disponible;
- `fecha_ingreso`: fecha ISO;
- `sucursal_anonima`: codigo como `SUC-001`, sin identificador ni ubicacion real;
- `variantes`: atributos legibles de la combinacion;
- `precio`: precio real;
- `stock`: stock real.

No se exportan IDs reales, vendedor, imagenes, enlaces S3, QR, reservas, `orderId`, ventas, ingresos ni datos de personas.

## Flujo

Se agrega un script TypeScript de solo lectura en `src/scripts/`, ejecutable con `npm run export:audit-products`. Usa `MONGO_DB_URL` mediante la configuracion existente, consulta productos y categorias requeridas, genera codigos anonimos deterministas y escribe un CSV UTF-8 con BOM en `exports/` con fecha y hora en su nombre. Muestra conteos de productos, filas y referencias faltantes, y cierra MongoDB tanto al finalizar como ante un error.

No habra endpoint HTTP, acceso remoto nuevo ni cambios a documentos. `exports/` se ignorara en Git.

## Datos incompletos

Una categoria no disponible se exporta vacia y se cuenta como referencia faltante. Una sucursal sin combinaciones no genera fila porque no tiene precio ni stock exportable. Ninguna advertencia mostrara IDs originales.

## Seguridad operativa

El script se ejecuta solo en un entorno autorizado que ya posee la configuracion de conexion. No imprime ni guarda credenciales. El resultado es un snapshot y se comparte por un canal privado con acceso restringido.

## Verificacion

1. Compilacion TypeScript correcta.
2. Ocho columnas exactas y sin campos excluidos.
3. Una variante por fila, con precio y stock correctos.
4. Codigos anonimos consistentes dentro del archivo.
5. Conexion cerrada ante exito y errores.
