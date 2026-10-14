import { useState } from 'react';
import { cn } from '../lib/utils';
import { iniciales } from '../lib/format';

const SIZES = {
  xs: 'h-6 w-6 text-[11px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-14 w-14 text-base',
};

const COLORS = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6'];

function colorDe(nombre) {
  let h = 0;
  for (const c of String(nombre || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/**
 * Avatar con iniciales (un color plano derivado del nombre) o foto `src`.
 *   <Avatar name="Alberto Lathrop" size="md" />
 *   <Avatar name={user.name} src={user.avatar_url} size="lg" />
 */
export function Avatar({ name, src, size = 'md', className, square = false }) {
  const [broken, setBroken] = useState(false);
  const shape = square ? 'rounded-md' : 'rounded-full';
  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} className={cn('object-cover shrink-0', shape, SIZES[size] || SIZES.md, className)} />;
  }
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center justify-center font-semibold text-white shrink-0 select-none', shape, SIZES[size] || SIZES.md, colorDe(name), className)}>
      {iniciales(name)}
    </span>
  );
}
