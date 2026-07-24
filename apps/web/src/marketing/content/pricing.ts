/*
 * The tier ladder, presented as quotas rather than prices. SlideOps meters what
 * you run, not what it costs, so each tier is described by what it allows: how
 * many servers, Projects, and Services you may run, and the hard resource limit
 * every Service is held to. These numbers mirror the quotas the product enforces,
 * so the marketing site and the platform describe the same limits.
 */

export interface Tier {
  /** The tier name, used as the ubiquitous label everywhere. */
  name: string;
  /** One plain-language line framing who the tier suits. */
  summary: string;
  /** How many servers the tier may connect and secure. */
  servers: number;
  /** How many Projects the tier may run across those servers. */
  projects: number;
  /** How many Services the tier may deploy in total. */
  services: number;
  /** The hard vCPU limit every Service is held to. */
  vcpu: number;
  /** The hard memory limit every Service is held to, in megabytes. */
  memoryMb: number;
  /** The hard disk limit every Service is held to, in gigabytes. */
  diskGb: number;
  /** The one recommended tier, lifted and warmed in the card grid. */
  highlighted?: boolean;
}

/** The four tiers, from a single free server up to fleet-scale capacity. */
export const tiers: Tier[] = [
  {
    name: 'Free',
    summary: 'Try the whole lifecycle on one server, at no cost.',
    servers: 1,
    projects: 1,
    services: 1,
    vcpu: 1.0,
    memoryMb: 1024,
    diskGb: 5,
  },
  {
    name: 'Starter',
    summary: 'A couple of servers with room for a few Projects.',
    servers: 2,
    projects: 3,
    services: 5,
    vcpu: 2.0,
    memoryMb: 4096,
    diskGb: 20,
  },
  {
    name: 'Pro',
    summary: 'Run many Projects across a fleet, each held to hard limits.',
    servers: 10,
    projects: 20,
    services: 50,
    vcpu: 8.0,
    memoryMb: 16384,
    diskGb: 100,
    highlighted: true,
  },
  {
    name: 'Enterprise',
    summary: 'Fleet-scale capacity for teams running everything at once.',
    servers: 100,
    projects: 200,
    services: 500,
    vcpu: 64.0,
    memoryMb: 262144,
    diskGb: 1000,
  },
];

/** How many megabytes make one gigabyte, so memory reads in whole units. */
const MB_PER_GB = 1024;

/**
 * Show memory in the largest whole unit that stays exact: a clean multiple of a
 * gigabyte reads as GB (1024 MB becomes 1 GB, 262144 MB becomes 256 GB), and
 * anything else stays in MB so a number is never rounded away.
 */
export function formatMemory(memoryMb: number): string {
  return memoryMb % MB_PER_GB === 0 ? `${memoryMb / MB_PER_GB} GB` : `${memoryMb} MB`;
}

/** Show vCPU to one decimal place, so a whole core reads as 1.0 rather than 1. */
export function formatVcpu(vcpu: number): string {
  return vcpu.toFixed(1);
}

/** Pluralize a count with its noun, so 1 reads "1 server" and 2 "2 servers". */
export function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}
