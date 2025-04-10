import { Schema, model, Types } from 'mongoose';
import { IProductoSucursalDocument } from '../documents/IProductoSucursal';

const ProductoSucursalSchema = new Schema({
  id_producto: {
    type: Types.ObjectId,
    ref: 'Producto',  
    required: true
  },
  id_sucursal: {
    type: Types.ObjectId,
    ref: 'Sucursal',  
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

export const ProductoSucursalModel = model<IProductoSucursalDocument>('Producto_Sucursal', ProductoSucursalSchema);
