/** Maximum attachment size in bytes (10 MB). */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Error message returned when an attachment exceeds the size limit. */
export const ATTACHMENT_SIZE_ERROR_MSG =
  'Attachment exceeds the 10 MB size limit. The text message has been saved, but the attachment was rejected.';

/** Header used by Telegram to send the secret token for webhook validation. */
export const TELEGRAM_WEBHOOK_HEADER = 'x-telegram-bot-api-secret-token';

/** Telegram Bot API base URL. */
export const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/** Telegram Bot API file download URL prefix. */
export const TELEGRAM_FILE_BASE = 'https://api.telegram.org/file/bot';
