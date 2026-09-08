import { Check, Copy, Link2 } from '@slideops/icons';
import {
  useCallback,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { headingIdsByLine, readHeadings, slugifyHeading } from './headings';

/*
 * The renderer for a documentation page.
 *
 * Three things here are not decoration. A heading carries the same anchor the
 * table of contents links to, so a deep link lands where it says it will. A link
 * to another docs page routes inside the application rather than reloading it,
 * because a full reload in the middle of reading reads as a broken link. And
 * every code block and table scrolls inside itself, so a long command widens the
 * block and never the page.
 */

/** A hast node, as react-markdown hands it over, reduced to what is read here. */
interface MarkdownNode {
  type?: string;
  value?: string;
  children?: MarkdownNode[];
  position?: { start?: { line?: number } };
}

/** The words inside a node, which is what a copy control puts on the clipboard. */
function textOf(node: MarkdownNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

/** The words inside rendered children, used when no source node is available. */
function textOfChildren(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOfChildren).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    const props = (children as { props?: { children?: ReactNode } }).props;
    return textOfChildren(props?.children);
  }
  return '';
}

const COPIED_FOR_MS = 1600;

/** A code block, scrollable in its own right, with a control that copies it. */
function CodeBlock({ code, children }: { code: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) return;
    void clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
    });
  }, [code]);

  return (
    <div className="group relative my-6">
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied to the clipboard' : 'Copy this code'}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-muted opacity-0 transition-opacity duration-fast ease-standard hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus group-hover:opacity-100"
      >
        {copied ? (
          <Check width={13} height={13} aria-hidden />
        ) : (
          <Copy width={13} height={13} aria-hidden />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto rounded-lg border border-border bg-subtle p-4 text-sm leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

/** A heading that is its own anchor, with a link somebody can copy. */
function AnchoredHeading({
  level,
  id,
  children,
}: {
  level: 2 | 3 | 4;
  id: string;
  children: ReactNode;
}) {
  const Tag = `h${level}` as const;
  return (
    <Tag id={id} className="group/heading">
      {/* The heading is its own link. No label is set on it, so what a screen
          reader announces is the heading's own words rather than a description
          of the link wrapped around them. */}
      <a href={`#${id}`} className="no-underline">
        {children}
        <Link2
          width={14}
          height={14}
          aria-hidden
          className="ml-2 inline-block align-middle opacity-0 transition-opacity duration-fast ease-standard group-hover/heading:opacity-60"
        />
      </a>
    </Tag>
  );
}

type HeadingProps = ComponentPropsWithoutRef<'h2'> & ExtraProps;
type PreProps = ComponentPropsWithoutRef<'pre'> & ExtraProps;
type TableProps = ComponentPropsWithoutRef<'table'> & ExtraProps;
type AnchorProps = ComponentPropsWithoutRef<'a'> & ExtraProps;

export interface DocsMarkdownProps {
  markdown: string;
}

/** A documentation page's markdown, rendered. */
export function DocsMarkdown({ markdown }: DocsMarkdownProps) {
  const idsByLine = useMemo(() => headingIdsByLine(readHeadings(markdown)), [markdown]);

  const components = useMemo<Components>(() => {
    function heading(level: 2 | 3 | 4) {
      return function Heading({ node, children }: HeadingProps) {
        const line = (node as MarkdownNode | undefined)?.position?.start?.line;
        const id =
          (line === undefined ? undefined : idsByLine.get(line)) ??
          slugifyHeading(textOfChildren(children));
        return (
          <AnchoredHeading level={level} id={id}>
            {children}
          </AnchoredHeading>
        );
      };
    }

    return {
      // A page's title comes from the manifest and is rendered by the page
      // itself, so a stray h1 in the prose becomes a section rather than a
      // second title competing with the first.
      h1: heading(2),
      h2: heading(2),
      h3: heading(3),
      h4: heading(4),

      pre: function DocsPre({ node, children }: PreProps) {
        return <CodeBlock code={textOf(node as MarkdownNode | undefined)}>{children}</CodeBlock>;
      },

      table: function DocsTable({ children }: TableProps) {
        return (
          <div className="my-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-sm">{children}</table>
          </div>
        );
      },

      a: function DocsAnchor({ node: _node, href, children, ...rest }: AnchorProps) {
        const target = href ?? '';
        const internal = target.startsWith('/') && !target.startsWith('//');
        if (internal) {
          return (
            <Link to={target} {...rest}>
              {children}
            </Link>
          );
        }
        const external = /^https?:/i.test(target);
        return (
          <a
            href={target}
            {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            {...rest}
          >
            {children}
          </a>
        );
      },
    };
  }, [idsByLine]);

  return (
    <div className="so-docs-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
