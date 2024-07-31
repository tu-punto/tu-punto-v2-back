import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { IFlujoFinanciero } from "../IFlujoFinanciero";
import { ITrabajador } from "../ITrabajador";
import { IVendedor } from "../IVendedor";
import { VendedorEntity } from "./VendedorEntity";
import { TrabajadorEntity } from "./TrabajadorEntity";

@Entity({ name: 'Flujo_Financiero' })
export class FlujoFinancieroEntity implements IFlujoFinanciero {
    @PrimaryGeneratedColumn()
    id_flujo_financiero!: number;

    @Column({type: 'varchar'})
    tipo!: string;

    @Column({type: 'varchar'})
    categoria!: string;

    @Column({type: 'varchar'})
    concepto!: string;

    @Column()
    monto!: number;

    @Column()
    fecha!: Date;

    @ManyToOne(() => VendedorEntity, vendedorEntity => vendedorEntity.flujoFinanciero)
    @JoinColumn({name: 'id_vendedor'})
    vendedor!: IVendedor;

    @ManyToOne(() => TrabajadorEntity, trabajadorEntity => trabajadorEntity.flujoFinanciero)
    @JoinColumn({name: 'id_trabajador'})
    trabajador!: ITrabajador;

}