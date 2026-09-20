import { DomainEventType, type ConfigurationChangedEvent } from "../engine/types";
import { NOVASTACK_IDS } from "./novastack-baseline";

export const NOVASTACK_S3_PUBLIC_EVENT_TIME = "2026-09-19T17:15:00-04:00";

/** External drift input only: no downstream security state is precomputed here. */
export const novastackS3PublicEvent: ConfigurationChangedEvent = {
  id: "event:novastack-s3-public-access-enabled",
  type: DomainEventType.CONFIGURATION_CHANGED,
  targetConfigurationId: NOVASTACK_IDS.s3PublicAccessConfiguration,
  beforeValue: false,
  afterValue: true,
  source: "fixture",
  timestamp: NOVASTACK_S3_PUBLIC_EVENT_TIME,
};
