import { In } from 'typeorm';
import { format } from 'date-fns';
import AppDataSource from '../config/dataSource';
import { IngresoEntity } from '../entities/implements/IngresoSchema';
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

export const findByProductId = async (productId: number): Promise<IngresoEntity[] | null> => {
    const entries = await entryRepository.find({
        where: {
            id_producto: productId
        },
        select: {
            id_ingreso: true,
            fecha_ingreso: true,
            estado: true,
            cantidad_ingreso: true,
            id_producto: true,
            id_vendedor: true,
            id_sucursal: true,
            producto: {
                id_producto: true,
                nombre_producto: true
            },
            vendedor: {
                id_vendedor: true,
                marca: true,
                nombre: true,
                apellido: true
            }
        },
        relations: {
            producto: true,
            vendedor: true
        }
    });

    return entries.map(entry => {
        const formattedDate = format(new Date(entry.fecha_ingreso), 'dd/MM/yyyy HH:mm:ss');
        return {
            ...entry,
            key: `${entry.id_ingreso}-${formattedDate}`
        };
    });
};

export const deleteEntriesByIds = async (entriesIds: number[]): Promise<any> => {
    return await entryRepository.delete({ id_ingreso: In(entriesIds) });
};

export const deleteProductEntries = async (entryData: any[]): Promise<any[]> => {
    const ids = entryData.map(entry => entry.id_ingreso);
    await entryRepository.delete({ id_ingreso: In(ids) });
    return ids;
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

export const updateProductEntries = async (entryData: any[]): Promise<any[]> => {
    const ids = entryData.map(entry => entry.id_ingreso);
    const entriesToUpdate = await entryRepository.findBy({ id_ingreso: In(ids) });

    entriesToUpdate.forEach(entry => {
        const newData = entryData.find(e => e.id_ingreso === entry.id_ingreso);
        if (newData) {
            entry.cantidad_ingreso = newData.cantidad_ingreso;
        }
    });

    return await entryRepository.save(entriesToUpdate);
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

export const createEntry = async (entryData: any): Promise<IngresoEntity> => {
    const newEntry = await entryRepository.save(entryData);
    return newEntry;
};