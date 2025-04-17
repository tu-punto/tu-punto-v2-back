import { UserModel } from '../entities/implements//UserSchema'; 
export const seedUser = async () => {
  const existe = await UserModel.findOne({ email: 'admin@admin.com' });
  if (existe) {
    console.log('Usuario ya existe, no se crea nuevamente');
    return;
  }

  const nuevoUsuario = new UserModel({
    email: 'admin@admin.com',
    password: '123456', 
    role: 'admin',
    vendedor: null,
    trabajador: null
  });

  await nuevoUsuario.save();
  console.log('Usuario creado');
};
