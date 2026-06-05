/**
 * Lenient UUID format regex — accepts any 8-4-4-4-12 hex string.
 * Does NOT enforce RFC 4122 version/variant bits, so test/seed UUIDs pass.
 */
export const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
