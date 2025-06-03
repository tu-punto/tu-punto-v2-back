import { IUser } from "../entities/IUser";
import { UserRepository } from "../repositories/user.repository";

const registerUserService = async (user: IUser) => {
  return await UserRepository.registerUserRepo(user);
};

const findByEmailService = async (email: string) => {
  return await UserRepository.getUserByEmail(email);
};
const getUserByIdService = async (id: string) => {
  return await UserRepository.getUserById(id);
};

export const UserService = {
  registerUserService,
  findByEmailService,
  getUserByIdService, 
};

