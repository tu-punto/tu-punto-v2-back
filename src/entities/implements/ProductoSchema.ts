import mongoose, { Schema, model } from "mongoose";
import { IProductoDocument } from "../documents/IProductoDocument";

// Subdocumentos
const VarianteSchema = new Schema({
  nombre_variante: { type: String, required: true },
  precio: { type: Number, required: true },
  stock: { type: Number, required: true }
}, { _id: false });

const SucursalProductoSchema = new Schema({
  id_sucursal: { type: Schema.Types.ObjectId, ref: 'Sucursal', required: true },
  variantes: [VarianteSchema]
}, { _id: false });

// Modelo principal
const ProductoSchema = new Schema({
  nombre_producto: { type: String, required: true },
  //precio: { type: Number, required: false },
  fecha_de_ingreso: { type: Date, default: Date.now },
  imagen: { type: String, default: "" },
  id_categoria: { type: Schema.Types.ObjectId, required: true },
  id_vendedor: { type: Schema.Types.ObjectId, required: true },

  vendedor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendedor' },
  features: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Caracteristicas' }],
  categoria: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria' },
  venta: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Venta' }],
  ingreso: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ingreso' }],
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  groupId: { type: Number },

  sucursales: [SucursalProductoSchema]

}, { timestamps: true });

export const ProductoModel = model<IProductoDocument>("Producto", ProductoSchema);
