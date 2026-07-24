import { SectionFold } from './motion';
import { AnyServer } from './sections/AnyServer';
import { Audience } from './sections/Audience';
import { CapabilitiesShowcase } from './sections/CapabilitiesShowcase';
import { Docs } from './sections/Docs';
import { Hero } from './sections/Hero';
import { Lifecycle } from './sections/Lifecycle';
import { Pricing } from './sections/Pricing';
import { ServersProjects } from './sections/ServersProjects';
import { Story } from './sections/Story';

/**
 * The marketing pages. The home page tells the whole story in one calm scroll,
 * while each section is also reachable as its own route so the header and footer
 * can link straight to it. Every page renders inside the marketing layout.
 */

/**
 * The full marketing home. The hero-world folds into the light how-it-works flow
 * (the story, then the lifecycle pipeline) through the paper-curl SectionFold.
 * That light flow then folds back into the warm-dark globe beat (any Linux
 * server, anywhere) and folds out again into the light capabilities-and-
 * marketplace section, keeping the established dark/light rhythm, before
 * continuing into audience, docs, and pricing.
 *
 * The narrative then reads what it is, how the two levels work, and the tiers:
 * the light Capabilities section folds into the warm-dark Servers-then-Projects
 * beat (the two-level model as a living diagram), folds back out into the light
 * audience and docs sections, and folds one last time into the warm-dark tiers
 * beat, keeping the alternating dark/light rhythm through to the footer.
 */
export function MarketingHome() {
  return (
    <>
      <Hero />
      <SectionFold direction="dark-to-light" density="standard" />
      <Story />
      <Lifecycle />
      <SectionFold direction="light-to-dark" density="standard" />
      <AnyServer />
      <SectionFold direction="dark-to-light" density="standard" />
      <CapabilitiesShowcase />
      <SectionFold direction="light-to-dark" density="standard" />
      <ServersProjects />
      <SectionFold direction="dark-to-light" density="standard" />
      <Audience />
      <Docs />
      <SectionFold direction="light-to-dark" density="standard" />
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
