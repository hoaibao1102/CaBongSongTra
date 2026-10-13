import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { randomUUID } from "node:crypto";
import { CreateUserDto } from "./dto";
import { hashPassword } from "../auth/password";
import type { MongoRepository } from "./repository";
export async function provisioningInput(env: NodeJS.ProcessEnv) {
  if (env.PROVISION_CONFIRM !== "CREATE_FIRST_OWNER") throw new Error("EXPLICIT_PROVISION_CONFIRMATION_REQUIRED");
  const input = plainToInstance(CreateUserDto, { email: env.PROVISION_EMAIL, password: env.PROVISION_PASSWORD, displayName: env.PROVISION_NAME });
  if ((await validate(input, { whitelist: true, forbidNonWhitelisted: true })).length) throw new Error("INVALID_PROVISION_INPUT");
  return input;
}
export async function provision(db: MongoRepository, input: CreateUserDto) {
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async session => {
    if (await db.users.findOne({ role: "OWNER_ADMIN" }).session(session).lean()) throw new Error("OWNER_ALREADY_EXISTS");
    const id = randomUUID();
    await db.users.create([{ id, emailNormalized: input.email.trim().toLowerCase(), displayName: input.displayName, passwordHash, role: "OWNER_ADMIN", status: "ACTIVE" }], { session });
    for (const [weight, price] of [[300, 109000], [400, 139000], [600, 199000]]) {
      await db.products.updateOne({ sku: `CBST-${weight}` }, { $setOnInsert: { id: randomUUID(), sku: `CBST-${weight}`, name: `Ca bong Song Tra ${weight}g`, netWeightG: weight, retailPriceVnd: price, active: true, version: 0 } }, { upsert: true, session, runValidators: true });
    }
    await db.audit.create([{ id: randomUUID(), actorId: id, action: "FIRST_OWNER_PROVISIONED", entityId: id, requestId: randomUUID(), createdAt: new Date() }], { session });
    return { id };
  });
}
