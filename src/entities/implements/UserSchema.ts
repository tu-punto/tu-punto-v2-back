import { Schema, model, Types } from 'mongoose';

const UserSchema = new Schema({
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
    type: Types.ObjectId,
    ref: 'Vendedor',
    required: false
  },
  trabajador: {
    type: Types.ObjectId,
    ref: 'Trabajador',
    required: false
  }
}, {
  collection: 'User',
  timestamps: false
});

export const UserModel = model('User', UserSchema);
