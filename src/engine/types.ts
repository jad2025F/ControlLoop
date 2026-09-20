export type NodeId = string;
export type EdgeId = string;
export type EventId = string;
export type SnapshotId = string;
export type SimulationId = string;
export type IsoTimestamp = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface TemporalInfo {
  validFrom: IsoTimestamp;
  validUntil: IsoTimestamp | null;
  lastChanged: IsoTimestamp;
  source: string;
}

export enum ThreatConditionStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum AttackStepStatus {
  ACTIVE = "ACTIVE",
  BLOCKED = "BLOCKED",
}

export enum AttackPathStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum RiskStatus {
  ACTIVE = "ACTIVE",
  MITIGATED = "MITIGATED",
}

export enum ControlStatus {
  VERIFIED = "VERIFIED",
  DEGRADED = "DEGRADED",
  NEEDS_REVIEW = "NEEDS_REVIEW",
}

export enum EvidenceStatus {
  VALID = "VALID",
  INVALID = "INVALID",
  EXPIRED = "EXPIRED",
}

export enum FrameworkRequirementStatus {
  SUPPORTED = "SUPPORTED",
  AFFECTED = "AFFECTED",
}

export enum ActionStatus {
  AVAILABLE = "AVAILABLE",
  RECOMMENDED = "RECOMMENDED",
}

export enum RiskSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum ControlCriticality {
  STANDARD = "STANDARD",
  CRITICAL = "CRITICAL",
}

export enum Framework {
  NIST = "NIST",
  CIS = "CIS",
  SOC2 = "SOC2",
}

export type ActionPriority = "LOW" | "MEDIUM" | "HIGH";

interface BaseNode extends TemporalInfo {
  id: NodeId;
  label: string;
}

export interface CompanyNode extends BaseNode {
  type: "Company";
  name: string;
  industry: string;
  approximateEmployeeCount: number;
  systems: string[];
  dataClasses: string[];
}

export interface AssetNode extends BaseNode {
  type: "Asset";
  assetKind: string;
  provider: string;
  criticality: string;
  dataClassification: string;
}

export interface ConfigurationNode extends BaseNode {
  type: "Configuration";
  assetId: NodeId;
  key: string;
  value: JsonValue;
}

export interface ThreatConditionNode extends BaseNode {
  type: "ThreatCondition";
  conditionKey: string;
  status: ThreatConditionStatus;
  ruleId: string;
}

export interface AttackStepNode extends BaseNode {
  type: "AttackStep";
  stepKey: string;
  ordinal: number;
  status: AttackStepStatus;
}

export interface AttackPathNode extends BaseNode {
  type: "AttackPath";
  pathKey: string;
  stepIds: NodeId[];
  status: AttackPathStatus;
  ruleId: string;
}

export interface RiskNode extends BaseNode {
  type: "Risk";
  riskKey: string;
  severity: RiskSeverity;
  status: RiskStatus;
  businessImpact: string;
  sourceAttackPathIds: NodeId[];
}

export interface ControlNode extends BaseNode {
  type: "Control";
  controlKey: string;
  criticality: ControlCriticality;
  status: ControlStatus;
  objective: string;
  ruleId: string;
}

export interface EvidenceNode extends BaseNode {
  type: "Evidence";
  evidenceKey: string;
  evidenceKind: string;
  controlId: NodeId;
  status: EvidenceStatus;
  observedValue: JsonValue;
  requiredValue: JsonValue;
  expiresAt: IsoTimestamp | null;
}

export interface FrameworkRequirementNode extends BaseNode {
  type: "FrameworkRequirement";
  framework: Framework;
  reference: string;
  title: string;
  status: FrameworkRequirementStatus;
}

export interface ActionNode extends BaseNode {
  type: "Action";
  actionKey: string;
  title: string;
  priority: ActionPriority;
  status: ActionStatus;
  configurationId: NodeId;
  proposedValue: JsonValue;
}

export type GraphNode =
  | CompanyNode
  | AssetNode
  | ConfigurationNode
  | ThreatConditionNode
  | AttackStepNode
  | AttackPathNode
  | RiskNode
  | ControlNode
  | EvidenceNode
  | FrameworkRequirementNode
  | ActionNode;

