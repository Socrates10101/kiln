/**
 * next/image shim for Kiln preview.
 * Renders a plain <img> tag with similar props.
 */
import React from 'react';

interface ImageProps {
  src: string | { src: string; width?: number; height?: number };
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  placeholder?: string;
  blurDataURL?: string;
  [key: string]: any;
}

function Image({ src, alt, width, height, fill, className, style, ...rest }: ImageProps) {
  const imgSrc = typeof src === 'string' ? src : src?.src ?? '';

  const fillStyle: React.CSSProperties = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
    : {};

  // Strip Next.js-specific props
  const { priority, quality, sizes, placeholder, blurDataURL, loader, ...imgProps } = rest;

  return (
    <img
      src={imgSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      style={{ ...fillStyle, ...style }}
      loading={priority ? 'eager' : 'lazy'}
      {...imgProps}
    />
  );
}

export default Image;
export { Image };
