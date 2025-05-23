import { Schema, model, Types } from 'mongoose';

export const SucursalSchema = new Schema({
  nombre: {
    type: String,
    required: true
  },
  direccion: {
    type: String,
    required: true
  },
  ciudad: {
    type: String,
    required: true
  },
  telefono: {
    type: Number,
    required: true
  },
  pedido: [{
    type: Types.ObjectId,
    ref: 'Pedido'
  }],
  trabajador: [{
    type: Types.ObjectId,
    ref: 'Trabajador'
  }],
  ingreso: [{
    type: Types.ObjectId,
    ref: 'Ingreso'
  }],
  cierre_caja: [{
    type: Types.ObjectId,
    ref: 'CierreCaja'
  }]
}, {
  collection: 'Sucursal',
  timestamps: false
});

export const SucursalModel = model('Sucursal', SucursalSchema);
