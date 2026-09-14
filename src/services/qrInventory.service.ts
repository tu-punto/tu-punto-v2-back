import ExcelJS from "exceljs";
import { Types } from "mongoose";
import { QRInventoryEventModel, QRInventoryModel } from "../entities/implements/QRInventorySchema";
import { ProductVariantQRService } from "./productVariantQR.service";
import { ProductoModel } from "../entities/implements/ProductoSchema";

type Actor = { id: string; name?: string };
const ensureId = (id: string, label: string) => { if (!Types.ObjectId.isValid(id)) throw new Error(`${label} invalido`); };
const rowView = (row: any) => ({ ...row.toObject?.() || row, variantes: Object.fromEntries((row.variantes instanceof Map ? row.variantes : new Map(Object.entries(row.variantes || {}))).entries()) });
const view = (inventory: any) => {
  const data = inventory.toObject?.() || inventory;
  return { ...data, rows: (data.rows || []).map(rowView).sort((a: any, b: any) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()) };
};

const getEditable = async (id: string) => {
  ensureId(id, "inventario");
  const inventory = await QRInventoryModel.findById(id);
  if (!inventory) throw new Error("Inventario no encontrado");
  if (inventory.status !== "open") throw new Error(inventory.status === "paused" ? "El inventario esta pausado" : "El inventario esta cerrado");
  return inventory;
};

const getCurrent = async (sucursalId: string) => {
  ensureId(sucursalId, "sucursal");
  return QRInventoryModel.findOne({ sucursalId, status: { $in: ["open", "paused"] } }).sort({ updatedAt: -1 });
};

const create = async (sucursalId: string, actor: Actor) => {
  const existing = await getCurrent(sucursalId);
  if (existing) return view(existing);
  ensureId(actor.id, "usuario");
  const products = await ProductoModel.find({ "sucursales.id_sucursal": new Types.ObjectId(sucursalId) }).select("_id sucursales").lean();
  const stockSnapshot = products.flatMap((product: any) => {
    const branch = (product.sucursales || []).find((item: any) => String(item.id_sucursal) === sucursalId);
    return (branch?.combinaciones || []).filter((item: any) => item.variantKey).map((item: any) => ({ productId: product._id, variantKey: String(item.variantKey), stock: Number(item.stock || 0) }));
  });
  const inventory = await QRInventoryModel.create({ sucursalId, createdBy: actor.id, createdByName: actor.name || "", startedAt: new Date(), stockSnapshot });
  await QRInventoryEventModel.create({ inventoryId: inventory._id, type: "created", actorId: actor.id, actorName: actor.name || "" });
  return view(inventory);
};

const getByBranch = async (sucursalId: string, includeClosed = true) => {
  ensureId(sucursalId, "sucursal");
  const query: any = { sucursalId };
  if (!includeClosed) query.status = { $in: ["open", "paused"] };
  const inventory = await QRInventoryModel.findOne(query).sort({ updatedAt: -1 });
  return inventory ? view(inventory) : null;
};

const scan = async (inventoryId: string, payload: string, actor: Actor) => {
  const inventory = await getEditable(inventoryId);
  const item = await ProductVariantQRService.resolveVariantQRPayload(payload, String(inventory.sucursalId));
  if (!item || String(item.sucursalId) !== String(inventory.sucursalId)) throw new Error("El QR no pertenece a la sucursal de este inventario");
  const now = new Date();
  let row = inventory.rows.find((candidate: any) => String(candidate.productId) === item.id_producto && candidate.variantKey === item.variantKey);
  const previousCount = Number(row?.countedStock || 0);
  const snapshot = (inventory.stockSnapshot || []).find((entry: any) => String(entry.productId) === item.id_producto && entry.variantKey === item.variantKey);
  const initialStock = snapshot ? Number(snapshot.stock || 0) : Number(item.stock || 0);
  if (row) {
    row.countedStock = previousCount + 1;
    row.lastModifiedAt = now; row.lastModifiedBy = actor.id; row.lastModifiedByName = actor.name || "";
  } else {
    row = inventory.rows.create({ productId: item.id_producto, sellerId: item.id_vendedor, productName: item.nombre_producto, categoryName: "", variantKey: item.variantKey, variantLabel: item.variantLabel, variantes: item.variantes, price: item.precio, initialStock, countedStock: 1, lastModifiedAt: now, lastModifiedBy: actor.id, lastModifiedByName: actor.name || "" });
    inventory.rows.push(row);
  }
  inventory.version += 1; await inventory.save();
  await QRInventoryEventModel.create({ inventoryId, rowId: row._id, type: "scan", actorId: actor.id, actorName: actor.name || "", previousCount, nextCount: row.countedStock });
  return view(inventory);
};

const correct = async (inventoryId: string, rowId: string, countedStock: number, reason: string, actor: Actor) => {
  const inventory = await getEditable(inventoryId);
  const row = inventory.rows.id(rowId); if (!row) throw new Error("Fila no encontrada");
  const nextCount = Math.max(0, Math.floor(Number(countedStock))); if (!Number.isFinite(nextCount)) throw new Error("Cantidad invalida");
  const previousCount = Number(row.countedStock || 0); row.countedStock = nextCount; row.lastModifiedAt = new Date(); row.lastModifiedBy = actor.id; row.lastModifiedByName = actor.name || "";
  inventory.version += 1; await inventory.save();
  await QRInventoryEventModel.create({ inventoryId, rowId: row._id, type: "correction", actorId: actor.id, actorName: actor.name || "", previousCount, nextCount, reason: String(reason || "") });
  return view(inventory);
};

const transition = async (inventoryId: string, status: "paused" | "open" | "closed", actor: Actor) => {
  ensureId(inventoryId, "inventario"); const inventory = await QRInventoryModel.findById(inventoryId); if (!inventory) throw new Error("Inventario no encontrado");
  if (inventory.status === "closed") throw new Error("El inventario ya esta cerrado");
  inventory.status = status; inventory.version += 1;
  if (status === "paused") inventory.pausedAt = new Date();
  if (status === "closed") { inventory.closedAt = new Date(); inventory.closedBy = actor.id; inventory.closedByName = actor.name || ""; }
  await inventory.save(); await QRInventoryEventModel.create({ inventoryId, type: status === "open" ? "resumed" : status, actorId: actor.id, actorName: actor.name || "" });
  return view(inventory);
};

const exportReport = async (inventoryId: string) => {
  ensureId(inventoryId, "inventario"); const inventory = await QRInventoryModel.findById(inventoryId); if (!inventory) throw new Error("Inventario no encontrado");
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet("Inventario QR");
  sheet.columns = ["Producto", "Variante", "Stock al iniciar", "Contado", "Diferencia", "Ultima actualizacion", "Ultimo usuario"].map((header) => ({ header, key: header, width: 24 }));
  view(inventory).rows.forEach((row: any) => sheet.addRow({ Producto: row.productName, Variante: row.variantLabel, "Stock al iniciar": row.initialStock, Contado: row.countedStock, Diferencia: row.countedStock - row.initialStock, "Ultima actualizacion": row.lastModifiedAt, "Ultimo usuario": row.lastModifiedByName }));
  sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  return { buffer: Buffer.from(await book.xlsx.writeBuffer() as ArrayBuffer), filename: `inventario_qr_${String(inventory.sucursalId)}_${Date.now()}.xlsx` };
};
export const QRInventoryService = { create, getByBranch, scan, correct, transition, exportReport };
