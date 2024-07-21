import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ICaracteristicas } from "../ICaracteristicas";
import { ICaracteristicas_Producto } from "../ICaracteristicas_Producto";
import { IProducto } from "../IProducto";
import { ProductoEntity } from './ProductoEntity';
import { CaracteristicasEntity } from './CaracteristicasEntity';

@Entity({name:'Caracteristicas_Producto'})
export class Caracteristicas_ProductoEntity implements ICaracteristicas_Producto{

    @PrimaryGeneratedColumn()
    public caracteristica_producto_id!: number

    @Column({nullable: false})
    value!: string;

    @ManyToOne( () => CaracteristicasEntity, (caracteristica) => caracteristica.caracteristicas_producto)
    @JoinColumn({
        name: "id_caracteristicas",
        referencedColumnName: "id_caracteristicas",
        foreignKeyConstraintName: "fk_car_id"
    })
    caracteristica!: CaracteristicasEntity

    @ManyToOne( () => ProductoEntity, (producto) => producto.caracteristicas_producto)
    @JoinColumn({
        name: "id_producto",
        referencedColumnName: "id_producto",
        foreignKeyConstraintName: "fk_prod_id"
    })
    producto!: ProductoEntity

    
}