export type GraphNodeType = GraphNode["type"];

export enum EdgeType {
  OWNS = "OWNS",
  HAS_CONFIGURATION = "HAS_CONFIGURATION",
  ENABLES = "ENABLES",
  CONTAINS_STEP = "CONTAINS_STEP",
  NEXT_STEP = "NEXT_STEP",
  CREATES = "CREATES",
  MITIGATES = "MITIGATES",
  PROVES = "PROVES",
  MAPS_TO = "MAPS_TO",
  MODIFIES = "MODIFIES",
}

export interface GraphEdge {
  id: EdgeId;
  type: EdgeType;
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
}

export interface GraphState {
  version: number;
  companyId: NodeId;
  evaluatedAt: IsoTimestamp;
  nodes: Record<NodeId, GraphNode>;
  edges: Record<EdgeId, GraphEdge>;
}

export interface GraphInput {
  version: number;
  companyId: NodeId;
  evaluatedAt: IsoTimestamp;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export enum DomainEventType {
  CONFIGURATION_CHANGED = "CONFIGURATION_CHANGED",
}

export interface ConfigurationChangedEvent {
  id: EventId;
  type: DomainEventType.CONFIGURATION_CHANGED;
  targetConfigurationId: NodeId;
  beforeValue: JsonValue;
  afterValue: JsonValue;
  source: string;
  timestamp: IsoTimestamp;
}

export type DomainEvent = ConfigurationChangedEvent;

export type HealthPenaltyReason =
  | "Active attack path"
  | "Active HIGH risk"
  | "Active MEDIUM risk"
  | "Active LOW risk"
  | "Degraded CRITICAL control"
  | "CRITICAL control needs review"
  | "Invalid evidence"
  | "Expired evidence";

export interface HealthPenalty {
  nodeId: NodeId;
  nodeType: GraphNodeType;
  label: string;
  reason: HealthPenaltyReason;
  amount: number;
}

export interface HealthResult {
  score: number;
  baseScore: number;
  totalPenalty: number;
  penaltyBreakdown: HealthPenalty[];
}


export interface SimulationContext {
  simulationId: SimulationId;
  timestamp: IsoTimestamp;
}

export interface SimulationResult {
  simulationId: SimulationId;
  actionId: NodeId;
  simulationTimestamp: IsoTimestamp;
  currentHealth: HealthResult;
  projectedHealth: HealthResult;
  simulatedGraph: GraphState;
}

export interface NodeFieldChange {
  path: string;
  beforeValue: JsonValue;
  afterValue: JsonValue;
}

export interface GraphNodeChange {
  nodeId: NodeId;
  nodeType: GraphNodeType;
  nodeLabel: string;
  changedFields: NodeFieldChange[];
}

export interface GraphEdgeChanges {
  added: GraphEdge[];
  removed: GraphEdge[];
}

export interface GraphDiffSemanticSummary {
  configurationChanges: number;
  threatConditionsResolved: number;
  attackStepsBlocked: number;
  attackPathsDeactivated: number;
  highRisksMitigated: number;
  criticalControlsRestored: number;
  evidenceRestored: number;
  frameworkRequirementsImproved: number;
  recommendationsResolved: number;
  healthImprovement: number;
}

export interface GraphDiff {
  sourceGraphVersion: number;
  targetGraphVersion: number;
  healthBefore: number;
  healthAfter: number;
  healthDelta: number;
  nodeChanges: GraphNodeChange[];
  edgeChanges: GraphEdgeChanges;
  semanticSummary: GraphDiffSemanticSummary;
}

export interface GraphSnapshot {
  snapshotId: SnapshotId;
  capturedAt: IsoTimestamp;
  triggeringEventId: EventId | null;
  graphState: GraphState;
  health: HealthResult;
}

export interface ChangeRecord {
  event: DomainEvent;
  beforeSnapshotId: SnapshotId;
  afterSnapshotId: SnapshotId;
  changedNodeIds: NodeId[];
  healthBefore: number;
  healthAfter: number;
  healthDelta: number;
}

export interface GraphHistory {
  snapshots: GraphSnapshot[];
  changeRecords: ChangeRecord[];
}

export interface OverviewRecentChangeDTO {
  eventId: EventId;
  title: string;
  timestamp: IsoTimestamp;
  healthBefore: number;
  healthAfter: number;
  healthDelta: number;
}

export interface OverviewDTO {
  companyId: NodeId;
  companyName: string;
  industry: string;
  approximateEmployeeCount: number;
  systems: string[];
  currentHealth: number;
  securityDriftPresent: boolean;
  activeAttackPathCount: number;
  activeHighRiskCount: number;
  degradedCriticalControlCount: number;
  invalidEvidenceCount: number;
  recommendedActionCount: number;
  recentChange: OverviewRecentChangeDTO | null;
}

export interface TimelineSnapshotDTO {
  snapshotId: SnapshotId;
  timestamp: IsoTimestamp;
  label: string;
  healthScore: number;
  triggeringEventId: EventId | null;
}

export interface TimelineTransitionDTO {
  eventId: EventId;
  eventTitle: string;
  timestamp: IsoTimestamp;
  beforeHealth: number;
  afterHealth: number;
  healthDelta: number;
}

export interface TimelineDTO {
  snapshots: TimelineSnapshotDTO[];
  transitions: TimelineTransitionDTO[];
}

export interface ChangeImpactStageDTO {
  nodeId: NodeId;
  nodeType: GraphNodeType;
  label: string;
  beforeValue: JsonValue;
  afterValue: JsonValue;
}

export interface FrameworkImpactDTO {
  nodeId: NodeId;
  framework: Framework;
  reference: string;
  title: string;
  beforeStatus: FrameworkRequirementStatus;
  afterStatus: FrameworkRequirementStatus;
}

export interface ChangeImpactDTO {
  event: {
    id: EventId;
    title: string;
    timestamp: IsoTimestamp;
  };
  configurationChange: {
    nodeId: NodeId;
    label: string;
    key: string;
    beforeValue: JsonValue;
    afterValue: JsonValue;
  };
  health: {
    before: number;
    after: number;
    delta: number;
  };
  businessImpact: string | null;
  causalChain: {
    configuration: ChangeImpactStageDTO;
    threatCondition: ChangeImpactStageDTO | null;
    attackPath: ChangeImpactStageDTO | null;
    risk: ChangeImpactStageDTO | null;
    control: ChangeImpactStageDTO | null;
    evidence: ChangeImpactStageDTO | null;
    frameworkRequirements: FrameworkImpactDTO[];
    action: ChangeImpactStageDTO | null;
  };
}

export interface GraphNodeDTO {
  id: NodeId;
  nodeType: GraphNodeType;
  label: string;
  state?: JsonValue;
  severity?: RiskSeverity;
  framework?: Framework;
}

export interface GraphEdgeDTO {
  id: EdgeId;
  edgeType: EdgeType;
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
}

export interface GraphDTO {
  graphVersion: number;
  evaluatedAt: IsoTimestamp;
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
}

export interface SimulationEffectsDTO {
  attackPathsDeactivated: number;
  highRisksMitigated: number;
  criticalControlsRestored: number;
  evidenceRestored: number;
  frameworkMappingsImproved: number;
  recommendationsResolved: number;
}

export interface SimulationDTO {
  simulationId: SimulationId;
  timestamp: IsoTimestamp;
  action: {
    id: NodeId;
    title: string;
    priority: ActionPriority;
  };
  health: {
    current: number;
    projected: number;
    delta: number;
  };
  expectedEffects: SimulationEffectsDTO;
  nodeChanges: GraphNodeChange[];
}

export interface ActionCenterItemDTO {
  actionId: NodeId;
  title: string;
  priority: ActionPriority;
  status: ActionStatus;
  targetConfigurationLabel: string;
  currentValue: JsonValue;
  proposedValue: JsonValue;
  currentHealth: number;
  projectedHealth: number;
  healthImprovement: number;
  expectedEffects: SimulationEffectsDTO;
}

export interface ActionCenterDTO {
  actions: ActionCenterItemDTO[];
}

export interface ControlLoopDemoViewModel {
  overview: OverviewDTO;
  timeline: TimelineDTO;
  changeImpact: ChangeImpactDTO;
  graph: GraphDTO;
  simulation: SimulationDTO;
  actionCenter: ActionCenterDTO;
}
