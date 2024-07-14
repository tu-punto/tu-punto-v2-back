import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IPedido } from "../IPedido";
import { ISucursal } from "../ISucursal";
import { ITrabajador } from "../ITrabajador";
import { IVendedor } from "../IVendedor";
import { IVenta } from "../IVenta";
import { VentaEntity } from './VentaEntity';
import { SucursalEntity } from './SucursalEntity';
import { VendedorEntity } from './VendedorEntity';
import { TrabajadorEntity } from './TrabajadorEntity';

@Entity({name:'Pedido'})
export class PedidoEntity implements IPedido{
    
    @PrimaryGeneratedColumn()
    id_Pedido!: number;

    @Column({type: 'varchar'})
    tipo_De_Pago!: string;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_Pedido!: Date;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    hora_Entrega_Acordada!: Date;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    hora_Entrega_Real!: Date;

    @Column({type: 'varchar'})
    observaciones!: string;

    @Column({type: 'varchar'})
    lugar_Entrega!: string;

    @Column()
    costo_Delivery!: number;

    @Column()
    cargo_Delivery!: number;

    @Column({type: 'varchar'})
    estado_Pedido!: string;

    @Column()
    adelanto_Cliente!: number;

    @Column()
    pagado_Al_Vendedor!: number;

    @Column()
    subtotal_Qr!: number;

    @Column()
    subtotal_Efectivo!: number;

    @Column({nullable:false})  
    id_Vendedor!: number;

    @Column({nullable:false})  
    id_Trabajador!: number;

    @Column({nullable:false})  
    id_Sucursal!: number;

    @OneToMany(() => VentaEntity, ventaEntity => ventaEntity.pedido)
    venta!: IVenta[];

    @OneToMany(() => SucursalEntity, sucursalEntity => sucursalEntity.pedido)
    @JoinColumn({ name: 'id_Sucursal'})
    sucursal!: ISucursal[];

    @ManyToOne(() => VendedorEntity, vendedorEntity => vendedorEntity.pedido)  
    @JoinColumn({ name: 'id_Vendedor'})
    vendedor!: IVendedor;

    @ManyToOne(() => TrabajadorEntity, trabajadorEntity => trabajadorEntity.pedido)
    @JoinColumn({ name: 'id_Trabajador'})
    trabajador!: ITrabajador;

}