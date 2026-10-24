import { useEffect, useRef, useState } from 'react';
import { getImagePreview, isHeicImage } from '../lib/image-preview';
import { Image as ImageIcon } from './Icons';

/** Common preview for private expediente images, including iPhone HEIC.
 * Native formats keep the browser's normal lazy image path. A native decoding
 * error also tries format detection, for uploads with misleading filenames. */
export function FileImage({ src, originalName = '', mimeType = '', ...props }) {
  return <Preview key={`${src}|${mimeType}|${originalName}`} src={src} heic={isHeicImage(mimeType, originalName)} {...props} />;
}

function Preview({ src, heic, alt = '', className = '', loading, ...props }) {
  const ref = useRef(null);
  const [recover, setRecover] = useState(heic);
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    if (!recover || failed) return;
    let active = true;
    let url;
    let observer;
    const load = () => {
      getImagePreview(src).then(blob => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setResult(url);
      }).catch(error => { if (active) setFailed(error.message || 'No se pudo abrir la imagen.'); });
    };
    if (loading === 'lazy' && ref.current && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      }, { rootMargin: '200px' });
      observer.observe(ref.current);
    } else {
      load();
    }
    return () => {
      active = false;
      observer?.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, recover, failed, loading]);

  if (failed || (recover && !result)) {
    const label = failed || 'Preparando foto…';
    return (
      <span ref={ref} role="img" aria-label={label} title={label} className={`${className} inline-flex flex-col items-center justify-center gap-1 bg-neutral-bg p-2 text-ink-500`}>
        <ImageIcon size={20} aria-hidden="true" />
        <span className="text-[10px] leading-tight text-center">{failed ? 'Vista no disponible' : 'Preparando…'}</span>
      </span>
    );
  }
  return <img {...props} src={result || src} alt={alt} loading={loading} className={className} onError={() => {
    if (recover) setFailed('El servidor no entregó una imagen válida.'); else setRecover(true);
  }} />;
}
