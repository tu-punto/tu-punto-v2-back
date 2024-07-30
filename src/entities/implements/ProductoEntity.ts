import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ICategoria } from "../ICategoria";
import { IProducto } from "../IProducto";
import { IProducto_Sucursal } from "../IProducto_Sucursal";
import { IVendedor } from "../IVendedor";
import { IVenta } from "../IVenta";
import { VendedorEntity } from './VendedorEntity';
import { CategoriaEntity } from './CategoriaEntity';
import { VentaEntity } from './VentaEntity';
import { Producto_SucursalEntity } from './Producto_SucursalEntity';
import { ICaracteristicas } from '../ICaracteristicas';
import { CaracteristicasEntity } from './CaracteristicasEntity';
import { GroupEntity } from './GroupEntity';

@Entity({name:'Producto'})
export class ProductoEntity implements IProducto{
    
    @PrimaryGeneratedColumn()
    id_producto!: number;
    
    @Column({type: 'varchar'})
    nombre_producto!: string;
    
    @Column()
    precio!: number;
    
    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_de_ingreso!: Date;
    
    @Column({type: 'varchar', default: ""})
    imagen!: string;
    
    @Column({nullable:false})
    id_categoria!: number;
    
    @Column({nullable:false})
    id_vendedor!: number;

    @ManyToOne(() => VendedorEntity, vendedorEntity => vendedorEntity.producto)
    @JoinColumn({ name: 'id_vendedor'})
    vendedor!: IVendedor;

    @OneToMany( () => CaracteristicasEntity, features => features.product)
    features!: ICaracteristicas[];

    @ManyToOne(() => CategoriaEntity, categoriaEntity => categoriaEntity.producto)
    @JoinColumn({ name: 'id_categoria'})
    categoria!: ICategoria;

    @OneToMany(() => VentaEntity, ventaEntity => ventaEntity.producto)
    venta!: IVenta[];

    @OneToMany(() => Producto_SucursalEntity, producto_SucursalEntity => producto_SucursalEntity.producto)
    producto_sucursal!: IProducto_Sucursal[];

    @ManyToOne( () => GroupEntity, group => group.products)
    group!: GroupEntity

    @Column({nullable: true})
    groupId!: number

}