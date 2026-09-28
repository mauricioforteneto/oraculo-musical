import "server-only";
import { GoogleAuth } from "google-auth-library";
import { DriveReader, SourceError } from "./drive";

export function configuredDriveReader() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !privateKey) throw new SourceError("DRIVE_NOT_CONFIGURED");
  const auth = new GoogleAuth({
    credentials: { client_email: email, private_key: privateKey.replace(/\\n/g, "\n") },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return new DriveReader(async () => {
    const token = await auth.getAccessToken();
    if (!token) throw new SourceError("DRIVE_ACCESS_DENIED");
    return token;
  });
}
