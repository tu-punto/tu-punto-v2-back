import { IPedido } from "../entities/IPedido";
import { ITrabajador } from "../entities/ITrabajador";
import { IVendedor } from "../entities/IVendedor";

export class Trabajador{
    id_trabajador: number;
    nombre: string;
    numero: number;
    rol: string;
    estado: string;

    vendedor?: IVendedor[];
    pedido?: IPedido[];

    constructor(iTrabajador: ITrabajador){
        this.id_trabajador= iTrabajador.id_trabajador;
        this.nombre= iTrabajador.nombre;
        this.numero= iTrabajador.numero;
        this.rol= iTrabajador.rol;
        this.estado= iTrabajador.estado;
        this.vendedor= iTrabajador.vendedor;
        this.pedido= iTrabajador.pedido;
    }
}