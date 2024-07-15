import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IComprobanteEntrada } from "../IComprobanteEntrada";
import { IComprobantePago } from "../IComprobantePago";
import { IPedido } from "../IPedido";
import { IProducto } from "../IProducto";
import { ITrabajador } from "../ITrabajador";
import { IVendedor } from "../IVendedor";
import { ComprobanteEntradaEntity } from './ComprobanteEntradaEntity';
import { ComprobantePago } from '../../models/ComprobantePago';
import { TrabajadorEntity } from './TrabajadorEntity';
import { PedidoEntity } from './PedidoEntity';
import { ComprobantePagoEntity } from './ComprobantePagoEntity';

@Entity({name:'Vendedor'})
export class VendedorEntity implements IVendedor{
    
    @PrimaryGeneratedColumn()
    id_Vendedor!: number;

    @Column({type: 'varchar'})
    marca!: string;

    @Column({type: 'varchar'})
    nombre!: string;

    @Column({type: 'varchar'})
    apellido!: string;

    @Column()
    telefono!: number;

    @Column()
    carnet!: number;

    @Column()
    direccion!: string;

    @Column({type: 'varchar'})
    mail!: string;

    @Column()
    alquiler!: number;

    @Column()
    exhibicion!: number;

    @Column()
    delivery!: number;

    @Column()
    adelanto_servicio!: number;

    @Column()
    comision_porcentual!: number;

    @Column()
    comision_fija!: number;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha!: Date;
    
    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_vigencia!: Date;
    
    @Column()
    almacen_caja!: number;

    @Column()
    deuda!: number;

    // TODO PONER NULLABLE EN FALSE
    @Column({nullable:true})
    id_Trabajador!: number;

    @OneToMany(() => ComprobanteEntradaEntity, comprobanteEntradaEntity => comprobanteEntradaEntity.vendedor)
    comprobante_Entrada!: IComprobanteEntrada[];

    @OneToMany(() => ComprobantePagoEntity, comprobantePago => comprobantePago.vendedor)
    comprobante_Pago!: IComprobantePago[];

    @ManyToOne(() => TrabajadorEntity, trabajadorEntity => trabajadorEntity.vendedor)
    @JoinColumn({ name: 'id_Trabajador'})
    trabajador!: ITrabajador;

    @OneToMany(() => PedidoEntity, pedidoEntity => pedidoEntity.vendedor)
    pedido!: IPedido[];

    @OneToMany(() => PedidoEntity, pedidoEntity => pedidoEntity.vendedor)
    producto!: IProducto[];

}