# Plan: identidad y código de guía de paqueterías

1. Agregar al API administrativo una consulta de disponibilidad de código de
   guía y una carga protegida de logo con el middleware de imágenes existente.
2. Reutilizar `uploadFileToAws` para almacenar logos en una carpeta dedicada,
   validar archivo y actualizar únicamente `logo_url`.
3. Extender el cliente API de paqueterías con ambas operaciones.
4. Refinar el modal con ejemplo vivo de guía, comprobación anticipada de
   duplicado, vista previa/carga del logo y selectores visuales de color.
5. Ejecutar verificaciones de TypeScript y construcción, y comprobar que el
   backend conserva el índice único como validación definitiva.
