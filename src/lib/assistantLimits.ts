/**
 * Size limits for the assistant endpoint, shared by the client and the server
 * so the textarea and the API can never disagree about what will be accepted.
 *
 * These are abuse guards, not editorial limits. The endpoint is unauthenticated
 * and accepts free text, so *some* ceiling has to exist or a single request can
 * pin the server; but nobody asking about their own divorce should ever meet
 * one. The question cap is set high enough to paste several pages of a court
 * order or a financial affidavit.
 */

/** Roughly 3,000+ words — far past any question a person types by hand. */
export const MAX_QUESTION_LENGTH = 20_000;

/** How many earlier turns the client may replay for context. */
export const MAX_HISTORY_TURNS = 12;

/**
 * Ceiling on question plus history combined. A per-message cap alone doesn't
 * bound the request: twelve maximum-length turns would still be a very large
 * body. This bounds the whole conversation.
 */
export const MAX_CONVERSATION_LENGTH = 60_000;
