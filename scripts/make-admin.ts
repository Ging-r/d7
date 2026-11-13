// Usage: npm run make-admin -- someone@example.com
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });
const result = await db.user.updateMany({ where: { email }, data: { isAdmin: true } });
console.log(result.count ? `${email} is now an admin.` : `No user with email ${email}.`);
await db.$disconnect();
