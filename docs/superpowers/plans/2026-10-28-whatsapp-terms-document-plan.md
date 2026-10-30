# Plan: documento T&C administrable y mensajes de entrega

## 1. Backend: documento público administrable

**Archivos:** `src/services/termsDocument.service.ts`, `src/controllers/termsDocument.controller.ts`, `src/routes/termsDocument.routes.ts`, `src/routes.ts`, `src/middlewares/upload.middleware.ts`

- Definir la clave S3 invariable `public/terminos-paqueteria.pdf` y construir su URL con la configuración de bucket existente.
- Exponer `GET /terms-document` para devolver la URL pública y `PUT /terms-document` para reemplazar el PDF.
- Proteger la actualización con autenticación y `requireRole("superadmin")`.
- Añadir un middleware Multer específico: un archivo, solo `application/pdf`, límite explícito y almacenamiento en memoria.
- Validar la presencia del archivo antes de subirlo y usar `uploadFileToAws` con `application/pdf`. Solo responder correctamente tras una subida S3 satisfactoria, con lo que el objeto anterior queda intacto ante un fallo.

## 2. Frontend: control discreto en Envíos

**Archivos:** `tu-punto-v2-front/src/pages/Shipping/Shipping.tsx`, `tu-punto-v2-front/src/pages/Shipping/TermsDocumentModal.tsx`, `tu-punto-v2-front/src/api/termsDocument.ts`

- Crear los clientes GET y PUT multipart con el `apiClient` existente.
- Crear un modal Ant Design compacto que consulte y abra el documento actual, permita seleccionar un único PDF y muestre el estado de carga y errores del servidor.
- Añadir el botón secundario `T&C` junto a `Escalonamiento` en `Shipping.tsx`, condicionado a `isSuperadminUser(user)`.
- Tras una carga correcta, limpiar el archivo seleccionado, refrescar la URL y comunicar el resultado mediante `message.success`.

## 3. WhatsApp: ubicación en cuerpo, documento y reglas de multa

**Archivos:** `src/services/orderGuideWhatsapp.service.ts`, configuración de entorno documentada en `example.env`

- Centralizar la URL estable de T&C, con posibilidad de anulación por variable de entorno para despliegues que usen CDN.
- En la plantilla del comprador, reemplazar el primer botón de ubicación por el botón estático de T&C y conservar tracking como botón de índice 1.
- Incorporar la ubicación de Maps al cuerpo como parámetro adicional, antes de los horarios; conservar una URL completa y pulsable.
- Obtener el importe a pagar y la multa semanal desde los datos/snapshot de la externa nueva; seleccionar la plantilla de comprador de multa solo para externas bajo el régimen aplicable. Las simples usarán una plantilla sin los campos ni el aviso de multa.
- Añadir el botón T&C a la plantilla de vendedor, sin afectar sus datos agrupados.
- Documentar las plantillas que deben aprobarse en Meta: comprador con multa, comprador sin multa y vendedor, con el orden exacto de parámetros y botones.

## 4. Validación

- Ejecutar `npm run build` en backend y frontend.
- Probar el endpoint de lectura, la actualización PDF superadmin, la prohibición para otro rol y el mantenimiento de la URL tras dos reemplazos.
- Verificar los payloads de WhatsApp sin efectuar envíos reales: vendedor, externa con multa y simple sin multa; comprobar índices y conteos de parámetros.
- Verificar que el botón T&C solo se renderiza para superadmin y que el modal enlaza al documento devuelto por API.
