/** Global rate-limit window in seconds. */
export const GLOBAL_THROTTLE_TTL = 60;

/** Maximum requests per IP within the global TTL window. */
export const GLOBAL_THROTTLE_LIMIT = 100;

/** Auth-specific rate-limit window in seconds (15 minutes). */
export const AUTH_THROTTLE_TTL = 900;

/** Maximum auth attempts per IP within the auth TTL window. */
export const AUTH_THROTTLE_LIMIT = 5;
