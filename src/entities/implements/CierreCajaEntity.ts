import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { EfectivoDiarioEntity } from "./EfectivoDiarioEntity";
import { ICierreCaja } from "../ICierreCaja";
import { SucursalEntity } from "./SucursalEntity";

@Entity({ name: "Cierre_Caja" })
export class CierreCajaEntity implements ICierreCaja {
  @PrimaryGeneratedColumn()
  id_cierre_caja!: number;

  @Column()
  responsible!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  ventas_efectivo!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  ventas_qr!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  efectivo_inicial!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  bancario_inicial!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  ingresos_efectivo!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  efectivo_esperado!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  efectivo_real!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  bancario_esperado!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  bancario_real!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  diferencia_efectivo!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  diferencia_bancario!: number;

  @Column({ type: "varchar" })
  observaciones!: string;

  @Column({
    type: "timestamptz",
    nullable: false,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  created_at!: Date;

  @Column({
    type: "timestamptz",
    nullable: false,
    default: () => "CURRENT_TIMESTAMP(6)",
  })
  updated_at!: Date;

  @OneToOne(() => EfectivoDiarioEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_efectivo_diario" })
  id_efectivo_diario!: EfectivoDiarioEntity;

  @ManyToOne(() => SucursalEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "id_sucursal" })
  id_sucursal!: SucursalEntity;
}
