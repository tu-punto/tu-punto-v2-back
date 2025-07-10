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
  sucursal: {
    type: Schema.Types.ObjectId,
    ref: "Sucursal",
    required: false
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

UserSchema.index({ email: 1 }); 
UserSchema.index({ role: 1 }); 
UserSchema.index({ createdAt: -1 }); 

export const UserModel = model<IUserDocument>('User', UserSchema);
