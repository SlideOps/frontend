import { describe, expect, it } from 'vitest';
import { serviceEndpointState } from './service-endpoint';

describe('serviceEndpointState', () => {
  it('gives the base URLs a caller uses, one per published port', () => {
    const state = serviceEndpointState({
      public_urls: ['http://169.58.53.167:8080', 'http://169.58.53.167:9090'],
      ports: [
        { host: 8080, container: 80 },
        { host: 9090, container: 9090 },
      ],
      status: 'running',
    });
    expect(state).toEqual({
      kind: 'addresses',
      primary: 'http://169.58.53.167:8080',
      alternates: ['http://169.58.53.167:9090'],
      urls: ['http://169.58.53.167:8080', 'http://169.58.53.167:9090'],
      answering: true,
    });
  });

  it('keeps the address but says it is not answering when the Service is stopped', () => {
    const state = serviceEndpointState({
      public_urls: ['http://169.58.53.167:8080'],
      ports: [{ host: 8080, container: 80 }],
      status: 'stopped',
    });
    expect(state).toEqual({
      kind: 'addresses',
      primary: 'http://169.58.53.167:8080',
      alternates: [],
      urls: ['http://169.58.53.167:8080'],
      answering: false,
    });
  });

  it('points at the Node when a port is published but no address could be built', () => {
    expect(
      serviceEndpointState({
        public_urls: [],
        ports: [{ host: 8080, container: 80 }],
        status: 'running',
      }),
    ).toEqual({ kind: 'no-node-address' });
  });

  it('separates publishing nothing from having no address, since the fixes differ', () => {
    expect(serviceEndpointState({ public_urls: [], ports: [], status: 'running' })).toEqual({
      kind: 'nothing-published',
    });
  });

  it('treats absent ports and absent urls the same as empty ones', () => {
    expect(serviceEndpointState({ status: 'running' })).toEqual({ kind: 'nothing-published' });
  });

  it('ignores a blank address rather than offering an unusable one', () => {
    expect(
      serviceEndpointState({
        public_urls: ['', '   '],
        ports: [{ host: 8080, container: 80 }],
        status: 'running',
      }),
    ).toEqual({ kind: 'no-node-address' });
  });
});

// The hostname is the address to build against, so it has to be the one shown
// first and copied. The port address is a convenience, not the contract.
describe('serviceEndpointState with a hostname', () => {
  it('leads with the hostname and keeps the port address as an alternate', () => {
    const state = serviceEndpointState({
      public_urls: ['https://shop.10.0.0.1.nip.io', 'http://10.0.0.1:20000'],
      ports: [{ host: 20000, container: 80 }],
      status: 'running',
    });
    expect(state).toEqual({
      kind: 'addresses',
      primary: 'https://shop.10.0.0.1.nip.io',
      alternates: ['http://10.0.0.1:20000'],
      urls: ['https://shop.10.0.0.1.nip.io', 'http://10.0.0.1:20000'],
      answering: true,
    });
  });
});
