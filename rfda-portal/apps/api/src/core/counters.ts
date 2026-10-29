import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Next value of a named sequence. `start` is the value before the first one handed out. */
export async function nextValue(tx: Tx, key: string, start = 0): Promise<number> {
  const row = await tx.counter.upsert({ where: { key }, create: { key, value: start + 1 }, update: { value: { increment: 1 } } });
  return row.value;
}

export const pad4 = (n: number) => String(n).padStart(4, '0');
