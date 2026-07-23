import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface GuidanceEntry {
  /** Short accessible label and popover title. */
  label: string;
  /** One or two sentences shown in a tooltip. Plain language, no jargon. */
  summary: ReactNode;
  /** Optional longer explanation shown in a popover. */
  detail?: ReactNode;
}

export type GuidanceRegistry = Record<string, GuidanceEntry>;

interface GuidanceContextValue {
  registry: GuidanceRegistry;
}

const GuidanceContext = createContext<GuidanceContextValue | null>(null);

export interface GuidanceProviderProps {
  /** The keyed content that explains capabilities, fields, risks, and controls. */
  registry: GuidanceRegistry;
  children: ReactNode;
}

/**
 * Provides the guidance content registry to the tree. Every control looks up
 * its explanation here by a stable string key, so guidance is authored and
 * reviewed as product copy, separate from the components it explains.
 */
export function GuidanceProvider({ registry, children }: GuidanceProviderProps) {
  const value = useMemo<GuidanceContextValue>(() => ({ registry }), [registry]);
  return <GuidanceContext.Provider value={value}>{children}</GuidanceContext.Provider>;
}

/**
 * Look up the guidance entry for a key. Returns undefined when a key has no
 * registered content, so callers can fail soft rather than crash.
 */
export function useGuidance(key: string): GuidanceEntry | undefined {
  const context = useContext(GuidanceContext);
  if (!context) {
    throw new Error('useGuidance must be used inside a GuidanceProvider');
  }
  return context.registry[key];
}
