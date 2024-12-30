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

    @Column({ type: 'varchar', nullable: false })
    tipo!: string;

    @Column({ type: 'varchar', nullable: false })
    categoria!: string;

    @Column({ type: 'varchar', nullable: false })
    concepto!: string;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: false })
    monto!: number;

    @Column({ type: 'timestamptz',nullable: false, default: () => 'CURRENT_TIMESTAMP(6)' })
    fecha!: Date;

    @Column({ default: false })
    esDeuda!: boolean

    @Column({ nullable: true, default: null })
    id_vendedor!: number;

    @Column({ nullable: true, default: null })
    id_trabajador!: number;

    @ManyToOne(() => VendedorEntity, vendedorEntity => vendedorEntity.flujoFinanciero)
    @JoinColumn({
        name: 'id_vendedor',
        referencedColumnName: 'id_vendedor',
        foreignKeyConstraintName: 'fk_vend_id'

    })
    vendedor!: IVendedor;

    @ManyToOne(() => TrabajadorEntity, trabajadorEntity => trabajadorEntity.flujoFinanciero)
    @JoinColumn({
        name: 'id_trabajador',
        referencedColumnName: 'id_trabajador',
        foreignKeyConstraintName: 'fk_trabaj_id'
    })
    trabajador!: ITrabajador;

}