import { Route } from 'react-router-dom';
import { DocsArticle } from './DocsArticle';
import { DocsHome } from './DocsHome';
import { DocsLegacyRedirect } from './DocsLegacyRedirect';
import { DocsShell } from './DocsShell';
import { DOCS_ROOT_PATH } from './manifest';

/*
 * The documentation routes, defined once.
 *
 * The application mounts these and the tests mount these, so a route that works
 * under test is the route a visitor gets. Writing them out twice would let the
 * two drift, and the first anybody would know of it is a link that only breaks
 * in production.
 */

/** Every route under /docs, ready to be placed inside a Routes element. */
export function docsRoutes() {
  return (
    <Route path={DOCS_ROOT_PATH} element={<DocsShell />}>
      <Route index element={<DocsHome />} />
      <Route path=":section/:page" element={<DocsArticle />} />
      {/* A single segment is an address from the first version of the docs, or
          a guess. Either way it is redirected rather than left to fail. */}
      <Route path=":legacy" element={<DocsLegacyRedirect />} />
    </Route>
  );
}
