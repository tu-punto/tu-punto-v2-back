import { IUser } from "../entities/IUser";
import { UserRepository } from "../repositories/user.repository";

const registerUserService = async (user: IUser) => {
  return await UserRepository.registerUserRepo(user);
};

const findByEmailService = async (email: string) => {
  return await UserRepository.getUserByEmail(email);
};
export const UserService = { registerUserService, findByEmailService };
