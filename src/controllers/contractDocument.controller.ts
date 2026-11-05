import { Request, Response } from "express";
import { Packer, Document, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType } from "docx";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import mammoth from "mammoth";
import { ContractDocumentModel, CONTRACT_DOCUMENT_TYPES } from "../entities/implements/ContractDocumentSchema";
import { ContractGenerationModel } from "../entities/implements/ContractGenerationSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { getFileUrlFromAws, uploadFileToAws } from "../services/bucket.service";

const authId = (res: Response) => String((res.locals.auth as any)?.id || "");
const clean = (value: unknown) => String(value || "").trim();
const isHttps = (value: string) => /^https:\/\//i.test(value);
const label: Record<string, string> = {
  contract_template: "Contrato Marco", service_order_template: "Plantilla Orden de Servicio",
  annex_4: "Anexo 4", policies: "Políticas", tariff: "Tarifario", prohibited_products: "Productos prohibidos",
};

const activeDocuments = async (types: string[]) => ContractDocumentModel.find({ type: { $in: types }, active: true }).sort({ createdAt: -1 }).lean();
const money = (value: unknown) => `Bs. ${Number(value || 0).toFixed(2)}`;
const safeFileName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "documento";
const xmlText = (value: unknown) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const contractDate = (value: unknown) => {
  const match = clean(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : new Date();
};
const storeGeneratedDocument = async (sellerId: unknown, fileName: string, buffer: Buffer, contentType: string) => {
  const key = `contract-generations/${String(sellerId)}/${Date.now()}-${fileName}`;
  try { await uploadFileToAws(buffer, key, contentType); return key; }
  catch (error) { console.error("[contract-documents] No se pudo guardar el documento generado", error); return undefined; }
};

const renderContractTemplate = async (templateUrl: string, seller: any, input: any) => {
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error("No se pudo descargar la plantilla de contrato vigente");
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) throw new Error("La plantilla de contrato no tiene un documento Word válido");
  const replacements = [
    `${seller.nombre || ""} ${seller.apellido || ""}`.trim() || "CONTRATANTE",
    seller.carnet || "No registrado",
    seller.direccion || "No registrado",
    clean(input.city),
    String(contractDate(input.signatureDate).getDate()),
    contractDate(input.signatureDate).toLocaleDateString("es-BO", { month: "long" }),
  ].map(xmlText);
  const filledXml = (await documentXml.async("string"))
    .replace(/DSGROUP TU PUNTO S\.A\./g, "DSGROUP TU PUNTO S.R.L.")
    .replace(/_{4,}/g, () => replacements.shift() || "");
  zip.file("word/document.xml", filledXml);
  const filledDocx = await zip.generateAsync({ type: "nodebuffer" });
  return mammoth.convertToHtml({ buffer: filledDocx });
};

export const listContractDocuments = async (_req: Request, res: Response) => {
  const documents = await ContractDocumentModel.find().sort({ type: 1, active: -1, createdAt: -1 }).lean();
  res.json({ success: true, data: documents });
};

export const createContractDocument = async (req: Request, res: Response) => {
  try {
    const type = clean(req.body?.type);
    const version = clean(req.body?.version);
    const name = clean(req.body?.name) || label[type];
    const link = clean(req.body?.url);
    if (!(CONTRACT_DOCUMENT_TYPES as readonly string[]).includes(type)) throw new Error("Tipo de documento inválido");
    if (!version || !name) throw new Error("Nombre y versión son obligatorios");
    if (!req.file && !isHttps(link)) throw new Error("Carga un archivo o ingresa un enlace HTTPS válido");
    if (req.file && link) throw new Error("Elige archivo o enlace, no ambos");
    let url = link; let s3Key: string | undefined;
    if (req.file) {
      s3Key = `contract-documents/${type}/${Date.now()}-${safeFileName(req.file.originalname)}`;
      url = await uploadFileToAws(req.file.buffer, s3Key, req.file.mimetype);
    }
    await ContractDocumentModel.updateMany({ type, active: true }, { $set: { active: false } });
    const document = await ContractDocumentModel.create({ type, name, version, source: req.file ? "file" : "link", url, s3Key, fileName: req.file?.originalname, contentType: req.file?.mimetype, active: true, createdBy: authId(res) });
    res.status(201).json({ success: true, data: document });
  } catch (error: any) { res.status(400).json({ success: false, message: error?.message || "No se pudo guardar el documento" }); }
};

export const activateContractDocument = async (req: Request, res: Response) => {
  const document = await ContractDocumentModel.findById(req.params.id);
  if (!document) return res.status(404).json({ success: false, message: "Documento no encontrado" });
  await ContractDocumentModel.updateMany({ type: document.type, active: true }, { $set: { active: false } });
  document.active = true; await document.save();
  res.json({ success: true, data: document });
};

