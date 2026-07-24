import { SectionFold } from './motion';
import { AnyServer } from './sections/AnyServer';
import { Audience } from './sections/Audience';
import { CapabilitiesShowcase } from './sections/CapabilitiesShowcase';
import { Contact } from './sections/Contact';
import { Docs } from './sections/Docs';
import { Faq } from './sections/Faq';
import { Hero } from './sections/Hero';
import { Lifecycle } from './sections/Lifecycle';
import { Pricing } from './sections/Pricing';
import { SecuritySection } from './sections/Security';
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
 * continuing into servers-then-Projects, docs, and pricing.
 *
 * The page then closes in a deliberate arc. Pricing (warm dark) runs straight
 * into the security-first beat, which shares the same warm-dark world so the two
 * read as one continuous protective stretch, then folds out into the light
 * who-it-is-for and FAQ sections, and folds one last time into the warm-dark
 * contact horizon that settles into the footer. Folds only ever bridge a change
 * of world (dark to light or back), so consecutive same-world beats flow on
 * without a seam and no two worlds ever meet without a fold.
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
      <Docs />
      <SectionFold direction="light-to-dark" density="standard" />
      <Pricing />
      <SecuritySection />
      <SectionFold direction="dark-to-light" density="standard" />
      <Audience />
      <Faq />
      <SectionFold direction="light-to-dark" density="bold" />
      <Contact />
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

/** The security-first beat, on its own route. */
export function SecurityPage() {
  return <SecuritySection />;
}

/** Who SlideOps is for, on its own route. */
export function AudiencePage() {
  return <Audience />;
}

/** The FAQ, on its own route. */
export function FaqPage() {
  return <Faq />;
}

/** The docs rendered from markdown, on their own route. */
export function DocsPage() {
  return <Docs />;
}

/** Pricing, on its own route. */
export function PricingPage() {
  return <Pricing />;
}

/** The contact-and-start horizon, on its own route. */
export function ContactPage() {
  return <Contact />;
}
