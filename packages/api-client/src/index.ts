export { ApiClient, type ApiClientOptions, type RequestOptions } from './client';
export { ApiError, normalizeError } from './errors';
export {
  openEventStream,
  type StreamHandlers,
  type StreamHandle,
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
export type {
  Operator,
  Admin,
  Node,
  Capability,
  Operation,
  OperationStatus,
  Verification,
} from './types';
