const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { PersonalInventoryService } = require('../src/services/personalInventory.service');
const { PersonalProductModel, PersonalSaleModel, PersonalInventoryMovementModel, PersonalExpenseModel } = require('../src/entities/implements/PersonalInventorySchemas');

const id = '507f1f77bcf86cd799439011';
const seller = '507f1f77bcf86cd799439012';

test('una venta guarda precio elegido y costo histórico, incluyendo costo cero', async t => {
  t.mock.method(PersonalProductModel, 'findOneAndUpdate', async () => ({ _id: id, name: 'Producto', salePrice: 15, purchaseCost: 0 }));
  let saved;
  t.mock.method(PersonalSaleModel, 'create', async value => { saved = value; return { ...value, _id: id }; });
  t.mock.method(PersonalInventoryMovementModel, 'insertMany', async () => []);
  await PersonalInventoryService.createSale(seller, { items: [{ productId: id, quantity: 2, unitPrice: 9 }] });
  assert.equal(saved.total, 18);
  assert.equal(saved.items[0].unitPrice, 9);
  assert.equal(saved.items[0].unitCost, 0);
});

test('ventas sin costo no inventan uno y un precio inválido se rechaza', async t => {
  t.mock.method(PersonalProductModel, 'findOneAndUpdate', async () => ({ _id: id, name: 'Producto', salePrice: 15 }));
  let saved;
  t.mock.method(PersonalSaleModel, 'create', async value => { saved = value; return { ...value, _id: id }; });
  t.mock.method(PersonalInventoryMovementModel, 'insertMany', async () => []);
  await PersonalInventoryService.createSale(seller, { items: [{ productId: id, quantity: 1 }] });
  assert.equal(saved.items[0].unitCost, undefined);
  assert.equal(saved.total, 15);
  await assert.rejects(() => PersonalInventoryService.createSale(seller, { items: [{ productId: id, quantity: 1, unitPrice: -1 }] }), /Precio/);
});

test('el ajuste sin motivo es válido y mantiene el filtro por vendedor', async t => {
  let filter, movement;
  t.mock.method(PersonalProductModel, 'findOneAndUpdate', async value => { filter = value; return { _id: id }; });
  t.mock.method(PersonalInventoryMovementModel, 'create', async value => { movement = value; return value; });
  await PersonalInventoryService.adjustStock(seller, id, { quantityDelta: -1 });
  assert.equal(filter.sellerId, seller);
  assert.equal(filter.stock.$gte, 1);
  assert.equal(movement.reason, '');
});

test('filtrar historial por producto no consulta gastos', async t => {
  let expenseCalled = false;
  const query = { lean: async () => [], populate() { return this; } };
  t.mock.method(PersonalSaleModel, 'find', () => query);
  t.mock.method(PersonalInventoryMovementModel, 'find', () => query);
  t.mock.method(PersonalExpenseModel, 'find', () => { expenseCalled = true; return query; });
  await PersonalInventoryService.history(seller, { productId: id });
  assert.equal(expenseCalled, false);
});

test('se puede quitar el código y costo de un producto', async t => {
  let update;
  t.mock.method(PersonalProductModel, 'findOneAndUpdate', async (_filter, value) => { update = value; return { _id: id }; });
  await PersonalInventoryService.updateProduct(seller, id, { code: '', purchaseCost: null });
  assert.deepEqual(update.$unset, { code: 1, purchaseCost: 1 });
});

test('una venta con varios productos conserva el costo y precio de cada línea', async t => {
  const otherId = '507f1f77bcf86cd799439013';
  t.mock.method(PersonalProductModel, 'findOneAndUpdate', async filter => filter._id === id
    ? { _id: id, name: 'Uno', salePrice: 10, purchaseCost: 4 }
    : { _id: otherId, name: 'Dos', salePrice: 20, purchaseCost: 8 });
  let saved;
  t.mock.method(PersonalSaleModel, 'create', async value => { saved = value; return { ...value, _id: id }; });
  t.mock.method(PersonalInventoryMovementModel, 'insertMany', async () => []);
  await PersonalInventoryService.createSale(seller, { items: [{ productId: id, quantity: 2, unitPrice: 9 }, { productId: otherId, quantity: 1, unitPrice: 18 }] });
  assert.equal(saved.total, 36);
  assert.deepEqual(saved.items.map(item => [item.subtotal, item.unitCost]), [[18, 4], [18, 8]]);
});

test('la búsqueda por código escapa los caracteres especiales', async t => {
  let filter;
  t.mock.method(PersonalProductModel, 'find', value => { filter = value; return { sort: () => ({ lean: async () => [] }) }; });
  await PersonalInventoryService.listProducts(seller, 'A.1');
  assert.equal(filter.sellerId, seller);
  assert.equal(filter.$or[1].code.$regex, 'A\\.1');
});
