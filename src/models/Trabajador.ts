import { IPedido } from "../entities/IPedido";
import { ITrabajador } from "../entities/ITrabajador";
import { IVendedor } from "../entities/IVendedor";

export class Trabajador{
    id_Trabajador: number;
    nombre: string;
    numero: number;
    rol: string;
    estado: string;

    vendedor?: IVendedor[];
    pedido?: IPedido[];

    constructor(iTrabajador: ITrabajador){
        this.id_Trabajador= iTrabajador.id_Trabajador;
        this.nombre= iTrabajador.nombre;
        this.numero= iTrabajador.numero;
        this.rol= iTrabajador.rol;
        this.estado= iTrabajador.estado;
        this.vendedor= iTrabajador.vendedor;
        this.pedido= iTrabajador.pedido;
    }
}