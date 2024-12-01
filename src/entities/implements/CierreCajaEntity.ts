import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { EfectivoDiarioEntity } from "./EfectivoDiarioEntity";
import { ICierreCaja } from "../ICierreCaja";

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
  ingresos_efectivo!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  efectivo_esperado!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  efectivo_real!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  diferencia!: number;

  @Column({ nullable: false, default: () => "CURRENT_TIMESTAMP(6)" })
  created_at!: Date;

  @Column({ nullable: false, default: () => "CURRENT_TIMESTAMP(6)" })
  updated_at!: Date;

  @OneToOne(() => EfectivoDiarioEntity)
  @JoinColumn({ name: "id_efectivo_diario" })
  id_efectivo_diario!: EfectivoDiarioEntity;
}
