import assert from "node:assert/strict";
import { test } from "node:test";
import { createShopTypeService } from "./shop-type.service.js";

test("create normalizes shop type fields and returns only public fields", async () => {
  let receivedInput;
  const service = createShopTypeService({
    repository: {
      async findByName() {
        return null;
      },
      async create(input) {
        receivedInput = input;
        return {
          _id: "shop-type-id",
          ...input,
          is_active: true,
          createdAt: new Date(),
        };
      },
    },
  });

  const shopType = await service.create({
    shop_type_name: "  Pharmacy  ",
    shop_type_image: "  https://example.com/pharmacy.png  ",
  });

  assert.deepEqual(receivedInput, {
    shop_type_name: "Pharmacy",
    shop_type_image: "https://example.com/pharmacy.png",
  });
  assert.deepEqual(shopType, {
    _id: "shop-type-id",
    shop_type_name: "Pharmacy",
    shop_type_image: "https://example.com/pharmacy.png",
  });
});

test("create rejects duplicate shop type names including write races", async () => {
  const duplicateService = createShopTypeService({
    repository: {
      async findByName() {
        return { _id: "existing-shop-type" };
      },
    },
  });

  await assert.rejects(
    duplicateService.create({
      shop_type_name: "Pharmacy",
      shop_type_image: "https://example.com/pharmacy.png",
    }),
    (error) => error.statusCode === 409,
  );

  const raceService = createShopTypeService({
    repository: {
      async findByName() {
        return null;
      },
      async create() {
        throw { code: 11000 };
      },
    },
  });

  await assert.rejects(
    raceService.create({
      shop_type_name: "Pharmacy",
      shop_type_image: "https://example.com/pharmacy.png",
    }),
    (error) => error.statusCode === 409,
  );
});

