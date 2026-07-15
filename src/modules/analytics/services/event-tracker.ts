/**
 * Event Tracking Service — Captures user actions for analytics.
 *
 * Events are stored in the database with tenant isolation.
 * Supports custom event types and properties.
 *
 * @module analytics/services/event-tracker
 */

import { eq, and, sql, count, desc } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";

// ─── Schema ─────────────────────────────────────────────────────────────

/**
 * Analytics events table — stores tracked user actions.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantSlug: text("tenant_slug").notNull(),
    eventType: text("event_type").notNull(),
    eventName: text("event_name").notNull(),
    userId: text("user_id"),
    properties: jsonb("properties").$type<Record<string, any>>().default({}),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_analytics_events_tenant").on(table.tenantSlug),
    index("idx_analytics_events_type").on(table.eventType),
    index("idx_analytics_events_created").on(table.createdAt),
    index("idx_analytics_events_name").on(table.eventName),
  ]
);

// ─── Types ──────────────────────────────────────────────────────────────

export interface TrackEventInput {
  tenantSlug: string;
  eventType: string;
  eventName: string;
  userId?: string;
  properties?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EventAggregate {
  eventType: string;
  eventName: string;
  count: number;
  lastSeen: Date;
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Track an analytics event.
 *
 * Uses fire-and-forget with a simple in-memory buffer for retry on transient failures.
 * Events are batched and flushed periodically to reduce DB overhead.
 */
const eventBuffer: TrackEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBuffer(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const events = eventBuffer.splice(0, eventBuffer.length); // Take all events

  try {
    await db()
      .insert(analyticsEvents)
      .values(
        events.map((e) => ({
          tenantSlug: e.tenantSlug,
          eventType: e.eventType,
          eventName: e.eventName,
          userId: e.userId,
          properties: e.properties ?? {},
          metadata: e.metadata ?? {},
        }))
      );
  } catch (err) {
    console.error("[EventTracker] Failed to flush events:", err);
    // Re-add failed events to buffer for retry (max 1000 to prevent memory leak)
    if (eventBuffer.length < 1000) {
      eventBuffer.push(...events.slice(0, 1000 - eventBuffer.length));
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushBuffer();
  }, 5000); // Flush every 5 seconds
  flushTimer.unref();
}

export async function trackEvent(input: TrackEventInput): Promise<void> {
  eventBuffer.push(input);
  scheduleFlush();
}

/**
 * Flush pending events immediately (for shutdown or testing).
 */
export async function flushEvents(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushBuffer();
}

/**
 * Get event counts by type for a tenant.
 */
export async function getEventCounts(
  tenantSlug: string,
  options?: { from?: string; to?: string },
): Promise<EventAggregate[]> {
  const conditions = [eq(analyticsEvents.tenantSlug, tenantSlug)];

  if (options?.from) {
    conditions.push(sql`${analyticsEvents.createdAt} >= ${options.from}`);
  }
  if (options?.to) {
    conditions.push(sql`${analyticsEvents.createdAt} <= ${options.to}`);
  }

  const rows = await db()
    .select({
      eventType: analyticsEvents.eventType,
      eventName: analyticsEvents.eventName,
      count: count(),
      lastSeen: sql<Date>`max(${analyticsEvents.createdAt})`,
    })
    .from(analyticsEvents)
    .where(and(...conditions))
    .groupBy(analyticsEvents.eventType, analyticsEvents.eventName)
    .orderBy(desc(count()));

  return rows.map((r) => ({
    eventType: r.eventType,
    eventName: r.eventName,
    count: r.count,
    lastSeen: r.lastSeen,
  }));
}

/**
 * Get daily event counts for a specific event type.
 */
export async function getDailyEventCounts(
  tenantSlug: string,
  eventType: string,
  options?: { from?: string; to?: string },
): Promise<Array<{ date: string; count: number }>> {
  const conditions = [
    eq(analyticsEvents.tenantSlug, tenantSlug),
    eq(analyticsEvents.eventType, eventType),
  ];

  if (options?.from) {
    conditions.push(sql`${analyticsEvents.createdAt} >= ${options.from}`);
  }
  if (options?.to) {
    conditions.push(sql`${analyticsEvents.createdAt} <= ${options.to}`);
  }

  const rows = await db()
    .select({
      date: sql<string>`DATE(${analyticsEvents.createdAt})::text`,
      count: count(),
    })
    .from(analyticsEvents)
    .where(and(...conditions))
    .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
    .orderBy(sql`DATE(${analyticsEvents.createdAt})`);

  return rows.map((r) => ({ date: r.date, count: r.count }));
}

/**
 * Get recent events for a tenant.
 */
export async function getRecentEvents(
  tenantSlug: string,
  limit = 50,
): Promise<Array<{
  id: string;
  eventType: string;
  eventName: string;
  userId: string | null;
  properties: Record<string, any>;
  createdAt: Date;
}>> {
  const rows = await db()
    .select({
      id: analyticsEvents.id,
      eventType: analyticsEvents.eventType,
      eventName: analyticsEvents.eventName,
      userId: analyticsEvents.userId,
      properties: analyticsEvents.properties,
      createdAt: analyticsEvents.createdAt,
    })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.tenantSlug, tenantSlug))
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    properties: (r.properties as Record<string, any>) ?? {},
  }));
}
