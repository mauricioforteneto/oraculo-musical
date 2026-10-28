import "server-only";
import { getPublishedSource } from "./database";
import { authConfigured } from "@/lib/auth";

// Call requireOwner in each route before invoking this reader.
export function readPageSource() {
  return getPublishedSource(Number(process.env.SOURCE_SEASON ?? "2026"), process.env.GOOGLE_DRIVE_FOLDER_ID ?? "");
}
export function synchronizationReady() {
  return authConfigured() && Boolean(process.env.DATABASE_READ_URL && process.env.DATABASE_SYNC_URL
    && process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}
