import AppDataSource from '../config/dataSource';
import { IngresoEntity } from '../entities/implements/IngresoEntity';

const entryRepository = AppDataSource.getRepository(IngresoEntity);

export const findBySellerId = async (sellerId: number): Promise<IngresoEntity[] | null> => {
    return await entryRepository.find({
        where: {
            id_vendedor: sellerId
        },
        relations:{
            producto:true
        }
    })
}