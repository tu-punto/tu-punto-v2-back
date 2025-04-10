import { IGroup } from "../entities/IGroup";
import { IGroupDocument } from "../entities/documents/IGroupDocument";
import { ProductoModel } from "../entities/implements/ProductoSchema"; 
import { GroupModel } from "../entities/implements/GroupSchema";
import { IProductoDocument } from "../entities/documents/IProductoDocument";


const getAllGroups = async (): Promise<IGroupDocument[]> => {
  return await GroupModel.find({ name: { $ne: "Sin Grupo" } }).exec();
};


const getAllGroupsWithProducts = async (): Promise<IGroupDocument[]> => {
  return await GroupModel.find({ name: { $ne: "Sin Grupo" } })
    .populate('products')
    .exec();
};

const getGroupById = async (id: number): Promise<IGroupDocument | null> => {
  return await GroupModel.findOne({ _id: id }).exec();
};

const getProductsInGroup = async (group: IGroup): Promise<any[]> => {
    const products = await ProductoModel.find({
      group: group._id 
    })
      .populate('group categoria features vendedor producto_sucursal') 
      .exec();
  
    return products.map(product => {
      return {
        ...product.toObject(), 
        key: `${product._id}` 
      };
    });
  };

const registerGroup = async (group: IGroup): Promise<IGroupDocument> => {
  const newGroup = new GroupModel(group);
  return await newGroup.save();
};

const getExampleProduct = async (group: IGroup): Promise<any | null> => {
    const product = await ProductoModel.findOne({ group: group._id }) 
      .populate('group categoria features vendedor producto_sucursal') 
      .exec();
  
    if (product) {
      return {
        ...product.toObject(), 
        key: `${product._id}` 
      };
    }
  
    return null; 
  };
  

const updateGroup = async (newData: any, groupId: IGroup): Promise<IGroupDocument> => {
  const updatedGroup = await GroupModel.findByIdAndUpdate(groupId._id, newData, { 
    new: true 
  }).exec();
  return updatedGroup!; 
};


export const GroupRepository = {
  getProductsInGroup,
  getGroupById,
  registerGroup,
  getAllGroups,
  getExampleProduct,
  getAllGroupsWithProducts,
  updateGroup
};
