import { Schema, model, Types } from 'mongoose';

const ProductoSucursalSchema = new Schema({
  id_producto: {
    type: Types.ObjectId,
    ref: 'Producto',  // Referencia al modelo de Producto
    required: true
  },
  id_sucursal: {
    type: Types.ObjectId,
    ref: 'Sucursal',  // Referencia al modelo de Sucursal
    required: true
  },
  cantidad_por_sucursal: {
    type: Number,
    required: true
  },
  numero_caja: {
    type: Number,
    default: 0
  }
}, {
  collection: 'Producto_Sucursal',
  timestamps: false
});

export const ProductoSucursalModel = model('Producto_Sucursal', ProductoSucursalSchema);
