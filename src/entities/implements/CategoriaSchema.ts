import { Schema, model, Types } from 'mongoose';

const CategoriaSchema = new Schema({
  categoria: {
    type: String,
    required: true,
  },
  producto: [{
    type: Types.ObjectId,
    ref: 'Producto' // nombre del modelo referenciado
  }]
}, {
  collection: 'Categoria',
  timestamps: true // opcional
});

export const CategoriaModel = model('Categoria', CategoriaSchema);