const serviceOrderBuffer = async (seller: any, input: any, documents: any[]) => {
  const branches = (seller.pago_sucursales || []).filter((branch: any) => branch.activo !== false && (!branch.fecha_salida || new Date(branch.fecha_salida) > new Date()));
  const policy = documents.find((document) => document.type === "policies");
  const tariff = documents.find((document) => document.type === "tariff");
  const rows = [
    ["CONTRATANTE / NIT o C.I.", `${seller.nombre || ""} ${seller.apellido || ""}`.trim() + (seller.carnet ? ` / ${seller.carnet}` : "")],
    ["Ciudad / Sucursal o zona", clean(input.city) || seller.direccion || "No registrado"],
    ["Fecha de activación", clean(input.activationDate)],
    ["Plan / capacidad", branches.length ? "Sucursales activas detalladas a continuación" : "Sin sucursales activas"],
    ["Promoción o descuento", input.promotion ? `Sí. Beneficio: ${input.promotion}` : "No aplica"],
    ["Vigencia de la promoción", input.promotion ? `Desde ${clean(input.promotionStart)} hasta ${clean(input.promotionEnd)}` : "No aplica"],
    ["Canales oficiales del CONTRATANTE", `Correo: ${seller.mail || "No registrado"}\nWhatsApp: ${seller.telefono || "No registrado"}`],
    ["Versión de Políticas Operativas aceptada", policy ? `Versión/fecha: ${policy.version}` : "No configurada"],
    ["Versión de Tarifario informada", tariff ? `Versión/fecha: ${tariff.version}` : "No configurada"],
  ];
  const table = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map(([left, right]) => new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: left, bold: true })] })] }), new TableCell({ children: right.split("\n").map((text: string) => new Paragraph(text)) })] })) });
  const branchTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: ["Sucursal", "Almacenamiento", "Exhibición", "Entrega simple"].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }),
    ...branches.map((branch: any) => new TableRow({ children: [branch.sucursalName || "Sucursal", money(branch.alquiler), money(branch.exhibicion), money(branch.entrega_simple ?? branch.delivery)].map((text) => new TableCell({ children: [new Paragraph(text)] })) })),
  ] });
  return Packer.toBuffer(new Document({ sections: [{ children: [
    new Paragraph({ text: "ANEXO 1", alignment: AlignmentType.CENTER, heading: "Heading1" }),
    new Paragraph({ text: "ORDEN DE SERVICIO / CONFIRMACIÓN DE PLAN", alignment: AlignmentType.CENTER, heading: "Heading2" }),
    new Paragraph("Este Anexo podrá completarse y aceptarse físicamente o generarse electrónicamente en la plataforma."), table,
    new Paragraph({ text: "PLAN / CAPACIDAD POR SUCURSAL ACTIVA", heading: "Heading2" }), branchTable,
    new Paragraph("Aceptación: El CONTRATANTE declara haber recibido o tenido acceso al Contrato Marco, al Tarifario y a las Políticas Operativas identificadas, y acepta las condiciones particulares de esta Orden de Servicio."),
    new Paragraph("\n\nNombre: ______________________________        Nombre: ______________________________"),
    new Paragraph("Cargo: DSGROUP TU PUNTO S.R.L.                 C.I./NIT: CONTRATANTE"),
  ] }] }));
};

