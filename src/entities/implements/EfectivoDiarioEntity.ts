import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { CierreCajaEntity } from "./CierreCajaEntity";

@Entity({ name: "Efectivo_Diario" })
export class EfectivoDiarioEntity {
  @PrimaryGeneratedColumn()
  id_efectivo_diario!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  valor!: number;

  @Column()
  cantidad!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total!: number;

  @Column({ nullable: false, default: () => "CURRENT_TIMESTAMP(6)" })
  created_at!: Date;

  @Column({ nullable: false, default: () => "CURRENT_TIMESTAMP(6)" })
  updated_at!: Date;

  @OneToOne(() => CierreCajaEntity)
  @JoinColumn({ name: "id_cierre_caja" })
  id_cierre_caja!: CierreCajaEntity;
}
