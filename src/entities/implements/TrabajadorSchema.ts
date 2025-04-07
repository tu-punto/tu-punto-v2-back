import { Schema, model, Types } from 'mongoose';

const TrabajadorSchema = new Schema({
  nombre: {
    type: String,
    required: true
  },
  numero: {
    type: Number,
    required: true
  },
  rol: {
    type: String,
    required: true
  },
  estado: {
    type: String,
    required: true
  },
  user: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendedor: [{
    type: Types.ObjectId,
    ref: 'Vendedor'
  }],
  pedido: [{
    type: Types.ObjectId,
    ref: 'Pedido'
  }],
  flujoFinanciero: [{
    type: Types.ObjectId,
    ref: 'FlujoFinanciero'
  }],
  sucursal: [{
    type: Types.ObjectId,
    ref: 'Sucursal'
  }]
}, {
  collection: 'Trabajador',
  timestamps: false
});

export const TrabajadorModel = model('Trabajador', TrabajadorSchema);
