import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Server-side schema for an anonymous, browser-bound, single-user MVP.
 *
 * Design constraints enforced throughout this file:
 * - No raw document content is ever stored in Postgres. `documents` holds only
 *   metadata plus an opaque storage object key resolved through a storage
 *   adapter (see src/server/storage).
 * - Every case/document-scoped row carries (directly or transitively) a
 *   `sessionId` so repositories can filter ownership with a single predicate.
 * - `cases.revision` backs optimistic concurrency for draft saves.
 * - `browserSessions` never stores the bearer token itself, only a hash of it
 *   plus rotation/expiry bookkeeping (see src/server/session).
 */

export const participantRoleEnum = pgEnum("participant_role", [
  "petitioner",
  "respondent",
]);

export const documentStorageProviderEnum = pgEnum("document_storage_provider", [
  "local",
  "azure",
]);

export const extractionRunStatusEnum = pgEnum("extraction_run_status", [
  "pending",
  "completed",
  "failed",
  "not_processed",
]);

export const extractionProposalStatusEnum = pgEnum("extraction_proposal_status", [
  "proposed",
  "confirmed",
  "rejected",
]);

/**
 * One row per issued browser session. The bearer token handed to the browser
 * is never persisted — only `tokenHash` (a keyed hash of the opaque secret)
 * so a leaked database cannot be used to mint valid cookies, and a stolen
 * cookie cannot be reconstructed from the database.
 */
export const browserSessions = pgTable(
  "browser_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    rotatedFromId: uuid("rotated_from_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("browser_sessions_token_hash_idx").on(table.tokenHash),
    index("browser_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * A case's draft is a single JSON document; `revision` is bumped on every
 * successful save and used as an optimistic-concurrency token (compare-and-
 * swap in the repository layer) so concurrent tabs cannot silently clobber
 * each other's edits.
 */
export const cases = pgTable(
  "cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => browserSessions.id, { onDelete: "cascade" }),
    draft: jsonb("draft").notNull().default(sql`'{}'::jsonb`),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cases_session_id_idx").on(table.sessionId)],
);

/** Normalized core record for the two adult parties on a case. */
export const caseParticipants = pgTable(
  "case_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    role: participantRoleEnum("role").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("case_participants_case_id_idx").on(table.caseId),
    uniqueIndex("case_participants_case_id_role_idx").on(table.caseId, table.role),
  ],
);

/** Normalized core record for a child listed on a case. */
export const caseChildren = pgTable(
  "case_children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    dateOfBirth: text("date_of_birth"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("case_children_case_id_idx").on(table.caseId)],
);

/**
 * Document metadata only. `objectKey` is a randomized, non-user-controlled
 * pointer resolved by a storage adapter (src/server/storage) — the raw bytes
 * never touch this table. `sourceExpiresAt` drives the 7-day source
 * retention/reconciliation job.
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => browserSessions.id, { onDelete: "cascade" }),
    storageProvider: documentStorageProviderEnum("storage_provider").notNull(),
    objectKey: text("object_key").notNull(),
    displayFilename: text("display_filename").notNull(),
    declaredMimeType: text("declared_mime_type").notNull(),
    detectedMimeType: text("detected_mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    sourceExpiresAt: timestamp("source_expires_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("documents_case_id_idx").on(table.caseId),
    index("documents_session_id_idx").on(table.sessionId),
    uniqueIndex("documents_object_key_idx").on(table.objectKey),
    index("documents_source_expires_at_idx").on(table.sourceExpiresAt),
  ],
);

/**
 * One row per extraction attempt against a document. `isDemo` must be true
 * only for the mock adapter's designated demo document so downstream UI can
 * render an explicit "demo data" label — see src/server/extraction.
 */
export const extractionRuns = pgTable(
  "extraction_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    adapter: text("adapter").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    status: extractionRunStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("extraction_runs_case_id_idx").on(table.caseId),
    index("extraction_runs_document_id_idx").on(table.documentId),
  ],
);

/**
 * Untrusted, model/human-proposed field values. `value` is never trusted
 * until `status` transitions to `confirmed` (see
 * src/server/extraction/proposals.ts, which is the only code path allowed to
 * map proposals into calculation facts, and only for confirmed rows).
 */
