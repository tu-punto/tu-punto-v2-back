import { Schema, model, Types } from 'mongoose';
import { IUserDocument } from '../documents/IUserDocument';

const UserSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  vendedor: {
    type: Schema.Types.ObjectId,
    ref: 'Vendedor',
    required: false
  },
  trabajador: {
    type: Schema.Types.ObjectId,
    ref: 'Trabajador',
    required: false
  }
}, {
  collection: 'User',
  timestamps: false
});

export const UserModel = model<IUserDocument>('User', UserSchema);
