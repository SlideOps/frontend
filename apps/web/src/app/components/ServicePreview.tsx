import { apiBase, type Service } from '@slideops/api-client';
import { Section, Text } from '@slideops/design-system';
import { ArrowUpRight } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';

/*
 * A live view of the running Service. The backend reverse-proxies the app over
 * the same SSH tunnel that reaches the Node and strips its framing headers, so
 * the running app can be embedded here safely. The port is never exposed
 * publicly; the browser reaches it only through this same-origin path, which
 * carries the Operator's session cookie automatically.
 */

/** Build the browser-facing preview URL from the same base the api-client uses. */
function previewUrl(id: string): string {
  return `${apiBase()}/services/${id}/preview/`;
}

/** A calm placeholder shown until the Service is running and reachable. */
function PreviewNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[8rem] items-center justify-center rounded-md border border-dashed border-border bg-app p-6 text-center">
      <Text variant="body-sm" tone="secondary">
        {children}
      </Text>
    </div>
  );
}

export function ServicePreview({ service }: { service: Service }) {
  const isRunning = service.status === 'running';
  const hasPort = Boolean(service.ports && service.ports.length > 0);
  const url = previewUrl(service.id);

  return (
    <Section
      title="Preview"
      adornment={<Guidance for="service.preview" />}
      action={
        isRunning && hasPort ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded-md text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Open in new tab
            <ArrowUpRight width={15} height={15} aria-hidden />
          </a>
        ) : null
      }
    >
      {isRunning && hasPort ? (
        <>
          <div className="min-w-0 w-full max-w-full overflow-hidden rounded-md border border-border bg-app">
            <iframe
              title={`Live preview of ${service.name}`}
              src={url}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="h-[32rem] w-full max-w-full border-0 bg-app"
            />
          </div>
          <Text variant="body-sm" tone="secondary" className="mt-2 break-words">
            The live running Service, reached over the secure SSH tunnel, so its port is never
            exposed publicly. An app that uses absolute asset paths may render imperfectly here;
            open it in a new tab for the full experience.
          </Text>
        </>
      ) : (
        <PreviewNote>A preview appears here once the Service is running.</PreviewNote>
      )}
    </Section>
  );
}
