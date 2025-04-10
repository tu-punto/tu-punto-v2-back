import { BoxCloseRepository } from "../repositories/boxClose.repository";

const getAllBoxClosings = async () => {
  return await BoxCloseRepository.findAll();
};

const registerBoxClose = async (boxClose: any) => {
  return await BoxCloseRepository.registerBoxClose(boxClose);
};

const getBoxCloseById = async (id: string) => {
  const category = await BoxCloseRepository.getBoxCloseById(id);
  if (!category) throw new Error("Doesn't exist a box close with such id");
  return category;
};

export const BoxCloseService = {
  getAllBoxClosings,
  registerBoxClose,
  getBoxCloseById,
};
