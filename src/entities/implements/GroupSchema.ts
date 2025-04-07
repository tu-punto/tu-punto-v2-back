import { Schema, model, Types } from 'mongoose';

const GroupSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  products: [{
    type: Types.ObjectId,
    ref: 'Producto'
  }]
}, {
  collection: 'Group',
  timestamps: false
});

export const GroupModel = model('Group', GroupSchema);
