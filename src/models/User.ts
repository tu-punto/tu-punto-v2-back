import { ITrabajador } from "../entities/ITrabajador";
import { IUser } from "../entities/IUser";
import { IVendedor } from "../entities/IVendedor";

export class User implements IUser {
  id_user: number;
  email: string;
  password: string;
  role: string;

  vendedor: IVendedor;
  trabajador: ITrabajador;

  constructor(iUser: IUser) {
    this.id_user = iUser.id_user;
    this.email = iUser.email;
    this.password = iUser.password;
    this.role = iUser.role;
    this.vendedor = iUser.vendedor;
    this.trabajador = iUser.trabajador;
  }
}
