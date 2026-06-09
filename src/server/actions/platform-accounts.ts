import { z } from "zod";
import { getDb } from "@/db/client";
import { platformAccounts } from "@/db/schema";

const createPlatformAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  accountLabel: z.string().min(1),
  currency: z.string().default("CNY"),
  notes: z.string().optional(),
});

export async function createPlatformAccount(input: z.input<typeof createPlatformAccountSchema>) {
  const data = createPlatformAccountSchema.parse(input);

  getDb().insert(platformAccounts).values(data).run();

  return data;
}
