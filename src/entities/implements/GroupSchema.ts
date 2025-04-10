import { Schema, model, Types } from 'mongoose';
import { IGroupDocument } from '../documents/IGroupDocument';

const GroupSchema = new Schema<IGroupDocument>({
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
  timestamps: true
});

export const GroupModel = model<IGroupDocument>('Group', GroupSchema);
