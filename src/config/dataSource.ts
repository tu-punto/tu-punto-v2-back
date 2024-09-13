import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { VendedorEntity } from "../entities/implements/VendedorEntity";
import { CaracteristicasEntity } from "../entities/implements/CaracteristicasEntity";
import { ComprobanteEntradaEntity } from "../entities/implements/ComprobanteEntradaEntity";
import { ComprobantePagoEntity } from "../entities/implements/ComprobantePagoEntity";
import { IngresoEntity } from "../entities/implements/IngresoEntity";
import { PedidoEntity } from "../entities/implements/PedidoEntity";
import { Producto_SucursalEntity } from "../entities/implements/Producto_SucursalEntity";
import { ProductoEntity } from "../entities/implements/ProductoEntity";
import { SucursalEntity } from "../entities/implements/SucursalEntity";
import { TrabajadorEntity } from "../entities/implements/TrabajadorEntity";
import { VentaEntity } from "../entities/implements/VentaEntity";
import { CategoriaEntity } from "../entities/implements/CategoriaEntity";
import { GroupEntity } from "../entities/implements/GroupEntity";
import { FlujoFinancieroEntity } from "../entities/implements/FlujoFinancieroEntity";
import { UserEntity } from "../entities/implements/UserEntity";

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
  ],
  subscribers: [],
  migrations: [],
  ssl: true,
});
export default AppDataSource;
