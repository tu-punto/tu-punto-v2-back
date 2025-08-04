import { IUser } from "../entities/IUser";
import { UserModel } from "../entities/implements/UserSchema";
import { IUserDocument } from "../entities/documents/IUserDocument";

const findAll = async (): Promise<IUserDocument[]> => {
  const users = await UserModel.find();
  return users; 
};

const registerUserRepo = async (user: IUser): Promise<IUserDocument> => {
  const newUser = new UserModel(user);  
  const savedUser = await newUser.save();  
  return savedUser;     
};

const getUserByEmail = async (email: string): Promise<IUserDocument | null> => {
  const user = await UserModel.findOne({ email: email }); 
  console.log("Encontrado:", user); 
  return user;
};

const getUserById = async (id: string): Promise<IUserDocument | null> => {
  const user = await UserModel.findById(id);  
  return user;
};

const getAdmins = async () => {
  return await UserModel.find({ role: "admin" }).select("_id email");
};


const getAllUsers = async () => {
  return await UserModel.find({}).select('-password').sort({ createdAt: -1 });
};

const updateUser = async (id: string, updateData: any) => {
  return await UserModel.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
};

const deleteUser = async (id: string) => {
  return await UserModel.findByIdAndDelete(id);
};

export const UserRepository = {
  findAll,
  registerUserRepo,
  getUserByEmail,
  getUserById,
  getAllUsers,
  updateUser,
  deleteUser,
  getAdmins
};
