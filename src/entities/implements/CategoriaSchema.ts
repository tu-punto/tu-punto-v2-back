import { Schema, model, Types } from 'mongoose';
import { ICategoriaDocument } from '../documents/ICategoriaDocument';
const CategoriaSchema = new Schema<ICategoriaDocument>({
  categoria: {
    type: String,
    required: true,
  },
  producto: [{
    type: Types.ObjectId,
    ref: 'Producto' 
  }]
}, {
  collection: 'Categoria',
  timestamps: true 
});

export const CategoriaModel = model<ICategoriaDocument>('Categoria', CategoriaSchema);