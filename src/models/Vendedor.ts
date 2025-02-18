import { IComprobanteEntrada } from "../entities/IComprobanteEntrada";
import { IComprobantePago } from "../entities/IComprobantePago";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { IIngreso } from "../entities/IIngreso";
import { IPedido } from "../entities/IPedido";
import { IProducto } from "../entities/IProducto";
import { ITrabajador } from "../entities/ITrabajador";
import { IUser } from "../entities/IUser";
import { IVendedor } from "../entities/IVendedor";
import { IVenta } from "../entities/IVenta";

export class Vendedor {
  id_vendedor: number;
  marca: string;
  nombre: string;
  apellido: string;
  telefono: number;
  carnet: number;
  direccion: string;
  mail: string;
  alquiler: number;
  exhibicion: number;
  delivery: number;
  adelanto_servicio: number;
  comision_porcentual: number;
  comision_fija: number;
  fecha: Date;
  fecha_vigencia: Date;
  almacen_caja: number;
  deuda: number;
  emite_factura: boolean;

  user: IUser;
  comprobante_entrada?: IComprobanteEntrada[];
  comprobante_pago?: IComprobantePago[];
  trabajador: ITrabajador;
  pedido?: IPedido[];
  producto?: IProducto[];
  flujoFinanciero?: IFlujoFinanciero[];
  venta: IVenta[];
  ingreso?: IIngreso[];

  constructor(iVendedor: IVendedor) {
    this.id_vendedor = iVendedor.id_vendedor;
    this.marca = iVendedor.marca;
    this.nombre = iVendedor.nombre;
    this.apellido = iVendedor.apellido;
    this.telefono = iVendedor.telefono;
    this.carnet = iVendedor.carnet;
    this.direccion = iVendedor.direccion;
    this.mail = iVendedor.mail;
    this.alquiler = iVendedor.alquiler;
    this.exhibicion = iVendedor.exhibicion;
    this.delivery = iVendedor.delivery;
    this.adelanto_servicio = iVendedor.adelanto_servicio;
    this.comision_porcentual = iVendedor.comision_porcentual;
    this.comision_fija = iVendedor.comision_fija;
    this.fecha = iVendedor.fecha;
    this.fecha_vigencia = iVendedor.fecha_vigencia;
    this.almacen_caja = iVendedor.almacen_caja;
    this.deuda = iVendedor.deuda;
    this.emite_factura = iVendedor.emite_factura;

    this.user = iVendedor.user;
    this.comprobante_entrada = iVendedor.comprobante_entrada;
    this.comprobante_pago = iVendedor.comprobante_pago;
    this.trabajador = iVendedor.trabajador;
    this.pedido = iVendedor.pedido;
    this.producto = iVendedor.producto;
    this.flujoFinanciero = iVendedor.flujoFinanciero;
    this.venta = iVendedor.venta;
    this.ingreso = iVendedor.ingreso;
  }
}
