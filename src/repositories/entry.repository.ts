import { In } from 'typeorm';
import AppDataSource from '../config/dataSource';
import { IngresoEntity } from '../entities/implements/IngresoEntity';
import { IIngreso } from '../entities/IIngreso';

const entryRepository = AppDataSource.getRepository(IngresoEntity);

export const findBySellerId = async (sellerId: number): Promise<IngresoEntity[] | null> => {
    return await entryRepository.find({
        where: {
            id_vendedor: sellerId
        },
        relations: {
            producto: true
        }
    })
}

export const deleteEntriesByIds = async (entriesIds: number[]): Promise<any> => {
    return await entryRepository.delete({ id_ingreso: In(entriesIds) });
};

export const findById = async (entryId: number) => {
    return await entryRepository.findOne({
        where: {
            id_ingreso: entryId,
        },
    });
};
export const updateEntryById = async (newData: any, entry: IIngreso) => {
    entry = { ...entry, ...newData };
    const newEntry = await entryRepository.save(entry);
    return newEntry;
};
export const getEntriesByIds = async (entriesIds: number[]): Promise<IngresoEntity[]> => {
    if (!entriesIds || entriesIds.length === 0) {
        return [];
    } else {
        return await entryRepository.find({
            where: {
                id_ingreso: In(entriesIds)
            }
        })
    }

}