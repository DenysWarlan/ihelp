/** Maximum upload file size in bytes (10 MB). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** MIME types accepted for upload. */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'video/mp4',
] as const;

/** Presigned-URL validity period in seconds (1 hour). */
export const PRESIGNED_URL_EXPIRY = 3600;
