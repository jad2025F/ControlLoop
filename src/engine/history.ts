import { diffGraphStates } from "./diff";
import { cloneGraph } from "./graph";
import { calculateSecurityHealth } from "./health";
import {
  type ChangeRecord,
  type DomainEvent,
  type EventId,
  type GraphHistory,
  type GraphSnapshot,
  type GraphState,
  type IsoTimestamp,
  type SnapshotId,
} from "./types";

export class HistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoryError";
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function parseTimestamp(value: IsoTimestamp, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new HistoryError(`${label} is not a valid ISO timestamp: ${value}`);
  }
  return parsed;
}

function assertSnapshotHealth(snapshot: GraphSnapshot, label: string): void {
  const derived = calculateSecurityHealth(snapshot.graphState);
  if (JSON.stringify(derived) !== JSON.stringify(snapshot.health)) {
    throw new HistoryError(`${label} Health result does not match its graph state`);
  }
}

/**
 * Captures a detached, immutable evaluated graph state using only caller-supplied
 * identity/time data and the existing deterministic Security Health calculator.
 */
export function createSnapshot(
  snapshotId: SnapshotId,
  graph: GraphState,
  capturedAt: IsoTimestamp,
  triggeringEventId: EventId | null = null,
): GraphSnapshot {
  parseTimestamp(capturedAt, "snapshot capturedAt");

  const graphState = cloneGraph(graph);
  const health = calculateSecurityHealth(graphState);

  return deepFreeze({
    snapshotId,
    capturedAt,
    triggeringEventId,
    graphState,
    health,
  });
}

/**
 * Records one deterministic BEFORE -> CHANGE -> AFTER transition. Meaningful
 * changed nodes are sourced from the existing semantic graph diff, so temporal
 * bookkeeping alone does not create history noise.
 */
export function recordTransition(
  beforeSnapshot: GraphSnapshot,
  event: DomainEvent,
  afterSnapshot: GraphSnapshot,
): ChangeRecord {
  const beforeTime = parseTimestamp(beforeSnapshot.capturedAt, "before snapshot capturedAt");
  const afterTime = parseTimestamp(afterSnapshot.capturedAt, "after snapshot capturedAt");
  const eventTime = parseTimestamp(event.timestamp, "event timestamp");

  if (beforeTime >= afterTime) {
    throw new HistoryError(
      `before snapshot ${beforeSnapshot.snapshotId} must be earlier than after snapshot ${afterSnapshot.snapshotId}`,
    );
  }
  if (eventTime < beforeTime || eventTime > afterTime) {
    throw new HistoryError(`event ${event.id} timestamp must fall between before and after snapshots`);
  }
  if (afterSnapshot.triggeringEventId !== event.id) {
    throw new HistoryError(
      `after snapshot ${afterSnapshot.snapshotId} triggering event ${String(afterSnapshot.triggeringEventId)} does not match ${event.id}`,
    );
  }

  assertSnapshotHealth(beforeSnapshot, "before snapshot");
  assertSnapshotHealth(afterSnapshot, "after snapshot");

  const diff = diffGraphStates(beforeSnapshot.graphState, afterSnapshot.graphState);
  const changedNodeIds = diff.nodeChanges.map((change) => change.nodeId).sort((a, b) => a.localeCompare(b));

  return deepFreeze({
    event: cloneJson(event),
    beforeSnapshotId: beforeSnapshot.snapshotId,
    afterSnapshotId: afterSnapshot.snapshotId,
    changedNodeIds,
    healthBefore: beforeSnapshot.health.score,
    healthAfter: afterSnapshot.health.score,
    healthDelta: afterSnapshot.health.score - beforeSnapshot.health.score,
  });
}

/** Lightweight in-memory history view for deterministic lookup and ordering. */
export function createHistory(
  snapshots: readonly GraphSnapshot[],
  changeRecords: readonly ChangeRecord[],
): GraphHistory {
  const orderedSnapshots = snapshots.map((snapshot) => cloneJson(snapshot)).sort((left, right) => {
    const timeDelta = parseTimestamp(left.capturedAt, "snapshot capturedAt") - parseTimestamp(right.capturedAt, "snapshot capturedAt");
    return timeDelta !== 0 ? timeDelta : left.snapshotId.localeCompare(right.snapshotId);
  });

  const snapshotIds = new Set<string>();
  for (const snapshot of orderedSnapshots) {
    if (snapshotIds.has(snapshot.snapshotId)) {
      throw new HistoryError(`duplicate snapshot ID: ${snapshot.snapshotId}`);
    }
    snapshotIds.add(snapshot.snapshotId);
  }

  const eventIds = new Set<string>();
  for (const record of changeRecords) {
    if (eventIds.has(record.event.id)) {
      throw new HistoryError(`duplicate history event ID: ${record.event.id}`);
    }
    if (!snapshotIds.has(record.beforeSnapshotId) || !snapshotIds.has(record.afterSnapshotId)) {
      throw new HistoryError(`change record ${record.event.id} references unknown snapshot`);
    }
    eventIds.add(record.event.id);
  }

  const orderedChangeRecords = changeRecords.map((record) => cloneJson(record)).sort((left, right) => {
    const timeDelta = parseTimestamp(left.event.timestamp, "event timestamp") - parseTimestamp(right.event.timestamp, "event timestamp");
    return timeDelta !== 0 ? timeDelta : left.event.id.localeCompare(right.event.id);
  });

  return deepFreeze({
    snapshots: orderedSnapshots,
    changeRecords: orderedChangeRecords,
  });
}

export function getSnapshotById(
  history: GraphHistory,
  snapshotId: SnapshotId,
): GraphSnapshot | undefined {
  return history.snapshots.find((snapshot) => snapshot.snapshotId === snapshotId);
}

export function getChangeRecordByEventId(
  history: GraphHistory,
  eventId: EventId,
): ChangeRecord | undefined {
  return history.changeRecords.find((record) => record.event.id === eventId);
}

export function getSnapshotsChronologically(history: GraphHistory): GraphSnapshot[] {
  return history.snapshots.slice();
}
