import { describe, expect, it } from 'vitest';
import { resolveSupportContext } from './useSupportContext';

describe('resolveSupportContext', () => {
  it('resolves a node detail route', () => {
    expect(resolveSupportContext('/app/nodes/nd_1', { id: 'nd_1' })).toEqual({
      route: '/app/nodes/nd_1',
      resource_type: 'node',
      resource_id: 'nd_1',
    });
  });

  it('resolves a service detail route, including its shell sub-route', () => {
    expect(resolveSupportContext('/app/services/svc_1', { id: 'svc_1' })).toEqual({
      route: '/app/services/svc_1',
      resource_type: 'service',
      resource_id: 'svc_1',
    });
    expect(resolveSupportContext('/app/services/svc_1/shell', { id: 'svc_1' })).toEqual({
      route: '/app/services/svc_1/shell',
      resource_type: 'service',
      resource_id: 'svc_1',
    });
  });

  it('resolves an operation detail route', () => {
    expect(resolveSupportContext('/app/operations/op_1', { id: 'op_1' })).toEqual({
      route: '/app/operations/op_1',
      resource_type: 'operation',
      resource_id: 'op_1',
    });
  });

  it('resolves a capability detail route by its key param', () => {
    expect(resolveSupportContext('/app/capabilities/secure-ssh', { key: 'secure-ssh' })).toEqual({
      route: '/app/capabilities/secure-ssh',
      resource_type: 'capability',
      resource_id: 'secure-ssh',
    });
  });

  it('resolves a project detail route', () => {
    expect(resolveSupportContext('/app/projects/pj_1', { id: 'pj_1' })).toEqual({
      route: '/app/projects/pj_1',
      resource_type: 'project',
      resource_id: 'pj_1',
    });
  });

  it('resolves a billing transaction route by its reference param', () => {
    expect(
      resolveSupportContext('/app/billing/transactions/ref_1', { reference: 'ref_1' }),
    ).toEqual({
      route: '/app/billing/transactions/ref_1',
      resource_type: 'transaction',
      resource_id: 'ref_1',
    });
  });

  it('resolves no resource for a static list route with no dynamic param', () => {
    expect(resolveSupportContext('/app/nodes', {})).toEqual({
      route: '/app/nodes',
      resource_type: null,
      resource_id: null,
    });
  });

  it('resolves no resource for a static sub-route whose path segment happens to collide, since it carries no matching param', () => {
    // React Router only resolves `id` on the branch that declared `:id`, so
    // `nodes/new` (a distinct static route) never has an `id` param and is
    // correctly read as having no resource in view.
    expect(resolveSupportContext('/app/nodes/new', {})).toEqual({
      route: '/app/nodes/new',
      resource_type: null,
      resource_id: null,
    });
  });

  it('resolves no resource outside the operator area', () => {
    expect(resolveSupportContext('/pricing', {})).toEqual({
      route: '/pricing',
      resource_type: null,
      resource_id: null,
    });
  });

  it('resolves the workspace home with no resource', () => {
    expect(resolveSupportContext('/app', {})).toEqual({
      route: '/app',
      resource_type: null,
      resource_id: null,
    });
  });
});
