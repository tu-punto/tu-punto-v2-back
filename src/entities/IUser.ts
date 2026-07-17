import { Types } from 'mongoose';
import { ITrabajador } from "./ITrabajador";
import { IVendedor } from "./IVendedor";
import { UserRole } from "../constants/roles";

export interface IUserAccessWindow {
  enabled: boolean;
  start: string;
  end: string;
}

export interface IUserAccessHours {
  weekdays?: IUserAccessWindow;
  saturday?: IUserAccessWindow;
  sunday?: IUserAccessWindow;
}

export interface IUser {
  email: string;
  password: string;
  role: UserRole;
  sucursal: Types.ObjectId;
  vendedor: Types.ObjectId;
  trabajador: Types.ObjectId;
  must_change_password?: boolean;
  password_changed_at?: Date;
  failed_login_attempts?: number;
  login_locked_until?: Date | null;
  system_access_hours?: IUserAccessHours;
}
