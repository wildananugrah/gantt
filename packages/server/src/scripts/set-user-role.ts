/**
 * Promote or demote a user.
 *
 * Usage:
 *   bun run --filter='@app/server' set-user-role -- <email> <admin|member>
 *
 * Example (from repo root):
 *   bun run --filter='@app/server' set-user-role -- alice@example.com admin
 *
 * Or directly:
 *   bun --env-file=../../.env run src/scripts/set-user-role.ts alice@example.com member
 */
import { eq } from 'drizzle-orm';
import { db, queryClient } from '../db/client';
import { users } from '../db/schema';

function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  die(
    'Usage: set-user-role <email> <admin|member>\n' +
    '\n' +
    'Examples:\n' +
    "  set-user-role alice@example.com admin\n" +
    "  set-user-role bob@example.com member",
  );
}

const [rawEmail, rawRole] = args as [string, string];
const email = rawEmail.trim().toLowerCase();
const role = rawRole.trim().toLowerCase();

if (role !== 'admin' && role !== 'member') {
  die(`role must be "admin" or "member" (got "${rawRole}")`);
}

const [user] = await db
  .select({ id: users.id, email: users.email, name: users.name, role: users.role })
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (!user) {
  await queryClient.end();
  die(`No user found with email "${email}".`);
}

if (user.role === role) {
  console.log(`No change: ${user.email} is already ${user.role}.`);
  await queryClient.end();
  process.exit(0);
}

// If demoting an admin to member, refuse if they're the last admin standing.
if (user.role === 'admin' && role === 'member') {
  const remainingAdmins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'));
  if (remainingAdmins.length <= 1) {
    await queryClient.end();
    die(
      `Refusing to demote "${user.email}": they are the last admin. ` +
      `Promote another user to admin first, then re-run this command.`,
      2,
    );
  }
}

await db.update(users).set({ role }).where(eq(users.id, user.id));
console.log(`✓ ${user.email} (${user.name}): ${user.role} → ${role}`);

await queryClient.end();
process.exit(0);
