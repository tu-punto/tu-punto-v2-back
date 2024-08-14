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
    id_pedido!: number;

    @Column({type: 'varchar'})
    cliente!: string;

    @Column({default : 0})
    telefono_cliente!: number;

    @Column({type: 'varchar'})
    tipo_de_pago!: string;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_pedido!: Date;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    hora_entrega_acordada!: Date;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    hora_entrega_real!: Date;

    @Column({type: 'varchar', default: ""})
    observaciones!: string;

    @Column({type: 'varchar'})
    lugar_entrega!: string;

    @Column({type: 'decimal', precision: 10, scale: 2, default: 0})
    costo_delivery!: number;

    @Column({type: 'decimal', precision: 10, scale: 2, default: 0})
    cargo_delivery!: number;

    @Column({type: 'varchar'})
    estado_pedido!: string;

    @Column({default: 0})
    adelanto_cliente!: number;

    @Column({default: false})
    pagado_al_vendedor!: boolean;

    @Column({default: 0})
    subtotal_qr!: number;

    @Column({default: 0})
    subtotal_efectivo!: number;

    @Column({nullable:true})  
    id_trabajador!: number;

    @Column({nullable:true})  
    id_sucursal!: number;

    @OneToMany(() => VentaEntity, ventaEntity => ventaEntity.pedido)
    venta!: IVenta[];

    @ManyToOne(() => SucursalEntity, sucursalEntity => sucursalEntity.pedido)
    @JoinColumn({ name: 'id_sucursal'})
    sucursal!: ISucursal[];

    @ManyToOne(() => TrabajadorEntity, trabajadorEntity => trabajadorEntity.pedido)
    @JoinColumn({ name: 'id_trabajador'})
    trabajador!: ITrabajador;

}