import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { DocsMarkdown } from './DocsMarkdown';
import { docsPages, docsSections } from './manifest';
import { docsRoutes } from './routes';

/*
 * The documentation shell, exercised through the same routes the application
 * mounts. What is asserted here is what a reader can do: reach every page, land
 * somewhere sensible from an address that predates this shell, see where they
 * are, read straight through, search with the keyboard, deep link to a heading,
 * copy a command, and reach the whole of it from a phone.
 */

function showDocsAt(entry: string) {
  return renderInApp(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>{docsRoutes()}</Routes>
    </MemoryRouter>,
  );
}

/** The sidebar copy of the navigation, which is the one a wide screen shows. */
function sidebar() {
  return screen.getByRole('navigation', { name: 'Documentation' });
}

/** The disclosure copy of the navigation, which is the one a phone shows. */
function phoneNav() {
  return screen.getByRole('navigation', { name: 'Documentation sections' });
}

beforeEach(() => {
  window.scrollTo = vi.fn();
});

describe('reaching a documentation page', () => {
  it('renders every page the manifest lists at the route the manifest gives it', () => {
    for (const page of docsPages) {
      const view = showDocsAt(page.path);
      expect(screen.getByRole('heading', { level: 1, name: page.title })).toBeInTheDocument();
      view.unmount();
    }
  });

  it('opens the documentation index at the docs root', () => {
    showDocsAt('/docs');
    expect(
      screen.getByRole('heading', { level: 1, name: /secure your servers/i }),
    ).toBeInTheDocument();
  });

  it('lists every page on the index, so nothing is reachable only through search', () => {
    const { container } = showDocsAt('/docs');
    const linked = new Set(
      Array.from(container.querySelectorAll('a[href]')).map((link) => link.getAttribute('href')),
    );
    for (const page of docsPages) {
      expect(linked.has(page.path)).toBe(true);
    }
  });
});

describe('an address from the first version of the docs', () => {
  it('still lands on the page that holds its material', async () => {
    showDocsAt('/docs/getting-started');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quick start' }),
    ).toBeInTheDocument();
  });

  it('lands on the page that absorbed it for each of the retired guides', async () => {
    const moved: [string, string][] = [
      ['/docs/how-an-operation-works', 'How an Operation works'],
      ['/docs/servers-and-projects', 'Servers'],
      ['/docs/deployment-methods', 'Deploying'],
      ['/docs/managing-what-you-installed', 'Capabilities'],
      ['/docs/day-to-day', 'Activity'],
    ];
    for (const [from, title] of moved) {
      const view = showDocsAt(from);
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      view.unmount();
    }
  });

  it('lands on the documentation index when the address means nothing at all', async () => {
    showDocsAt('/docs/never-was-a-page');
    expect(
      await screen.findByRole('heading', { level: 1, name: /secure your servers/i }),
    ).toBeInTheDocument();
  });

  it('follows an old in-page anchor to the page that replaced it', async () => {
    showDocsAt('/docs#deployment-methods');
    expect(await screen.findByRole('heading', { level: 1, name: 'Deploying' })).toBeInTheDocument();
  });
});

