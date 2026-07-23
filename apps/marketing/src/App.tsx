import { Audience } from './sections/Audience';
import { CapabilitiesShowcase } from './sections/CapabilitiesShowcase';
import { Docs } from './sections/Docs';
import { Hero } from './sections/Hero';
import { Pricing } from './sections/Pricing';
import { SiteFooter } from './sections/SiteFooter';
import { SiteHeader } from './sections/SiteHeader';
import { Story } from './sections/Story';

/**
 * The SlideOps marketing site: a strong hero, the story from the blueprint, the
 * day-one Capability showcase, who it is for, docs from markdown, a pricing
 * placeholder, and clear calls into the Operator app. Both themes, responsive,
 * and motion that eases in rather than announces itself.
 */
export function App() {
  return (
    <div className="min-h-screen bg-app text-ink">
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-brand-fg"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main>
        <Hero />
        <Story />
        <CapabilitiesShowcase />
        <Audience />
        <Docs />
        <Pricing />
      </main>
      <SiteFooter />
    </div>
  );
}
