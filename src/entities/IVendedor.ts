import { Types } from 'mongoose';
import { IComprobanteEntrada } from "./IComprobanteEntrada";
import { IComprobantePago } from "./IComprobantePago";
import { IFlujoFinanciero } from "./IFlujoFinanciero";
import { IIngreso } from "./IIngreso";
import { IPedido } from "./IPedido";
import { IProducto } from "./IProducto";
import { ITrabajador } from "./ITrabajador";
import { IUser } from "./IUser";
import { IVenta } from "./IVenta";

export interface IVendedor {
    id_vendedor: string;
    marca: string;
    nombre: string;
    apellido: string;
    telefono: number;
    carnet: number;
    direccion: string;
    mail: string;
    
    pago_sucursales: {
      id_sucursal: string;
      sucursalName: string;
      alquiler: number;
      exhibicion: number;
      delivery: number;
      entrega_simple: number;
      fecha_ingreso: Date;
      fecha_salida?: Date;
      comentario?: string;
      activo?: boolean
    }[];

    comision_porcentual: number;
    comision_fija: number;
    fecha: Date;
    fecha_vigencia: Date;
    almacen_caja: number;
    deuda: number;
    emite_factura: boolean;

    saldo_pendiente: number;
    user: Types.ObjectId;
    comprobante_entrada?: Types.ObjectId[];
    comprobante_pago?: Types.ObjectId[];
    trabajador: Types.ObjectId;
    pedido?: Types.ObjectId[];
    producto?: Types.ObjectId[];
    venta: Types.ObjectId[];
    flujoFinanciero?: Types.ObjectId[];
    ingreso?: Types.ObjectId[];
}

