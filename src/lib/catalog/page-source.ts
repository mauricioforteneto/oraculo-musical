import "server-only";
import { getPublishedSource } from "./database";
import { authConfigured } from "@/lib/auth";
import { seasonContext, type SeasonContext } from "@/lib/seasons/context";

// Call requireOwner in each route before invoking this reader.
export function readPageSource(context: SeasonContext = seasonContext()) {
  return getPublishedSource(context.year, context.folderId);
}
export function synchronizationReady(context: SeasonContext = seasonContext()) {
  return authConfigured() && Boolean(process.env.DATABASE_READ_URL && process.env.DATABASE_SYNC_URL
    && context.folderId && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}
