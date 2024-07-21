import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ICategoria } from "../ICategoria";
import { IProducto } from "../IProducto";
import { ProductoEntity } from './ProductoEntity';

@Entity({name:'Categoria'})
export class CategoriaEntity implements ICategoria{
    
    @PrimaryGeneratedColumn()
    id_categoria!: number;

    @Column({type: 'varchar'})
    categoria!: string;

    @OneToMany(() => ProductoEntity, productoEntity => productoEntity.categoria)
    producto!: IProducto[];

}