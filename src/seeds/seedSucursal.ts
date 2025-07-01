import { SucursalModel } from '../entities/implements/SucursalSchema'; 

export const seedSucursal = async () => {
  const existe = await SucursalModel.findOne({ nombre: 'Sucursal Principal' });
  if (existe) {
    console.log('Sucursal ya existe, no se crea nuevamente');
    return;
  }

  const nuevaSucursal = new SucursalModel({
    nombre: 'Prado',
    direccion: 'Prado 123',
    ciudad: 'La Paz',
    telefono: 12345678,
    pedido: [],
    trabajador: [],
    ingreso: [],
    cierre_caja: []
  });

  await nuevaSucursal.save();
  console.log('Sucursal creada');
};
