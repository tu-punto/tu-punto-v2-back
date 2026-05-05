import { Schema, model, Types } from 'mongoose';
import { IFlujoFinancieroDocument } from '../documents/IFlujoFinancieroDocument';

const FlujoFinancieroSchema = new Schema({
  tipo: {
    type: String,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  concepto: {
    type: String,
    required: true
  },
  monto: {
    type: Number,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now,
    required: true
  },
  esDeuda: {
    type: Boolean,
    default: false
  },
  visible_en_flujo_general: {
    type: Boolean,
    default: true
  },
  descuento_porcentaje: {
    type: Number,
    default: 0
  },
  monto_sin_descuento: {
    type: Number,
    default: 0
  },
  detalle_servicios: [{
    _id: false,
    id_sucursal: {
      type: Types.ObjectId,
      ref: 'Sucursal',
      default: null
    },
    sucursalName: {
      type: String,
      default: ''
    },
    alquiler: {
      type: Number,
      default: 0
    },
    exhibicion: {
      type: Number,
      default: 0
    },
    entrega_simple: {
      type: Number,
      default: 0
    },
    delivery: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  }],
  founder: {
    type: String,
    default: 'N/A'
  },
  id_vendedor: {
    type: Types.ObjectId,
    ref: 'Vendedor',
    default: null
  },

  id_trabajador: {
    type: Types.ObjectId,
    ref: 'Trabajador',
    default: null
  },
  id_sucursal: {
    type: Types.ObjectId,
    ref: 'Sucursal',
    default: null
  }

}, {
  collection: 'Flujo_Financiero',
  timestamps: true
});

export const FlujoFinancieroModel = model<IFlujoFinancieroDocument>('FlujoFinanciero', FlujoFinancieroSchema);
