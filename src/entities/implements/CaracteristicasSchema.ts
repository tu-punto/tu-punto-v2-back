import { Schema, model, Types } from 'mongoose';

const CaracteristicasSchema = new Schema({
  feature: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  product: {
    type: Types.ObjectId,
    ref: 'Producto', // nombre del modelo referenciado
    required: true,
  }
}, {
  collection: 'Caracteristicas',
  timestamps: true // opcional: si quieres createdAt y updatedAt
});

export const CaracteristicasModel = model('Caracteristicas', CaracteristicasSchema);
