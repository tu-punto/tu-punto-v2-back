import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { VendedorEntity } from "../entities/implements/VendedorSchema";
import { CaracteristicasEntity } from "../entities/implements/CaracteristicasSchema";
import { ComprobanteEntradaEntity } from "../entities/implements/ComprobanteEntradaSchema";
import { ComprobantePagoEntity } from "../entities/implements/ComprobantePagoSchema";
import { IngresoEntity } from "../entities/implements/IngresoSchema";
import { PedidoEntity } from "../entities/implements/PedidoSchema";
import { Producto_SucursalEntity } from "../entities/implements/ProductoSucursalSchema";
import { ProductoEntity } from "../entities/implements/ProductoSchema";
import { SucursalEntity } from "../entities/implements/SucursalSchema";
import { TrabajadorEntity } from "../entities/implements/TrabajadorSchema";
import { VentaEntity } from "../entities/implements/VentaSchema";
import { CategoriaEntity } from "../entities/implements/CategoriaSchema";
import { GroupEntity } from "../entities/implements/GroupSchema";
import { FlujoFinancieroEntity } from "../entities/implements/FlujoFinancieroSchema";
import { UserEntity } from "../entities/implements/UserSchema";
import { CierreCajaEntity } from "../entities/implements/CierreCajaSchema";
import { EfectivoDiarioEntity } from "../entities/implements/EfectivoDiarioSchema";

dotenv.config();

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: true,
  logging: false,
  entities: [
    VendedorEntity,
    CaracteristicasEntity,
    ComprobanteEntradaEntity,
    ComprobantePagoEntity,
    IngresoEntity,
    PedidoEntity,
    Producto_SucursalEntity,
    ProductoEntity,
    SucursalEntity,
    TrabajadorEntity,
    VendedorEntity,
    VentaEntity,
    CategoriaEntity,
    GroupEntity,
    FlujoFinancieroEntity,
    UserEntity,
    CierreCajaEntity,
    EfectivoDiarioEntity,
  ],
  subscribers: [],
  migrations: [],
  ssl: { rejectUnauthorized: false },
});
export default AppDataSource;
