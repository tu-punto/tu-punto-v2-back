import { DataSource } from "typeorm";
import dotenv from 'dotenv';
import { VendedorEntity } from "../entities/implements/VendedorEntity";
import { Caracteristicas_ProductoEntity } from "../entities/implements/Caracteristicas_ProductoEntity";
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

dotenv.config();


const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: true,
    logging: true,
    entities: [
        Caracteristicas_ProductoEntity,
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
        CategoriaEntity
    ],
    subscribers: [],
    migrations: [],
    ssl: true
});
export default AppDataSource;