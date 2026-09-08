import { Navigate, useParams } from 'react-router-dom';
import { resolveLegacyDocsPath } from './legacy';

/*
 * One segment under /docs that is not a section and a page.
 *
 * That shape was the old docs, where every guide was a single slug, and it is
 * also what somebody types when they guess. Both are answered the same way: send
 * them to the page that holds the material now, replacing the entry so the back
 * button still goes back where they came from rather than into the redirect.
 */

/** Send a retired or guessed docs address to the page that answers it. */
export function DocsLegacyRedirect() {
  const params = useParams();
  return <Navigate to={resolveLegacyDocsPath(params.legacy)} replace />;
}
