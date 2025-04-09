import { Schema, model, Types } from 'mongoose';

export const VendedorSchema = new Schema({
  marca: {
    type: String,
    required: true
  },
  nombre: {
    type: String,
    required: true
  },
  apellido: {
    type: String,
    required: true
  },
  telefono: {
    type: Number,
    required: true
  },
  carnet: {
    type: Number,
    required: true
  },
  direccion: {
    type: String,
    required: true
  },
  mail: {
    type: String,
    required: true
  },
  alquiler: {
    type: Number,
    default: 0
  },
  exhibicion: {
    type: Number,
    default: 0
  },
  delivery: {
    type: Number,
    default: 0
  },
  adelanto_servicio: {
    type: Number,
    default: 0
  },
  comision_porcentual: {
    type: Number,
    default: 0
  },
  comision_fija: {
    type: Number,
    default: 0
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  fecha_vigencia: {
    type: Date,
    default: Date.now
  },
  almacen_caja: {
    type: Number,
    required: false
  },
  deuda: {
    type: Number,
    default: 0
  },
  emite_factura: {
    type: Boolean,
    default: false
  },
  comprobante_entrada: [{
    type: Types.ObjectId,
    ref: 'ComprobanteEntrada'
  }],
  comprobante_pago: [{
    type: Types.ObjectId,
    ref: 'ComprobantePago'
  }],
  trabajador: {
    type: Types.ObjectId,
    ref: 'Trabajador'
  },
  venta: [{
    type: Types.ObjectId,
    ref: 'Venta'
  }],
  producto: [{
    type: Types.ObjectId,
    ref: 'Producto'
  }],
  flujoFinanciero: [{
    type: Types.ObjectId,
    ref: 'FlujoFinanciero'
  }],
  ingreso: [{
    type: Types.ObjectId,
    ref: 'Ingreso'
  }],
  user: {
    type: Types.ObjectId,
    ref: 'User'
  }
}, {
  collection: 'Vendedor',
  timestamps: false
});

export const VendedorModel = model('Vendedor', VendedorSchema);
