export { ApiClient, type ApiClientOptions, type RequestOptions } from './client';
export { ApiError, normalizeError } from './errors';
export { apiBase, apiRequest, type ResourceRequestOptions } from './http';
export {
  openEventStream,
  openOperationStream,
  operationStreamUrl,
  type StreamHandlers,
  type StreamHandle,
  type StreamStatus,
  type OperationStreamOptions,
} from './stream';
export {
  register,
  login,
  mfaVerify,
  logout,
  me,
  mfaSetup,
  mfaEnable,
  mfaDisable,
  adminLogin,
  adminMfaVerify,
  adminLogout,
  adminMe,
  type Credentials,
  type MfaSetup,
  type LoginResult,
  type AdminLoginResult,
} from './auth';
export {
  listProjects,
  createProject,
  getProject,
  removeProject,
  type CreateProjectInput,
} from './projects';
export {
  listNodes,
  createNode,
  getNode,
  removeNode,
  discoverNode,
  type NodeAuth,
  type CreateNodeInput,
} from './nodes';
export { listCapabilities, getCapability } from './capabilities';
export {
  createOperation,
  listOperations,
  getOperation,
  approveOperation,
  cancelOperation,
  type CreateOperationInput,
  type OperationFilter,
} from './operations';
export type {
  Operator,
  Admin,
  Project,
  Node,
  NodeAuthKind,
  RiskLevel,
  Capability,
  PlanStep,
  Plan,
  VerificationCheck,
  Verification,
  Operation,
  OperationStatus,
  OperationEvent,
  OperationEventType,
  EventLevel,
  Facts,
  AssessmentFinding,
  AssessmentRecommendation,
  Assessment,
  DiscoveryResult,
} from './types';
