import AppDataSource from "../config/dataSource";
import { UserEntity } from "../entities/implements/UserEntity";
import { IUser } from "../entities/IUser";
import { User } from "../models/User";

const userRepository = AppDataSource.getRepository(UserEntity);

const registerUserRepo = async (user: IUser) => {
  const newUser = userRepository.create(user);
  const savedUser = await userRepository.save(newUser);
  return new User(savedUser);
};

const findByEmailRepository = async (email: string) => {
  const user = await userRepository.findOneBy({ email: email });
  return user;
};

export const UserRepository = { registerUserRepo, findByEmailRepository };
