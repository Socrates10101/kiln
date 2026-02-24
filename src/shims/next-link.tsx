/**
 * next/link shim for Kiln preview.
 * Renders a plain <a> tag.
 */
import React from 'react';

interface LinkProps {
  href: string | { pathname?: string; query?: Record<string, string> };
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  target?: string;
  rel?: string;
  [key: string]: any;
}

function Link({ href, children, className, style, ...rest }: LinkProps) {
  const url = typeof href === 'string' ? href : href?.pathname ?? '#';

  // Strip Next.js-specific props
  const { prefetch, replace, scroll, shallow, passHref, locale, ...anchorProps } = rest;

  return (
    <a href={url} className={className} style={style} {...anchorProps}>
      {children}
    </a>
  );
}

export default Link;
export { Link };
