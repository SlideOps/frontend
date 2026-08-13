import type { SVGProps } from 'react';

export interface NATSIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/** The NATS brand mark, from simple-icons (CC0-1.0). */
export function NATSIcon({ size = 16, ...rest }: NATSIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...rest}>
      <path d="M12.004 0H.404v18.807h9.938l1.714 1.602v-.026L15.966 24v-5.193h7.63V0H12.003zm7.578 14.45H15.38L6.898 6.519v7.93H4.116V4.376h4.349l8.344 7.784V4.375h2.773V14.45z" />
    </svg>
  );
}
