import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HEAD_ATTRIBUTE, headFor, type Head } from './head';

/*
 * Keeps the document head in step with the route.
 *
 * The published build already writes each public page's head into its own HTML
 * file, which is what a crawler reads first. This covers the moves that never
 * fetch a file: a visitor following a link inside the app, where the router
 * swaps the page and the head would otherwise keep describing the last one.
 * Both read headFor, so the head a crawler sees and the head a visitor ends up
 * with cannot disagree.
 */

/** Rewrites the managed head tags whenever the path changes. Renders nothing. */
export function RouteHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    applyHead(headFor(pathname));
  }, [pathname]);
  return null;
}

/** Replace every tag this module manages with the ones for this head. */
export function applyHead(head: Head): void {
  document.title = head.title;
  for (const node of Array.from(document.head.querySelectorAll(`[${HEAD_ATTRIBUTE}]`))) {
    node.remove();
  }
  for (const tag of head.tags) {
    const element = document.createElement(tag.tag);
    for (const [name, value] of Object.entries(tag.attrs)) element.setAttribute(name, value);
    if (tag.text !== undefined) element.textContent = tag.text;
    element.setAttribute(HEAD_ATTRIBUTE, '');
    document.head.appendChild(element);
  }
}