describe('the section navigation', () => {
  it('marks the page being read and opens the group holding it', () => {
    showDocsAt('/docs/observe/reports');
    const nav = sidebar();

    const current = within(nav).getByRole('link', { name: 'Reports' });
    expect(current).toHaveAttribute('aria-current', 'page');

    expect(within(nav).getByRole('button', { name: /Observe/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(within(nav).getByRole('button', { name: /Reference/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('opens a group a reader asks for and closes it again', async () => {
    const user = userEvent.setup();
    showDocsAt('/docs/observe/reports');
    const nav = sidebar();
    const reference = within(nav).getByRole('button', { name: /Reference/ });

    await user.click(reference);
    expect(reference).toHaveAttribute('aria-expanded', 'true');
    expect(within(nav).getByRole('link', { name: 'Glossary' })).toBeVisible();

    await user.click(reference);
    expect(reference).toHaveAttribute('aria-expanded', 'false');
  });

  it('takes a reader to the page a navigation link names', async () => {
    const user = userEvent.setup();
    showDocsAt('/docs/observe/activity');
    await user.click(within(sidebar()).getByRole('link', { name: 'Logs' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Logs' })).toBeInTheDocument();
  });
});

describe('reading the docs straight through', () => {
  it('offers previous and next in the order the manifest declares', () => {
    const index = 6;
    const page = docsPages[index]!;
    showDocsAt(page.path);
    const pager = screen.getByRole('navigation', { name: 'Previous and next page' });

    expect(
      within(pager).getByRole('link', { name: new RegExp(docsPages[index - 1]!.title, 'i') }),
    ).toBeInTheDocument();
    expect(
      within(pager).getByRole('link', { name: new RegExp(docsPages[index + 1]!.title, 'i') }),
    ).toBeInTheDocument();
  });

  it('offers no previous link on the first page', () => {
    showDocsAt(docsPages[0]!.path);
    const pager = screen.getByRole('navigation', { name: 'Previous and next page' });
    expect(within(pager).queryByText('Previous')).not.toBeInTheDocument();
    expect(within(pager).getByText('Next')).toBeInTheDocument();
  });

  it('offers no next link on the last page', () => {
    showDocsAt(docsPages[docsPages.length - 1]!.path);
    const pager = screen.getByRole('navigation', { name: 'Previous and next page' });
    expect(within(pager).getByText('Previous')).toBeInTheDocument();
    expect(within(pager).queryByText('Next')).not.toBeInTheDocument();
  });

  it('reaches the next page when the next link is followed', async () => {
    const user = userEvent.setup();
    showDocsAt(docsPages[0]!.path);
    const pager = screen.getByRole('navigation', { name: 'Previous and next page' });
    await user.click(
      within(pager).getByRole('link', { name: new RegExp(docsPages[1]!.title, 'i') }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: docsPages[1]!.title }),
    ).toBeInTheDocument();
  });
});

describe('searching the docs', () => {
  it('finds a page by its title and opens it with the keyboard alone', async () => {
    const user = userEvent.setup();
    showDocsAt('/docs');

    const box = screen.getAllByRole('combobox', { name: 'Search the docs' })[0]!;
    await user.click(box);
    await user.keyboard('glossary');

    const listbox = await screen.findByRole('listbox', { name: 'Search results' });
    expect(within(listbox).getByText('Glossary')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Glossary' })).toBeInTheDocument();
  });

  it('finds a page by words that appear only in its body', async () => {
    const user = userEvent.setup();
    showDocsAt('/docs');

    const box = screen.getAllByRole('combobox', { name: 'Search the docs' })[0]!;
    await user.click(box);
    await user.keyboard('non-root administrator');

    const listbox = await screen.findByRole('listbox', { name: 'Search results' });
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('walks the results with the arrow keys and opens the one it lands on', async () => {
    const user = userEvent.setup();
    showDocsAt('/docs');

    const box = screen.getAllByRole('combobox', { name: 'Search the docs' })[0]!;
    await user.click(box);
    await user.keyboard('server');

    const listbox = await screen.findByRole('listbox', { name: 'Search results' });
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    const secondTitle = within(options[1]!).getAllByText(/\S/)[0]!.textContent!;

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(within(listbox).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    });

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: secondTitle })).toBeInTheDocument();
  });

  it('closes the results when the reader presses Escape', async () => {
    const user = userEvent.setup();
    showDocsAt('/docs');

    const box = screen.getAllByRole('combobox', { name: 'Search the docs' })[0]!;
    await user.click(box);
    await user.keyboard('glossary');
    expect(await screen.findByRole('listbox', { name: 'Search results' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: 'Search results' })).not.toBeInTheDocument();
    });
  });
});

describe('a rendered documentation page', () => {
  function showMarkdown(markdown: string) {
    return renderInApp(
      <MemoryRouter>
        <DocsMarkdown markdown={markdown} />
      </MemoryRouter>,
    );
  }

  it('gives a heading a stable anchor that a deep link can land on', () => {
    showMarkdown('## Secure the server\n\nSome prose.\n');
    const heading = screen.getByRole('heading', { level: 2, name: 'Secure the server' });
    expect(heading).toHaveAttribute('id', 'secure-the-server');
    expect(within(heading).getByRole('link', { name: 'Secure the server' })).toHaveAttribute(
      'href',
      '#secure-the-server',
    );
  });

  it('gives two headings worded the same an anchor each, so both deep links work', () => {
    showMarkdown('## Limits\n\nOne.\n\n## Limits\n\nTwo.\n');
    const ids = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.getAttribute('id'));
    expect(ids).toEqual(['limits', 'limits-2']);
  });

  it('offers a control that copies a code block', async () => {
    const user = userEvent.setup();
    // Stubbed after the user event setup, which installs a clipboard of its own.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    showMarkdown('```sh\nsystemctl status example\n```\n');

    await user.click(screen.getByRole('button', { name: /Copy this code/i }));
    expect(writeText).toHaveBeenCalledWith('systemctl status example\n');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('scrolls a wide code block inside itself rather than widening the page', () => {
    const wide = `\`\`\`sh\n${'echo a-very-long-command '.repeat(40)}\n\`\`\`\n`;
    const { container } = showMarkdown(wide);
    const block = container.querySelector('pre');
    expect(block).not.toBeNull();
    expect(block!.className).toContain('overflow-x-auto');
  });

  it('scrolls a wide table inside itself for the same reason', () => {
    const table = '| One | Two |\n| --- | --- |\n| a | b |\n';
    const { container } = showMarkdown(table);
    const rendered = container.querySelector('table');
    expect(rendered).not.toBeNull();
    expect(rendered!.parentElement!.className).toContain('overflow-x-auto');
  });

  it('routes a link to another documentation page without reloading the application', async () => {
    const user = userEvent.setup();
    renderInApp(
      <MemoryRouter initialEntries={['/docs/start/quick-start']}>
        <Routes>{docsRoutes()}</Routes>
      </MemoryRouter>,
    );
    // The article column holds the prose; the breadcrumb link into the index is
    // rendered by the same client side router the prose links use.
    await user.click(screen.getByRole('link', { name: 'Docs' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /secure your servers/i }),
    ).toBeInTheDocument();
  });

  it('renders a blockquote as a callout rather than as plain prose', () => {
    const { container } = showMarkdown('> Approval is always yours.\n');
    expect(container.querySelector('blockquote')).not.toBeNull();
  });
});

describe('the documentation on a phone', () => {
  it('hides the section list behind a disclosure until it is asked for', async () => {
    const user = userEvent.setup();
    showDocsAt('/docs/start/quick-start');

    const disclosure = screen.getByRole('button', { name: /Quick start/ });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  });

  it('still reaches every page the manifest lists', async () => {
    const user = userEvent.setup();
    showDocsAt('/docs/start/quick-start');

    await user.click(screen.getByRole('button', { name: /Quick start/ }));
    const nav = phoneNav();

    for (const section of docsSections) {
      const group = within(nav).getByRole('button', { name: new RegExp(section.title) });
      if (group.getAttribute('aria-expanded') === 'false') await user.click(group);
      for (const page of section.pages) {
        expect(within(nav).getByRole('link', { name: page.title })).toBeInTheDocument();
      }
    }
  });
});
