import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IIngreso } from "../IIngreso";
import { IProducto_Sucursal } from "../IProducto_Sucursal";
import { Producto_SucursalEntity } from './Producto_SucursalEntity';

@Entity({name:'Ingreso'})
export class IngresoEntity implements IIngreso{

    @PrimaryGeneratedColumn()
    id_Ingreso!: number;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_Ingreso!: Date;
    
    @Column({type: 'varchar'})
    estado!: string;

    @OneToMany(() => Producto_SucursalEntity, producto_SucursalEntity => producto_SucursalEntity.ingreso)
    producto_Sucursal!: IProducto_Sucursal[];

}