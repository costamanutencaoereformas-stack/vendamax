import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Google Drive not configured');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function generateAuthUrl(state?: string) {
  const oAuth2Client = getOAuth2Client();
  return oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, state });
}

export async function getTokenFromCode(code: string) {
  const oAuth2Client = getOAuth2Client();
  const r = await oAuth2Client.getToken(code);
  return r.tokens; // contains access_token, refresh_token, expiry_date
}

export async function uploadFileToDrive(authTokens: any, filePath: string, fileName?: string, mimeType?: string) {
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials(authTokens);
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });

  const media = { mimeType: mimeType || 'application/octet-stream', body: fs.createReadStream(filePath) };
  const res = await drive.files.create({ requestBody: { name: fileName || path.basename(filePath) }, media, fields: 'id,name,webViewLink,webContentLink' });
  return res.data;
}

export default { generateAuthUrl, getTokenFromCode, uploadFileToDrive };
