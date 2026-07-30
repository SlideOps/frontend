import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { ServiceEndpoint } from './ServiceEndpoint';

/*
 * The card an Operator reads to find out where their application answers. The
 * decision behind it is tested as pure logic in service-endpoint.test.ts; what is
 * tested here is what that decision looks like on screen, which is the part that
 * cannot be extracted: which address is offered first, and whether the control for
 * a Service with no name appears only when it should.
 */

const { exposeService } = vi.hoisted(() => ({ exposeService: vi.fn() }));

vi.mock('@slideops/api-client', () => ({
  ApiError: class ApiError extends Error {},
  exposeService,
}));

function service(over: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    name: 'shop',
    project_id: 'proj-1',
    node_id: 'node-1',
    runtime: 'container',
    source: { type: 'image', image: 'nginx' },
    cpu_limit: 0.5,
    memory_mb: 256,
    status: 'running',
    created_at: '2026-07-30T00:00:00Z',
    ...over,
  } as Service;
}

beforeEach(() => {
  exposeService.mockReset();
  exposeService.mockResolvedValue(service());
});

describe('ServiceEndpoint', () => {
  it('offers the hostname first, since that is the address to build against', () => {
    renderInApp(
      <ServiceEndpoint
        service={service({
          domain: 'shop.10.0.0.1.nip.io',
          ports: [{ host: 20000, container: 80 }],
          public_urls: ['https://shop.10.0.0.1.nip.io', 'http://10.0.0.1:20000'],
        })}
      />,
    );
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'https://shop.10.0.0.1.nip.io',
    );
    // The port address is still shown, but as an alternative rather than the one
    // to hand to another program.
    expect(screen.getByText(/not the address to build against/i)).toBeInTheDocument();
  });

  it('says a secure address can be called from a browser, and an insecure one cannot', () => {
    const { unmount } = renderInApp(
      <ServiceEndpoint
        service={service({
          domain: 'shop.10.0.0.1.nip.io',
          ports: [{ host: 20000, container: 80 }],
          public_urls: ['https://shop.10.0.0.1.nip.io'],
        })}
      />,
    );
    expect(screen.getByText(/served over HTTPS/i)).toBeInTheDocument();
    unmount();

    renderInApp(
      <ServiceEndpoint
        service={service({
          ports: [{ host: 20000, container: 80 }],
          public_urls: ['http://10.0.0.1:20000'],
        })}
      />,
    );
    expect(screen.getByText(/not yet served over HTTPS/i)).toBeInTheDocument();
  });

  it('offers an address to a Service that has a port but no name', async () => {
    const onChanged = vi.fn();
    renderInApp(
      <ServiceEndpoint
        service={service({
          ports: [{ host: 20000, container: 80 }],
          public_urls: ['http://10.0.0.1:20000'],
        })}
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /give it a web address/i }));
    await waitFor(() => expect(exposeService).toHaveBeenCalledWith('svc-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('does not offer an address to a Service that already has one', () => {
    renderInApp(
      <ServiceEndpoint
        service={service({
          domain: 'shop.10.0.0.1.nip.io',
          ports: [{ host: 20000, container: 80 }],
          public_urls: ['https://shop.10.0.0.1.nip.io'],
        })}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /give it a web address/i }),
    ).not.toBeInTheDocument();
  });

  it('separates publishing nothing from having no address to build, since the fixes differ', () => {
    const { unmount } = renderInApp(<ServiceEndpoint service={service({ ports: [] })} />);
    expect(screen.getByText(/Nothing is published/i)).toBeInTheDocument();
    unmount();

    renderInApp(
      <ServiceEndpoint
        service={service({ ports: [{ host: 20000, container: 80 }], public_urls: [] })}
      />,
    );
    expect(screen.getByText(/its Node has no address recorded/i)).toBeInTheDocument();
  });

  it('reports a failure to set up the address rather than looking like nothing happened', async () => {
    exposeService.mockRejectedValue(new Error('nope'));
    renderInApp(
      <ServiceEndpoint
        service={service({
          ports: [{ host: 20000, container: 80 }],
          public_urls: ['http://10.0.0.1:20000'],
        })}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /give it a web address/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be set up/i);
  });
});
