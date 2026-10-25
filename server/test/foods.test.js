const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');

describe('Carbohydrate Calculator Saved Foods Database Tests', () => {
  const userIdA = 901;
  const userIdB = 902;

  beforeEach(async () => {
    await new Promise((resolve) => db.db.run('DELETE FROM saved_foods WHERE user_id IN (?, ?)', [userIdA, userIdB], resolve));
  });

  it('rejects invalid food names or negative carbs values', async () => {
    await new Promise((resolve) => {
      db.saveFood(userIdA, '', 25, (err) => {
        assert.ok(err);
        resolve();
      });
    });

    await new Promise((resolve) => {
      db.saveFood(userIdA, 'Rice', -5, (err) => {
        assert.ok(err);
        resolve();
      });
    });

    await new Promise((resolve) => {
      db.saveFood(userIdA, 'Rice', NaN, (err) => {
        assert.ok(err);
        resolve();
      });
    });
  });

  it('saves and retrieves food items scoped to user', async () => {
    // Save 3 foods for User A
    const food1 = await new Promise((resolve, reject) => {
      db.saveFood(userIdA, 'Basmati Rice', 28.0, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.strictEqual(food1.name, 'Basmati Rice');
    assert.strictEqual(food1.carbs_per_100g, 28.0);
    assert.strictEqual(food1.user_id, userIdA);

    await new Promise((resolve, reject) => {
      db.saveFood(userIdA, 'Oatmeal Porridge', 12.0, (err, res) => (err ? reject(err) : resolve(res)));
    });

    await new Promise((resolve, reject) => {
      db.saveFood(userIdA, 'Red Apple', 14.0, (err, res) => (err ? reject(err) : resolve(res)));
    });

    // Save 1 food for User B
    await new Promise((resolve, reject) => {
      db.saveFood(userIdB, 'Secret User B Food', 50.0, (err, res) => (err ? reject(err) : resolve(res)));
    });

    // Retrieve User A's foods
    const userAFoods = await new Promise((resolve, reject) => {
      db.getSavedFoods(userIdA, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
    assert.strictEqual(userAFoods.length, 3);
    const namesA = userAFoods.map((f) => f.name);
    assert.ok(namesA.includes('Basmati Rice'));
    assert.ok(namesA.includes('Oatmeal Porridge'));
    assert.ok(namesA.includes('Red Apple'));
    assert.ok(!namesA.includes('Secret User B Food'));

    // Retrieve User B's foods
    const userBFoods = await new Promise((resolve, reject) => {
      db.getSavedFoods(userIdB, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
    assert.strictEqual(userBFoods.length, 1);
    assert.strictEqual(userBFoods[0].name, 'Secret User B Food');
  });

  it('searches foods by case-insensitive name match and respects limit', async () => {
    await new Promise((resolve) => db.saveFood(userIdA, 'Basmati Rice', 28.0, resolve));
    await new Promise((resolve) => db.saveFood(userIdA, 'Oatmeal Porridge', 12.0, resolve));
    await new Promise((resolve) => db.saveFood(userIdA, 'Red Apple', 14.0, resolve));

    // Search "rice"
    const riceResults = await new Promise((resolve, reject) => {
      db.getSavedFoods(userIdA, 'rice', 20, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
    assert.strictEqual(riceResults.length, 1);
    assert.strictEqual(riceResults[0].name, 'Basmati Rice');

    // Search "OAT"
    const oatResults = await new Promise((resolve, reject) => {
      db.getSavedFoods(userIdA, 'OAT', 20, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
    assert.strictEqual(oatResults.length, 1);
    assert.strictEqual(oatResults[0].name, 'Oatmeal Porridge');

    // Search with limit 1
    const limitResults = await new Promise((resolve, reject) => {
      db.getSavedFoods(userIdA, null, 1, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
    assert.strictEqual(limitResults.length, 1);
  });

  it('deletes saved foods and prevents cross-user deletion', async () => {
    await new Promise((resolve) => db.saveFood(userIdA, 'Basmati Rice', 28.0, resolve));
    await new Promise((resolve) => db.saveFood(userIdA, 'Oatmeal Porridge', 12.0, resolve));
    await new Promise((resolve) => db.saveFood(userIdA, 'Red Apple', 14.0, resolve));

    const foodsBefore = await new Promise((resolve) => db.getSavedFoods(userIdA, (e, r) => resolve(r)));
    const targetFood = foodsBefore.find((f) => f.name === 'Red Apple');
    assert.ok(targetFood);

    // User B attempts to delete User A's food
    const crossRes = await new Promise((resolve) => db.deleteFood(userIdB, targetFood.id, (e, r) => resolve(r)));
    assert.strictEqual(crossRes.deleted, false);

    // Food still exists for User A
    let check = await new Promise((resolve) => db.getSavedFoods(userIdA, (e, r) => resolve(r)));
    assert.strictEqual(check.length, 3);

    // User A deletes own food
    const ownRes = await new Promise((resolve) => db.deleteFood(userIdA, targetFood.id, (e, r) => resolve(r)));
    assert.strictEqual(ownRes.deleted, true);

    check = await new Promise((resolve) => db.getSavedFoods(userIdA, (e, r) => resolve(r)));
    assert.strictEqual(check.length, 2);
    assert.ok(!check.some((f) => f.name === 'Red Apple'));
  });
});

