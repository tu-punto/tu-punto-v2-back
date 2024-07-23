import { Column, Entity, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { IGroup } from "../IGroup";
import { ProductoEntity } from "./ProductoEntity";


@Entity({name: "Group"})
export class GroupEntity implements IGroup{
    
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;
    
    @OneToMany(() => ProductoEntity, (product) => product.group)
    products!: ProductoEntity[]
}