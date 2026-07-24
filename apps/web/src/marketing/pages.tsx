import { Audience } from './sections/Audience';
import { CapabilitiesShowcase } from './sections/CapabilitiesShowcase';
import { ClosingCta } from './sections/ClosingCta';
import { DeployMonitor } from './sections/DeployMonitor';
import { Docs } from './sections/Docs';
import { Faq } from './sections/Faq';
import { Hero } from './sections/Hero';
import { Lifecycle } from './sections/Lifecycle';
import { Pricing } from './sections/Pricing';
import { Security } from './sections/Security';
import { Story } from './sections/Story';
import { TwoLevel } from './sections/TwoLevel';

/**
 * The marketing pages. The home page tells the whole story in one calm scroll,
 * while each section is also reachable as its own route so the header and footer
 * can link straight to it. Every page renders inside the marketing layout.
 */

/** The full marketing home: the whole system, top to bottom. */
export function MarketingHome() {
  return (
    <>
      <Hero />
      <Story />
      <TwoLevel />
      <Lifecycle />
      <CapabilitiesShowcase />
      <Security />
      <DeployMonitor />
      <Pricing />
      <Audience />
      <Faq />
      <Docs />
      <ClosingCta />
    </>
  );
}

/** The story, on its own route. */
export function StoryPage() {
  return <Story />;
}

/** The day-one Capability showcase, on its own route. */
export function CapabilitiesPage() {
  return <CapabilitiesShowcase />;
}

/** Who SlideOps is for, on its own route. */
export function AudiencePage() {
  return <Audience />;
}

/** The docs rendered from markdown, on their own route. */
export function DocsPage() {
  return <Docs />;
}

/** Pricing, on its own route. */
export function PricingPage() {
  return <Pricing />;
}
