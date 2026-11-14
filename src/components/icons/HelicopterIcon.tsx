import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Editorial cartographic Helicopter icon styled to match Lucide line geometry:
 * 24x24 viewBox, stroke="currentColor", strokeWidth="2", rounded caps & joins.
 */
export const HelicopterIcon: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Top Rotor Blade & Mast */}
    <path d="M4 3h16" />
    <path d="M13 3v4" />
    {/* Streamlined Fuselage */}
    <path d="M11 7h5a4 4 0 0 1 4 4v1a3 3 0 0 1-3 3h-6a2 2 0 0 1-2-2v-3a3 3 0 0 1 2-3z" />
    {/* Cockpit Window */}
    <path d="M14 7v4h5.5" />
    {/* Tail Boom & Stabilizer Fin */}
    <path d="M9 11H3l-1-3" />
    {/* Landing Skid Struts & Upturned Runner */}
    <path d="M10 16v3" />
    <path d="M16 16v3" />
    <path d="M7 19h12a2 2 0 0 0 2-2" />
  </svg>
);