export const extractionProposals = pgTable(
  "extraction_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extractionRunId: uuid("extraction_run_id")
      .notNull()
      .references(() => extractionRuns.id, { onDelete: "cascade" }),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    value: jsonb("value").notNull(),
    confirmedValue: jsonb("confirmed_value"),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    sourcePage: integer("source_page"),
    sourceLocation: jsonb("source_location"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    status: extractionProposalStatusEnum("status").notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("extraction_proposals_case_id_idx").on(table.caseId),
    index("extraction_proposals_run_id_idx").on(table.extractionRunId),
    index("extraction_proposals_status_idx").on(table.status),
  ],
);

/** Snapshot of a single calculation invocation for auditability. */
export const calculationRuns = pgTable(
  "calculation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    caseRevision: integer("case_revision").notNull(),
    engineVersion: text("engine_version").notNull(),
    inputs: jsonb("inputs").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("calculation_runs_case_id_idx").on(table.caseId)],
);

/**
 * Generated output artifacts (e.g. court-ready PDFs). Stored in a separate
 * storage container/prefix from source documents and not subject to the
 * 7-day source retention window.
 */
export const generatedPackages = pgTable(
  "generated_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    caseRevision: integer("case_revision").notNull(),
    storageProvider: documentStorageProviderEnum("storage_provider").notNull(),
    objectKey: text("object_key").notNull(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("generated_packages_case_id_idx").on(table.caseId),
    uniqueIndex("generated_packages_object_key_idx").on(table.objectKey),
  ],
);

/** Append-only audit trail. Never includes document contents. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => browserSessions.id, {
      onDelete: "set null",
    }),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_session_id_idx").on(table.sessionId),
    index("audit_log_case_id_idx").on(table.caseId),
  ],
);

export const browserSessionsRelations = relations(browserSessions, ({ many }) => ({
  cases: many(cases),
  documents: many(documents),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  session: one(browserSessions, {
    fields: [cases.sessionId],
    references: [browserSessions.id],
  }),
  participants: many(caseParticipants),
  children: many(caseChildren),
  documents: many(documents),
  extractionRuns: many(extractionRuns),
  extractionProposals: many(extractionProposals),
  calculationRuns: many(calculationRuns),
  generatedPackages: many(generatedPackages),
}));

export const caseParticipantsRelations = relations(caseParticipants, ({ one }) => ({
  case: one(cases, { fields: [caseParticipants.caseId], references: [cases.id] }),
}));

export const caseChildrenRelations = relations(caseChildren, ({ one }) => ({
  case: one(cases, { fields: [caseChildren.caseId], references: [cases.id] }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  case: one(cases, { fields: [documents.caseId], references: [cases.id] }),
  session: one(browserSessions, {
    fields: [documents.sessionId],
    references: [browserSessions.id],
  }),
  extractionRuns: many(extractionRuns),
}));

export const extractionRunsRelations = relations(extractionRuns, ({ one, many }) => ({
  case: one(cases, { fields: [extractionRuns.caseId], references: [cases.id] }),
  document: one(documents, {
    fields: [extractionRuns.documentId],
    references: [documents.id],
  }),
  proposals: many(extractionProposals),
}));

export const extractionProposalsRelations = relations(extractionProposals, ({ one }) => ({
  run: one(extractionRuns, {
    fields: [extractionProposals.extractionRunId],
    references: [extractionRuns.id],
  }),
  case: one(cases, { fields: [extractionProposals.caseId], references: [cases.id] }),
  sourceDocument: one(documents, {
    fields: [extractionProposals.sourceDocumentId],
    references: [documents.id],
  }),
}));

export const calculationRunsRelations = relations(calculationRuns, ({ one }) => ({
  case: one(cases, { fields: [calculationRuns.caseId], references: [cases.id] }),
}));

export const generatedPackagesRelations = relations(generatedPackages, ({ one }) => ({
  case: one(cases, { fields: [generatedPackages.caseId], references: [cases.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  session: one(browserSessions, {
    fields: [auditLog.sessionId],
    references: [browserSessions.id],
  }),
  case: one(cases, { fields: [auditLog.caseId], references: [cases.id] }),
}));
