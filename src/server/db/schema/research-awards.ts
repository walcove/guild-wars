import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  boolean,
  timestamp,
  unique,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { id, createdAt } from "./common";
import { users } from "./identity";
import { guilds } from "./guilds";
import { forecasts, bounties } from "./research";
export const forecastRegistrations = pgTable(
  "forecast_registrations",
  {
    forecastId: uuid("forecast_id")
      .primaryKey()
      .references(() => forecasts.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    requestId: uuid("request_id").notNull(),
    termsHash: text("terms_hash").notNull(),
    supersedesId: uuid("supersedes_id").references(() => forecasts.id),
    createdAt: createdAt(),
  },
  (t) => [unique("forecast_request").on(t.authorId, t.requestId)]
);
export const forecastResolutions = pgTable(
  "forecast_resolutions",
  {
    id: id(),
    forecastId: uuid("forecast_id")
      .notNull()
      .references(() => forecasts.id),
    revision: text("revision").notNull(),
    record: jsonb("record").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("forecast_resolution_revision").on(t.forecastId, t.revision)]
);
export const researchSubmissions = pgTable(
  "research_submissions",
  {
    id: id(),
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    bountyId: uuid("bounty_id").references(() => bounties.id),
    forecastId: uuid("forecast_id").references(() => forecasts.id),
    requestId: uuid("request_id").notNull(),
    contentHash: text("content_hash").notNull(),
    record: jsonb("record").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("research_submission_request").on(t.authorId, t.requestId),
    unique("research_duplicate_work").on(t.guildId, t.contentHash),
    index("submissions_guild_time").on(t.guildId, t.createdAt, t.id),
  ]
);
export const researchAssignments = pgTable(
  "research_assignments",
  {
    id: id(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => researchSubmissions.id),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    generation: integer("generation").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("assigned_reviewer_generation").on(
      t.submissionId,
      t.reviewerId,
      t.generation
    ),
    index("assignment_reviewer_time").on(t.reviewerId, t.createdAt),
  ]
);
export const researchReviews = pgTable("research_reviews", {
  id: id(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .unique()
    .references(() => researchAssignments.id),
  accept: boolean("accept").notNull(),
  verifiedUseful: boolean("verified_useful").notNull(),
  reason: text("reason").notNull(),
  verification: text("verification").notNull(),
  createdAt: createdAt(),
});
export const researchOutcomes = pgTable(
  "research_outcomes",
  {
    id: id(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => researchSubmissions.id),
    generation: integer("generation").notNull(),
    accepted: boolean("accepted").notNull(),
    reason: text("reason").notNull(),
    appealClosesAt: timestamp("appeal_closes_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("award_generation_outcome").on(t.submissionId, t.generation)]
);
export const researchAppeals = pgTable("research_appeals", {
  id: id(),
  outcomeId: uuid("outcome_id")
    .notNull()
    .unique()
    .references(() => researchOutcomes.id),
  submissionId: uuid("submission_id")
    .notNull()
    .unique()
    .references(() => researchSubmissions.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});
export const researchDigestSubscriptions = pgTable(
  "research_digest_subscriptions",
  {
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    botId: text("bot_id").notNull(),
    active: boolean("active").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId, t.botId] })]
);
export const researchAssignmentCycles = pgTable(
  "research_assignment_cycles",
  {
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => researchSubmissions.id),
    generation: integer("generation").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.submissionId, t.generation] })]
);
export const researchConflicts = pgTable(
  "research_conflicts",
  {
    id: id(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => researchSubmissions.id),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("declared_award_conflict").on(t.submissionId, t.reviewerId)]
);
