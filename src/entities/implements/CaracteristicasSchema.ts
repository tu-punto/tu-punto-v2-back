import { Schema, model, Types } from 'mongoose';
import { ICaracteristicasDocument } from '../documents/ICaracteristicasDocument';

const CaracteristicasSchema = new Schema<ICaracteristicasDocument>({
  feature: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Producto', 
    required: true,
  }
}, {
  collection: 'Caracteristicas',
  timestamps: true 
});

export const CaracteristicasModel = model<ICaracteristicasDocument>('Caracteristicas', CaracteristicasSchema);
