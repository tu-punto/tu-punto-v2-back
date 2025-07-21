import { Schema, model, Types } from 'mongoose';

export const VendedorSchema = new Schema({
  marca: {
    type: String,
    required: false
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
    required: false
  },
  mail: {
    type: String,
    required: true
  },

  saldo_pendiente: {
    type: Number,
    default: 0,
  },
  deuda: {
    type: Number,
    default: 0
  },

  pago_sucursales: [{
    id_sucursal: {
      type: Types.ObjectId,
      ref: 'Sucursal',
      required: true
    },
    sucursalName: {
      type: String,
      default: 0
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
    entrega_simple: {
      type: Number,
      default: 0
    },
    fecha_ingreso: {
      type: Date, 
      default: Date.now
    },
    fecha_salida: {
      type: Date,
    },
    comentario: {
      type: String,
    }, 
    activo: {
      type: Boolean,
      default: true
    }
  }],

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
