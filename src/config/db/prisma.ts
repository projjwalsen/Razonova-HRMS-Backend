import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 16000,   // wait up to 16s to acquire transaction
    timeout: 20000,   // transaction can run for 20s
  },
});