import { SectionFold } from './motion';
import { Audience } from './sections/Audience';
import { CapabilitiesShowcase } from './sections/CapabilitiesShowcase';
import { Docs } from './sections/Docs';
import { Hero } from './sections/Hero';
import { Lifecycle } from './sections/Lifecycle';
import { Pricing } from './sections/Pricing';
import { Story } from './sections/Story';

/**
 * The marketing pages. The home page tells the whole story in one calm scroll,
 * while each section is also reachable as its own route so the header and footer
 * can link straight to it. Every page renders inside the marketing layout.
 */

/**
 * The full marketing home. The hero-world folds into the light how-it-works flow
 * (the story, then the lifecycle pipeline) through the paper-curl SectionFold,
 * then continues into capabilities, audience, docs, and pricing.
 */
export function MarketingHome() {
  return (
    <>
      <Hero />
      <SectionFold direction="dark-to-light" density="standard" />
      <Story />
      <Lifecycle />
      <CapabilitiesShowcase />
      <Audience />
      <Docs />
      <Pricing />
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
