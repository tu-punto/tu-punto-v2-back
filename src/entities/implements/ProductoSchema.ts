
import mongoose, { Schema, Document } from "mongoose";

const ProductoSchema = new Schema({
  nombre_producto: { type: String, required: true },
  precio: { type: Number, required: true },
  fecha_de_ingreso: { type: Date, default: Date.now },
  imagen: { type: String, default: "" },
  id_categoria: { type: Number, required: true }, // o usar ref si es otro modelo
  id_vendedor: { type: Number, required: true },

  vendedor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendedor' },
  features: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Caracteristicas' }],
  categoria: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria' },
  venta: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Venta' }],
  producto_sucursal: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductoSucursal' }],
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  groupId: { type: Number },
  ingreso: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ingreso' }],
}, {
  timestamps: true,
});

export const ProductoModel = mongoose.model("Producto", ProductoSchema);



 