const download = (res: Response, buffer: Buffer, type: string, fileName: string) => {
  res.setHeader("Content-Type", type); res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`); res.send(buffer);
};

export const generateServiceOrder = async (req: Request, res: Response) => {
  try {
    const input = req.body || {};
    if (!clean(input.activationDate)) throw new Error("La fecha de activación es obligatoria");
    if (input.promotion && (!clean(input.promotionStart) || !clean(input.promotionEnd))) throw new Error("Indica la vigencia de la promoción");
    const seller = await VendedorModel.findById(req.params.id).lean(); if (!seller) throw new Error("Vendedor no encontrado");
    const documents = await activeDocuments(["policies", "tariff"]);
    const missing = ["policies", "tariff"].filter((type) => !documents.some((document) => document.type === type));
    if (missing.length) throw new Error(`Configura el documento vigente: ${missing.map((type) => label[type]).join(", ")}`);
    const buffer = Buffer.from(await serviceOrderBuffer(seller, input, documents));
    const fileName = `orden-servicio-${safeFileName(`${seller.nombre}-${seller.apellido}`)}.docx`;
    const s3Key = await storeGeneratedDocument(seller._id, fileName, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await ContractGenerationModel.create({ seller: seller._id, generatedBy: authId(res), kind: "service_order", fileName, s3Key, inputs: input, documentVersions: documents.map((document) => ({ type: document.type, version: document.version, document: document._id })) });
    download(res, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
  } catch (error: any) { res.status(400).json({ success: false, message: error?.message || "No se pudo generar la Orden de Servicio" }); }
};

export const generateContract = async (req: Request, res: Response) => {
  try {
    const input = req.body || {}; if (!clean(input.city) || !clean(input.signatureDate)) throw new Error("Ciudad y fecha de firma son obligatorias");
    const seller = await VendedorModel.findById(req.params.id).lean(); if (!seller) throw new Error("Vendedor no encontrado");
    const documents = await activeDocuments(["contract_template", "annex_4", "policies", "tariff"]);
    const missing = ["contract_template", "annex_4", "policies", "tariff"].filter((type) => !documents.some((document) => document.type === type));
    if (missing.length) throw new Error(`Configura el documento vigente: ${missing.map((type) => label[type]).join(", ")}`);
    const template = documents.find((document) => document.type === "contract_template");
    if (!/\.docx(?:$|\?)/i.test(String(template?.fileName || template?.url || ""))) throw new Error("La plantilla de Contrato Marco vigente debe ser un archivo DOCX");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const branches = (seller.pago_sucursales || []).filter((branch: any) => branch.activo !== false && (!branch.fecha_salida || new Date(branch.fecha_salida) > new Date()));
    const branchRows = branches.map((branch: any) => `<tr><td>${branch.sucursalName || "Sucursal"}</td><td>${money(branch.alquiler)}</td><td>${money(branch.exhibicion)}</td><td>${money(branch.entrega_simple ?? branch.delivery)}</td></tr>`).join("") || "<tr><td colspan=\"4\">Sin sucursales activas</td></tr>";
    const contractHtml = await renderContractTemplate(String(template?.url), seller, input);
    await page.setContent(`<main style="font-family:Arial;padding:56px;line-height:1.6">${contractHtml.value}<div style="page-break-before:always"><h2 style="text-align:center">ANEXO 1 · ORDEN DE SERVICIO</h2><p><b>Fecha de activación:</b> ${clean(input.activationDate) || clean(input.signatureDate)}</p><table style="width:100%;border-collapse:collapse"><tr><th>Sucursal</th><th>Almacenamiento</th><th>Exhibición</th><th>Entrega simple</th></tr>${branchRows}</table><p><b>Políticas:</b> ${documents.find((document) => document.type === "policies")?.version || ""}<br/><b>Tarifario:</b> ${documents.find((document) => document.type === "tariff")?.version || ""}</p></div><style>th,td{border:1px solid #222;padding:7px;text-align:left}th{background:#eee}</style></main>`);
    const generatedPdf = await page.pdf({ format: "A4", printBackground: true }); await browser.close();
    const merged = await PDFDocument.create();
    const generated = await PDFDocument.load(generatedPdf); (await merged.copyPages(generated, generated.getPageIndices())).forEach((pdfPage) => merged.addPage(pdfPage));
    const annex = documents.find((document) => document.type === "annex_4");
    if (annex?.url) {
      try {
        const annexResponse = await fetch(annex.url);
        if (annexResponse.ok) {
          const annexPdf = await PDFDocument.load(await annexResponse.arrayBuffer());
          (await merged.copyPages(annexPdf, annexPdf.getPageIndices())).forEach((pdfPage) => merged.addPage(pdfPage));
        }
      } catch (annexError) { console.error("[contract-documents] No se pudo anexar Anexo 4", annexError); }
    }
    const pdf = Buffer.from(await merged.save());
    const fileName = `contrato-${safeFileName(`${seller.nombre}-${seller.apellido}`)}.pdf`;
    const s3Key = await storeGeneratedDocument(seller._id, fileName, pdf, "application/pdf");
    await ContractGenerationModel.create({ seller: seller._id, generatedBy: authId(res), kind: "contract", fileName, s3Key, inputs: input, documentVersions: documents.map((document) => ({ type: document.type, version: document.version, document: document._id })) });
    download(res, pdf, "application/pdf", fileName);
  } catch (error: any) { res.status(400).json({ success: false, message: error?.message || "No se pudo generar el contrato" }); }
};

export const getSellerSendDocuments = async (_req: Request, res: Response) => {
  const documents = await activeDocuments(["policies", "tariff", "prohibited_products", "annex_4"]);
  const selected = [
    documents.find((document) => document.type === "policies"),
    documents.find((document) => document.type === "tariff"),
    documents.find((document) => document.type === "prohibited_products") || documents.find((document) => document.type === "annex_4"),
  ].filter(Boolean).map((document: any) => ({ ...document, label: document.type === "annex_4" ? "Productos prohibidos" : label[document.type] }));
  res.json({ success: true, data: selected });
};

export const getSellerContractHistory = async (req: Request, res: Response) => {
  const history = await ContractGenerationModel.find({ seller: req.params.id })
    .sort({ createdAt: -1 })
    .populate("generatedBy", "email")
    .lean();
  res.json({ success: true, data: history });
};

export const getContractGenerationDownload = async (req: Request, res: Response) => {
  const generation = await ContractGenerationModel.findById(req.params.generationId).lean();
  if (!generation?.s3Key) return res.status(404).json({ success: false, message: "El archivo no está disponible en el almacenamiento privado" });
  const url = await getFileUrlFromAws(generation.s3Key, 300);
  res.json({ success: true, url });
};
