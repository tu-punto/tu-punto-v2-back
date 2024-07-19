import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IIngreso } from "../IIngreso";
import { IProducto } from "../IProducto";
import { IProducto_Sucursal } from "../IProducto_Sucursal";
import { ISucursal } from "../ISucursal";
import { ProductoEntity } from './ProductoEntity';
import { SucursalEntity } from './SucursalEntity';
import { IngresoEntity } from './IngresoEntity';

@Entity({name:'Producto_Sucursal'})
export class Producto_SucursalEntity implements IProducto_Sucursal{
    
    @PrimaryColumn({nullable:false})
    id_Producto!: number;

    @PrimaryColumn({nullable:false})
    id_Sucursal!: number;

    @Column({nullable:false})
    id_Ingreso!: number;

    @Column()
    cantidad_Por_Sucursal!: number;
    
    @Column()
    numero_Caja!: number;

    @ManyToOne(() => ProductoEntity, productoEntity => productoEntity.producto_Sucursal)
    @JoinColumn({ name: 'id_Producto'})
    producto!: IProducto;
    
    @ManyToOne(() => SucursalEntity, sucursalEntity => sucursalEntity.producto_Sucursal)
    @JoinColumn({ name: 'id_Sucursal'})
    sucursal!: ISucursal;

    

}