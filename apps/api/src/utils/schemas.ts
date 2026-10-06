import { z } from 'zod';

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'expected a 0x-prefixed 20-byte address');

export const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'expected a 0x-prefixed 32-byte hash');

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const blockParamsSchema = z.object({
  number: z.coerce.number().int().min(0),
});

export const txParamsSchema = z.object({ hash: hashSchema });

export const addressParamsSchema = z.object({ address: addressSchema });

export const assetParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const uintString = z.string().regex(/^\d+$/, 'expected a non-negative integer string');

export const registerAssetSchema = z.object({
  name: z.string().trim().min(1).max(128),
  assetType: z.string().trim().min(1).max(64),
  value: uintString,
  owner: addressSchema,
});

export const transferAssetSchema = z.object({
  to: addressSchema,
});

export const mintTokenSchema = z.object({
  to: addressSchema,
  amount: uintString,
});

export const transferTokenSchema = z.object({
  to: addressSchema,
  amount: uintString,
});

export const addressQuerySchema = z.object({
  address: addressSchema.optional(),
  owner: addressSchema.optional(),
});
