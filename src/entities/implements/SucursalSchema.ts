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
  delivery_cutoff_enabled: {
    type: Boolean,
    default: false
  },
  delivery_cutoff_weekdays_registration_time: {
    type: String,
    default: ""
  },
  delivery_cutoff_weekdays_closing_time: {
    type: String,
    default: ""
  },
  delivery_cutoff_saturday_registration_time: {
    type: String,
    default: ""
  },
  delivery_cutoff_saturday_closing_time: {
    type: String,
    default: ""
  },
  delivery_cutoff_sunday_registration_time: {
    type: String,
    default: ""
  },
  delivery_cutoff_sunday_closing_time: {
    type: String,
    default: ""
  },
  delivery_cutoff_start_time: {
    type: String,
    default: ""
  },
  delivery_cutoff_end_time: {
    type: String,
    default: ""
  },
  delivery_cutoff_time: {
    type: String,
    default: ""
  },
  imagen_header: {
    type: String,
    default: ""
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
