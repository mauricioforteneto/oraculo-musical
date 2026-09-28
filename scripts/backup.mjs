import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const adminUrl = process.env.DATABASE_MIGRATION_URL;
if (!adminUrl) {
  console.error("Configure DATABASE_MIGRATION_URL em .env.migration.local.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(adminUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username) throw new Error();
} catch {
  console.error("DATABASE_MIGRATION_URL inválida.");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const caFile = resolve(process.env.BACKUP_CA_CERT ?? resolve(root, ".private/supabase-ca.crt"));
const keyFile = resolve(process.env.BACKUP_PASSPHRASE_FILE ?? resolve(homedir(), ".config/oraculo-musical/backup-passphrase"));
const backupDir = resolve(process.env.BACKUP_OUTPUT_DIR ?? resolve(root, ".private/backups"));
const localDump = resolve(root, ".private/tools/pg17/usr/lib/postgresql/17/bin/pg_dump");
const localLib = resolve(root, ".private/tools/pg17/usr/lib/x86_64-linux-gnu");

try {
  await access(caFile);
  const key = await stat(keyFile);
  if (!key.isFile() || (key.mode & 0o077)) throw new Error();
} catch {
  console.error("Backup não iniciado: certificado CA ou arquivo de senha privada ausente/inseguro.");
  process.exit(1);
}

const dumpBin = process.env.PG_DUMP_BIN ?? await access(localDump).then(() => localDump, () => "pg_dump");
const connection = {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || "5432",
  PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)) || "postgres",
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGSSLMODE: "verify-full",
  PGSSLROOTCERT: caFile,
  PGCONNECT_TIMEOUT: "15",
  ...(dumpBin === localDump ? { LD_LIBRARY_PATH: `${localLib}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""}` } : {}),
};
delete connection.DATABASE_MIGRATION_URL;
const encryptionEnvironment = { ...process.env };
delete encryptionEnvironment.DATABASE_MIGRATION_URL;

await mkdir(backupDir, { recursive: true, mode: 0o700 });
process.umask(0o077);
const name = `oraculo-${new Date().toISOString().replace(/[-:.]/g, "")}-${randomUUID().slice(0, 8)}.dump.gpg`;
const output = resolve(backupDir, name);
const partial = `${output}.partial`;
let dump;
let encrypt;
try {
  dump = spawn(dumpBin, ["--format=custom", "--schema=oraculo", "--schema=oraculo_migrations", "--no-owner", "--no-acl"], {
    env: connection,
    stdio: ["ignore", "pipe", "pipe"],
  });
  encrypt = spawn("gpg", [
    "--batch", "--yes", "--pinentry-mode", "loopback", "--passphrase-file", keyFile,
    "--symmetric", "--cipher-algo", "AES256", "--compress-algo", "none", "--output", partial,
  ], { env: encryptionEnvironment, stdio: ["pipe", "ignore", "pipe"] });
  encrypt.stdin.on("error", () => {});
  encrypt.on("close", (code) => {
    if (code !== 0 && dump.exitCode === null) dump.kill();
  });
  dump.stdout.pipe(encrypt.stdin);
  const exit = (child) => new Promise((done) => {
    child.on("error", () => done(false));
    child.on("close", (code) => done(code === 0));
  });
  // Drain errors without printing connection strings or private source details.
  dump.stderr.resume();
  encrypt.stderr.resume();
  const [dumpOk, encryptionOk] = await Promise.all([exit(dump), exit(encrypt)]);
  if (!dumpOk || !encryptionOk) throw new Error("BACKUP_FAILED");
  if ((await stat(partial)).size === 0) throw new Error("EMPTY_BACKUP");
  await rename(partial, output);
  console.log(`Backup criptografado criado: ${output}`);
} catch {
  await unlink(partial).catch(() => {});
  console.error("Backup não concluído. Confira pg_dump 17, certificado CA, conexão e GPG; nenhum arquivo parcial foi mantido.");
  process.exitCode = 1;
}
