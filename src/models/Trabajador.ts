import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { IPedido } from "../entities/IPedido";
import { ISucursal } from "../entities/ISucursal";
import { ITrabajador } from "../entities/ITrabajador";
import { IUser } from "../entities/IUser";
import { IVendedor } from "../entities/IVendedor";

export class Trabajador {
  id_trabajador: number;
  nombre: string;
  numero: number;
  rol: string;
  estado: string;

  user: IUser;
  vendedor?: IVendedor[];
  pedido?: IPedido[];
  flujoFinanciero?: IFlujoFinanciero[];
  sucursal: ISucursal[];

  constructor(iTrabajador: ITrabajador) {
    this.id_trabajador = iTrabajador.id_trabajador;
    this.nombre = iTrabajador.nombre;
    this.numero = iTrabajador.numero;
    this.rol = iTrabajador.rol;
    this.estado = iTrabajador.estado;
    this.user = iTrabajador.user;
    this.vendedor = iTrabajador.vendedor;
    this.pedido = iTrabajador.pedido;
    this.flujoFinanciero = iTrabajador.flujoFinanciero;
    this.sucursal = iTrabajador.sucursal;
  }
}
