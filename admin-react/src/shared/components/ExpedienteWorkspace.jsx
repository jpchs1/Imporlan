import { useEffect, useRef, useState } from 'react';
import { PageHeader } from './PageHeader';
import { Ship } from './Icons';
import { cn } from '../lib/utils';
import { irASeccionExpediente } from '../lib/expediente-navigation';
import '../styles/expedientes.css';

export function ExpedienteHeader({ image, imageLabel, children, className, ...props }) {
  const [failedImage, setFailedImage] = useState('');
  const hasImage = image && failedImage !== image;
  return <section className={cn('exp-header', hasImage && 'exp-header--with-image', className)}>
    <div className="exp-header__body">
      <PageHeader {...props} className="exp-header__heading" />
      {children}
    </div>
    {hasImage && <div className="exp-header__cover">
      <img src={image} alt={imageLabel || ''} onError={() => setFailedImage(image)} />
      {imageLabel && <span className="exp-header__cover-label"><Ship size={15} />{imageLabel}</span>}
    </div>}
  </section>;
}

export function ExpedienteMetrics({ items, loading = false }) {
  return <div className="exp-metrics" role="group" aria-label="Resumen de expedientes" aria-busy={loading}>
    {items.map(item => {
      const Icon = item.icon;
      return <div key={item.label} className="exp-metric">
        <span className="exp-metric__icon" aria-hidden="true">{Icon && <Icon size={20} />}</span>
        <dl className="exp-metric__body"><dt>{item.label}</dt><dd>{loading ? '—' : item.value}</dd>
          {item.hint && <dd className="exp-metric__hint">{item.hint}</dd>}
        </dl>
      </div>;
    })}
  </div>;
}

export function ExpedienteNavigation({ sections, className }) {
  const [active, setActive] = useState(sections[0]?.id);
  const strip = useRef(null);
  const ids = sections.map(s => s.id).join(',');
  useEffect(() => {
    const targets = ids.split(',').filter(Boolean).map(id => document.getElementById(id)).filter(Boolean);
    if (!targets.length) return;
    const update = () => {
      const nav = document.querySelector('[data-exp-navigation]');
      const offset = (nav?.getBoundingClientRect().bottom || 150) + 32;
      const positions = targets.map(el => ({ el, top: el.getBoundingClientRect().top }));
      const atBottom = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const current = atBottom ? positions.sort((a, b) => b.top - a.top)[0].el
        : positions.filter(item => item.top <= offset).sort((a, b) => b.top - a.top)[0]?.el || targets[0];
      setActive(current.id);
    };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { update(); frame = 0; });
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [ids]);
  useEffect(() => {
    const container = strip.current;
    const button = container?.querySelector('[aria-current="location"]');
    if (!button) return;
    const left = button.offsetLeft - container.offsetLeft;
    if (left < container.scrollLeft || left + button.offsetWidth > container.scrollLeft + container.clientWidth) {
      container.scrollTo({ left: Math.max(0, left - 12), behavior: 'auto' });
    }
  }, [active]);

  return <nav className={cn('exp-navigation', className)} aria-label="Secciones del expediente" data-exp-navigation>
    <div className="exp-navigation__items" ref={strip}>
      {sections.map(section => {
        const Icon = section.icon;
        return <button key={section.id} type="button" aria-current={active === section.id ? 'location' : undefined}
          className={cn('exp-navigation__item', active === section.id && 'is-active')}
          onClick={() => { setActive(section.id); irASeccionExpediente(section.id); }}>
          {Icon && <Icon size={16} />}<span>{section.label}</span>
          {section.count !== undefined && <span className="exp-navigation__count">{section.count}</span>}
        </button>;
      })}
    </div>
  </nav>;
}
