# Plan: exportacion de productos para auditoria

1. Agregar `exports/` al `.gitignore` para que datos exportados nunca entren al repositorio.
2. Crear un script TypeScript aislado que se conecte usando la configuracion Mongo existente, consulte `Producto` y `Categoria`, y convierta cada combinacion por sucursal en una fila segura.
3. Generar IDs y sucursales anonimizados consistentes solo dentro del archivo; escribir un CSV UTF-8 con BOM y escapado correcto de celdas.
4. Registrar el comando `export:audit-products` en `package.json`; no crear endpoints, permisos, ni cambios de esquema.
5. Compilar el backend y revisar que el archivo fuente no proyecte campos excluidos.
