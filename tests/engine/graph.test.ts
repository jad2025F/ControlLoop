import {
  cloneGraph,
  createGraph,
  getIncomingEdges,
  getNode,
  getNodesByType,
  getOutgoingEdges,
  validateGraph,
} from "../../src/engine/graph";
import {
  EdgeType,
  FrameworkRequirementStatus,
  type ConfigurationNode,
  type GraphEdge,
  type GraphNode,
} from "../../src/engine/types";
import {
  NOVASTACK_IDS,
  novastackBaseline,
} from "../../src/fixtures/novastack-baseline";

type TestCase = { name: string; run: () => void };
const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}. Expected ${expectedJson}, received ${actualJson}`);
  }
}

function assertThrows(run: () => void, pattern: RegExp, message: string): void {
  try {
    run();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!pattern.test(text)) {
      throw new Error(`${message}. Error did not match ${pattern}: ${text}`);
    }
    return;
  }
  throw new Error(`${message}. Expected function to throw.`);
}

function graphAsInput() {
  const clone = cloneGraph(novastackBaseline);
  return {
    version: clone.version,
    companyId: clone.companyId,
    evaluatedAt: clone.evaluatedAt,
    nodes: Object.values(clone.nodes),
    edges: Object.values(clone.edges),
  };
}

test("1. NovaStack baseline graph validates successfully", () => {
  validateGraph(novastackBaseline);
});

test("2. Node lookup returns the expected S3 configuration", () => {
  const node = getNode(novastackBaseline, NOVASTACK_IDS.s3PublicAccessConfiguration);
  assert(node?.type === "Configuration", "Expected S3 configuration node");
  assertEqual((node as ConfigurationNode).value, false, "S3 public access must be false");
});

test("3. Nodes can be filtered by node type", () => {
  const requirements = getNodesByType(novastackBaseline, "FrameworkRequirement");
  assertEqual(requirements.length, 3, "Expected three framework requirements");
  assert(
    requirements.every((node) => node.status === FrameworkRequirementStatus.SUPPORTED),
    "All framework requirements must be SUPPORTED",
  );
});

test("4. Incoming/outgoing edge queries return expected relationships", () => {
  const outgoing = getOutgoingEdges(novastackBaseline, NOVASTACK_IDS.restrictPublicS3Action);
  const incoming = getIncomingEdges(novastackBaseline, NOVASTACK_IDS.s3PublicAccessConfiguration);

  assertEqual(outgoing.length, 1, "Action should have one outgoing edge");
  assertEqual(outgoing[0].type, EdgeType.MODIFIES, "Action edge should be MODIFIES");
  assertEqual(
    outgoing[0].targetNodeId,
    NOVASTACK_IDS.s3PublicAccessConfiguration,
    "Action should target S3 configuration",
  );
  assert(
    incoming.some((edge) => edge.type === EdgeType.HAS_CONFIGURATION),
    "Configuration should have HAS_CONFIGURATION incoming edge",
  );
  assert(
    incoming.some((edge) => edge.type === EdgeType.MODIFIES),
    "Configuration should have MODIFIES incoming edge",
  );
});

test("5. Duplicate node IDs are rejected", () => {
  const input = graphAsInput();
  input.nodes.push({ ...input.nodes[0] } as GraphNode);
  assertThrows(() => createGraph(input), /duplicate node ID/, "Duplicate node ID must be rejected");
});

test("6. Duplicate edge IDs are rejected", () => {
  const input = graphAsInput();
  input.edges.push({ ...input.edges[0] } as GraphEdge);
  assertThrows(() => createGraph(input), /duplicate edge ID/, "Duplicate edge ID must be rejected");
});

test("7. Edge references to nonexistent nodes are rejected", () => {
  const graph = cloneGraph(novastackBaseline);
  graph.edges["edge:invalid"] = {
    id: "edge:invalid",
    type: EdgeType.ENABLES,
    sourceNodeId: NOVASTACK_IDS.company,
    targetNodeId: "node:does-not-exist",
  };
  assertThrows(() => validateGraph(graph), /nonexistent target node/, "Invalid edge target must be rejected");
});

test("8. Invalid AttackPath step references are rejected", () => {
  const graph = cloneGraph(novastackBaseline);
  const path = graph.nodes[NOVASTACK_IDS.primaryS3AttackPath];
  assert(path.type === "AttackPath", "Fixture attack path type mismatch");
  path.stepIds[1] = "attack-step:missing";
  assertThrows(() => validateGraph(graph), /nonexistent AttackStep/, "Invalid step reference must be rejected");
});

test("9. Invalid Configuration → Asset references are rejected", () => {
  const graph = cloneGraph(novastackBaseline);
  const configuration = graph.nodes[NOVASTACK_IDS.s3PublicAccessConfiguration];
  assert(configuration.type === "Configuration", "Fixture configuration type mismatch");
  configuration.assetId = "asset:missing";
  assertThrows(() => validateGraph(graph), /nonexistent Asset/, "Invalid asset reference must be rejected");
});

test("10. Invalid Evidence → Control references are rejected", () => {
  const graph = cloneGraph(novastackBaseline);
  const evidence = graph.nodes[NOVASTACK_IDS.s3PrivateEvidence];
  assert(evidence.type === "Evidence", "Fixture evidence type mismatch");
  evidence.controlId = "control:missing";
  assertThrows(() => validateGraph(graph), /nonexistent Control/, "Invalid control reference must be rejected");
});

test("11. Invalid Action → Configuration references are rejected", () => {
  const graph = cloneGraph(novastackBaseline);
  const action = graph.nodes[NOVASTACK_IDS.restrictPublicS3Action];
  assert(action.type === "Action", "Fixture action type mismatch");
  action.configurationId = "config:missing";
  assertThrows(
    () => validateGraph(graph),
    /nonexistent Configuration/,
    "Invalid configuration reference must be rejected",
  );
});

test("12. Deep cloning preserves IDs and values", () => {
  const clone = cloneGraph(novastackBaseline);
  assertDeepEqual(clone, novastackBaseline, "Clone must preserve graph content");
  assert(clone !== novastackBaseline, "Clone must be a new graph object");
  assert(clone.nodes !== novastackBaseline.nodes, "Clone must have detached node index");
  assert(clone.edges !== novastackBaseline.edges, "Clone must have detached edge index");
  assert(
    clone.nodes[NOVASTACK_IDS.primaryS3AttackPath] !==
      novastackBaseline.nodes[NOVASTACK_IDS.primaryS3AttackPath],
    "Nested nodes must be deeply detached",
  );
});

test("13. Changing clone S3 public-access does not change original", () => {
  const clone = cloneGraph(novastackBaseline);
  const cloneConfig = clone.nodes[NOVASTACK_IDS.s3PublicAccessConfiguration];
  const originalConfig = novastackBaseline.nodes[NOVASTACK_IDS.s3PublicAccessConfiguration];
  assert(cloneConfig.type === "Configuration", "Clone configuration type mismatch");
  assert(originalConfig.type === "Configuration", "Original configuration type mismatch");

  cloneConfig.value = true;

  assertEqual(cloneConfig.value, true, "Clone S3 value should be mutable independently");
  assertEqual(originalConfig.value, false, "Original S3 value must remain false");
});

test("14. Fixture contains exactly one primary S3 attack path", () => {
  const paths = getNodesByType(novastackBaseline, "AttackPath");
  assertEqual(paths.length, 1, "Expected exactly one attack path");
  assertEqual(paths[0].id, NOVASTACK_IDS.primaryS3AttackPath, "Unexpected attack path ID");
});

test("15. Path is ordered Internet → Public S3 Bucket → Customer Data", () => {
  const path = getNode(novastackBaseline, NOVASTACK_IDS.primaryS3AttackPath);
  assert(path?.type === "AttackPath", "Expected primary AttackPath node");
  assertDeepEqual(
    path.stepIds.map((id) => novastackBaseline.nodes[id].label),
    ["Internet", "Public S3 Bucket", "Customer Data"],
    "Unexpected attack path order",
  );
});

let passed = 0;
const failures: string[] = [];
for (const { name, run } of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL ${name}: ${message}`);
  }
}

console.log(`\nTest summary: ${passed} passed, ${failures.length} failed, ${tests.length} total`);
if (failures.length > 0) {
  throw new Error(`Graph foundation test failures:\n${failures.join("\n")}`);
}
