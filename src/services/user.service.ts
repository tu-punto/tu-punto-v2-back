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

const getAllUsers = async () => {
  return await UserRepository.getAllUsers();
};

const updateUser = async (id: string, updateData: any) => {
  return await UserRepository.updateUser(id, updateData);
};

const deleteUser = async (id: string) => {
  return await UserRepository.deleteUser(id);
};

const getAdmins = async () => {
  return await UserRepository.getAdmins();
};

export const UserService = {
  registerUserService,
  findByEmailService,
  getUserByIdService,
  getAllUsers,
  updateUser,
  deleteUser,
  getAdmins
};

