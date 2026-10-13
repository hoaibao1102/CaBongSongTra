import "reflect-metadata";
import { createConnection } from "mongoose";
import { MongoRepository } from "./v2/repository";
import { provision, provisioningInput } from "./v2/provision";
async function main() {
  const input = await provisioningInput(process.env);
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI_REQUIRED");
  const connection = await createConnection(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    const db = new MongoRepository(connection);
    await Promise.all([db.users.init(), db.products.init(), db.audit.init()]);
    await provision(db, input);
    process.stdout.write("First owner and missing approved products provisioned. No stock was seeded.\n");
  } finally { await connection.close(); }
}
if (require.main === module) void main().catch(() => { process.stderr.write("Provisioning failed; verify inputs, existing owner, replica set and indexes. No secrets printed.\n"); process.exitCode = 1; });
