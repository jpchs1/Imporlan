import { cn } from '../lib/utils';
import { ETAPAS_EXPEDIENTE } from '../lib/status';
import { fmtDateLarga } from '../lib/format';
import { Check, ChevronLeft, ChevronRight } from './Icons';
import { Button } from './Button';

/**
 * Etapas del expediente (5): Plan o cotización · Búsqueda · Inspección · Compra · Logística.
 *
 *   <ProcessStepper current={3} />                                 horizontal ≥ md, vertical con descripción en móvil
 *   <ProcessStepper current={3} completedAt={{ 1: '2026-09-02', 2: '2026-09-20' }} />
 *   <ProcessStepper current={3} compact />                         barra + "Etapa 3 de 5 · Inspección" (tarjetas)
 *   <ProcessStepper current={3} onPrev={…} onNext={…} />          solo admin: Retroceder / Avanzar
 *
 * `steps` permite otra lista [{ num, label, description }]. `step` ≡ current (compatibilidad).
 */
export function ProcessStepper({ current, step, steps = ETAPAS_EXPEDIENTE, completedAt = {}, compact = false, onPrev, onNext, orientation = 'auto', showDescription = true, className, currentNote }) {
  const total = steps.length;
  const cur = Math.min(Math.max(Number(current ?? step ?? 1) || 1, 1), total);
  const actual = steps.find(s => s.num === cur) || steps[cur - 1];

  if (compact) {
    return (
      <div className={cn('min-w-0', className)} role="group" aria-label={`Etapa ${cur} de ${total}: ${actual?.label}`}>
        <div className="flex items-center gap-1" aria-hidden="true">
          {steps.map(s => (
            <span key={s.num} className={cn('h-1.5 flex-1 rounded-full', s.num < cur ? 'bg-brand-600' : s.num === cur ? 'bg-brand-500' : 'bg-line')} />
          ))}
        </div>
        <p className="mt-1.5 text-13 text-ink-500 tabular truncate">
          Etapa {cur} de {total} · <span className="text-ink-900 font-medium">{actual?.label}</span>
        </p>
      </div>
    );
  }

  const horizontal = orientation === 'horizontal';
  const vertical = orientation === 'vertical';

  return (
    <div className={className}>
      <ol
        className={cn(
          'relative',
          vertical ? 'flex flex-col gap-0' : horizontal ? 'flex items-start' : 'flex flex-col md:flex-row md:items-start',
        )}
        aria-label="Etapas del expediente"
      >
        {steps.map((s, i) => {
          const done = s.num < cur;
          const active = s.num === cur;
          const last = i === total - 1;
          const fecha = completedAt?.[s.num];
          return (
            <li
              key={s.num}
              aria-current={active ? 'step' : undefined}
              className={cn('relative flex min-w-0', vertical ? 'flex-row gap-3 pb-6' : horizontal ? 'flex-1 flex-col items-center text-center' : 'flex-row gap-3 pb-6 md:pb-0 md:flex-1 md:flex-col md:items-center md:text-center md:gap-0', last && (vertical ? 'pb-0' : 'md:pb-0 pb-0'))}
            >
              {/* conector */}
              {!last && (
                <span aria-hidden="true" className={cn(
                  'absolute',
                  vertical ? 'left-[15px] top-8 bottom-0 w-0.5' : horizontal ? 'top-4 left-[calc(50%+20px)] right-[calc(-50%+20px)] h-0.5' : 'left-[15px] top-8 bottom-0 w-0.5 md:top-4 md:left-[calc(50%+20px)] md:right-[calc(-50%+20px)] md:bottom-auto md:w-auto md:h-0.5',
                  done ? 'bg-brand-600' : 'bg-line',
                )} />
              )}
              <span className={cn(
                'relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-13 font-semibold tabular',
                done ? 'bg-brand-600 text-white' : active ? 'bg-surface border-2 border-brand-600 text-brand-700' : 'bg-surface border border-line-strong text-ink-500',
              )}>
                {done ? <Check size={16} strokeWidth={2.5} /> : s.num}
              </span>
              <div className={cn('min-w-0', vertical ? 'pt-1' : horizontal ? 'mt-2 px-1' : 'pt-1 md:pt-0 md:mt-2 md:px-1')}>
                <p className={cn('text-13 leading-5', active ? 'font-semibold text-ink-900' : done ? 'font-medium text-ink-700' : 'text-ink-500')}>{s.label}</p>
                {fecha && <p className="text-xs text-ink-500 tabular">{fmtDateLarga(fecha)}</p>}
                {showDescription && s.description && (
                  <p className={cn('text-xs text-ink-500 mt-0.5', vertical ? '' : horizontal ? 'hidden' : 'md:hidden')}>{s.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {currentNote && <p className="mt-4 text-sm text-ink-700 bg-brand-50 border border-brand-200 rounded-md px-3 py-2">{currentNote}</p>}
      {(onPrev || onNext) && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={onPrev} disabled={cur <= 1}>Retroceder</Button>
          <span className="text-13 text-ink-500 tabular">Etapa {cur} de {total}</span>
          <Button variant="secondary" size="sm" iconRight={ChevronRight} onClick={onNext} disabled={cur >= total}>Avanzar</Button>
        </div>
      )}
    </div>
  );
}
