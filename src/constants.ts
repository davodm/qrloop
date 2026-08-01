export const MAX_NONCE = 10;
export const FOUNTAIN_V1 = 100;

/** Max fountain degree so header + payload stays phone-scannable with data frames. */
export const MAX_FOUNTAIN_DEGREE = 8;

/**
 * Extra bytes allowed on fountain frames beyond dataSize (version + k + indexes).
 * With MAX_FOUNTAIN_DEGREE=8: 3 + 2*8 = 19.
 */
export const FOUNTAIN_HEADROOM = 3 + 2 * MAX_FOUNTAIN_DEGREE;
