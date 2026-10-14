import { forwardRef, useId, useState, cloneElement, isValidElement } from 'react';
import { cn } from '../lib/utils';
import { ChevronDown, Check } from './Icons';

/* ---------------------------------------------------------------------------
   Base compartida
   --------------------------------------------------------------------------- */
const CONTROL = 'w-full bg-surface text-ink-900 border border-line-strong rounded-md transition-colors duration-150 placeholder:text-ink-400 ' +
  'hover:border-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 ' +
  'disabled:bg-canvas disabled:text-ink-500 disabled:cursor-not-allowed disabled:hover:border-line-strong ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25 read-only:bg-canvas';
const HEIGHTS = { sm: 'h-8 text-13', md: 'h-9 text-sm', lg: 'h-10 text-sm' };

function Label({ htmlFor, children, required, className }) {
  if (!children) return null;
  return (
    <label htmlFor={htmlFor} className={cn('block text-13 font-medium text-ink-700 mb-1.5', className)}>
      {children}
      {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}

function Hint({ id, children }) {
  if (!children) return null;
  return <p id={id} className="mt-1.5 text-xs text-ink-500">{children}</p>;
}

function ErrorText({ id, children }) {
  if (!children) return null;
  return <p id={id} role="alert" className="mt-1.5 text-xs text-danger">{children}</p>;
}

/**
 * Envoltorio para controles propios: genera `id`, `aria-describedby` y
 * `aria-invalid` y los pasa al hijo (elemento o función).
 *
 *   <Field label="Fecha" hint="Formato dd-mm-aaaa" error={err}>
 *     <input type="date" … />
 *   </Field>
 *   <Field label="Región">{(a11y) => <MiSelect {...a11y} />}</Field>
 */
export function Field({ label, hint, error, required, id, className, children }) {
  const auto = useId();
  const fid = id || auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  const a11y = {
    id: fid,
    'aria-describedby': [errId, hintId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  };
  const child = typeof children === 'function'
    ? children(a11y)
    : isValidElement(children) ? cloneElement(children, { ...a11y, ...children.props, id: children.props.id || fid }) : children;
  return (
    <div className={className}>
      <Label htmlFor={fid} required={required}>{label}</Label>
      {child}
      <ErrorText id={errId}>{error}</ErrorText>
      {!error && <Hint id={hintId}>{hint}</Hint>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Input
   --------------------------------------------------------------------------- */
export const Input = forwardRef(function Input(
  { label, hint, error, required, id, className, inputClassName, size = 'md', prefix, suffix, type = 'text', ...props },
  ref,
) {
  const auto = useId();
  const fid = id || auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  const control = (
    <input
      ref={ref}
      id={fid}
      type={type}
      aria-describedby={[errId, hintId].filter(Boolean).join(' ') || undefined}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
      className={cn(CONTROL, HEIGHTS[size] || HEIGHTS.md, 'px-3', prefix && 'pl-9', suffix && 'pr-12', inputClassName)}
      {...props}
    />
  );
  return (
    <div className={className}>
      <Label htmlFor={fid} required={required}>{label}</Label>
      {(prefix || suffix) ? (
        <div className="relative">
          {prefix && <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink-500 text-sm pointer-events-none">{prefix}</span>}
          {control}
          {suffix && <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-500 text-13 pointer-events-none">{suffix}</span>}
        </div>
      ) : control}
      <ErrorText id={errId}>{error}</ErrorText>
      {!error && <Hint id={hintId}>{hint}</Hint>}
    </div>
  );
});

/* ---------------------------------------------------------------------------
   Select (flecha propia; `options` [{value,label}] o children <option>)
   --------------------------------------------------------------------------- */
export const Select = forwardRef(function Select(
  { label, hint, error, required, id, className, selectClassName, size = 'md', options, placeholder, children, ...props },
  ref,
) {
  const auto = useId();
  const fid = id || auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  return (
    <div className={className}>
      <Label htmlFor={fid} required={required}>{label}</Label>
      <div className="relative">
        <select
          ref={ref}
          id={fid}
          aria-label={!label ? (props['aria-label'] || placeholder || undefined) : undefined}
          aria-describedby={[errId, hintId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          className={cn(CONTROL, HEIGHTS[size] || HEIGHTS.md, 'pl-3 pr-9 appearance-none cursor-pointer', selectClassName)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options ? options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>) : children}
        </select>
        <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
      </div>
      <ErrorText id={errId}>{error}</ErrorText>
      {!error && <Hint id={hintId}>{hint}</Hint>}
    </div>
  );
});

/* ---------------------------------------------------------------------------
   Textarea
   --------------------------------------------------------------------------- */
export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, id, className, textareaClassName, rows = 3, maxLength, showCount = false, value, ...props },
  ref,
) {
  const auto = useId();
  const fid = id || auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  return (
    <div className={className}>
      <Label htmlFor={fid} required={required}>{label}</Label>
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        maxLength={maxLength}
        value={value}
        aria-describedby={[errId, hintId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        className={cn(CONTROL, 'px-3 py-2 text-sm resize-y min-h-[72px]', textareaClassName)}
        {...props}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <ErrorText id={errId}>{error}</ErrorText>
          {!error && <Hint id={hintId}>{hint}</Hint>}
        </div>
        {showCount && maxLength && (
          <span className="mt-1.5 text-xs text-ink-500 tabular shrink-0">{String(value ?? '').length}/{maxLength}</span>
        )}
      </div>
    </div>
  );
});

/* ---------------------------------------------------------------------------
   Checkbox / Switch
   --------------------------------------------------------------------------- */
export const Checkbox = forwardRef(function Checkbox({ label, hint, id, className, checked, disabled, ...props }, ref) {
  const auto = useId();
  const fid = id || auto;
  return (
    <label htmlFor={fid} className={cn('inline-flex items-start gap-2.5 cursor-pointer select-none', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-0.5 shrink-0">
        <input ref={ref} id={fid} type="checkbox" checked={checked} disabled={disabled} className="peer sr-only" {...props} />
        <span className="block h-4 w-4 rounded-[4px] border border-line-strong bg-surface transition-colors peer-checked:bg-brand-600 peer-checked:border-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40" />
        <Check size={12} strokeWidth={3} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100" />
      </span>
      {(label || hint) && (
        <span className="text-sm text-ink-700">
          {label}
          {hint && <span className="block text-xs text-ink-500">{hint}</span>}
        </span>
      )}
    </label>
  );
});

export const Switch = forwardRef(function Switch({ label, hint, id, className, checked = false, onChange, disabled, size = 'md', ...props }, ref) {
  const auto = useId();
  const fid = id || auto;
  const dims = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'h-4 w-4 translate-x-0.5' : 'h-5 w-5 translate-x-0.5';
  const on = size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]';
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        ref={ref}
        id={fid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn('relative shrink-0 rounded-full border border-transparent transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50',
          dims, checked ? 'bg-brand-600' : 'bg-line-strong')}
        {...props}
      >
        <span className={cn('absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-card transition-transform duration-150', knob, checked && on)} />
      </button>
      {(label || hint) && (
        <label htmlFor={fid} className="text-sm text-ink-700 cursor-pointer">
          {label}
          {hint && <span className="block text-xs text-ink-500">{hint}</span>}
        </label>
      )}
    </div>
  );
});

/* ---------------------------------------------------------------------------
   MoneyInput (CLP / USD) · NumberInput con unidad
   --------------------------------------------------------------------------- */
const nfCL = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

/**
 * Entrada de dinero: muestra "12.523.000" con separador de miles mientras no
 * tiene el foco y dígitos limpios mientras se escribe. `value` es un número
 * (o null); `onChange(number|null)`.
 */
export const MoneyInput = forwardRef(function MoneyInput(
  { currency = 'CLP', value, onChange, label, hint, error, required, id, className, size = 'md', placeholder = '0', ...props },
  ref,
) {
  const [focus, setFocus] = useState(false);
  const [raw, setRaw] = useState('');
  const shown = focus ? raw : (value === null || value === undefined || value === '' ? '' : nfCL.format(Number(value)));
  return (
    <Input
      ref={ref}
      label={label} hint={hint} error={error} required={required} id={id} className={className} size={size}
      inputMode="numeric"
      prefix={currency === 'USD' ? 'USD' : '$'}
      suffix={currency === 'USD' ? undefined : 'CLP'}
      inputClassName="text-right tabular"
      placeholder={placeholder}
      value={shown}
      onFocus={() => { setRaw(value === null || value === undefined || value === '' ? '' : String(Math.round(Number(value)))); setFocus(true); }}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '');
        setRaw(digits);
        onChange?.(digits === '' ? null : Number(digits));
      }}
      {...props}
    />
  );
});

/** Número con sufijo de unidad (`unit`: "%", "USD", "pies", …). `onChange(e)` nativo. */
export const NumberInput = forwardRef(function NumberInput({ unit, inputClassName, ...props }, ref) {
  return <Input ref={ref} type="number" inputMode="decimal" suffix={unit} inputClassName={cn('text-right tabular', inputClassName)} {...props} />;
});

/** Agrupa campos en una grilla (1 columna en móvil, `cols` en ≥ sm). */
export function FormGrid({ children, cols = 2, className }) {
  const grid = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[cols] || 'sm:grid-cols-2';
  return <div className={cn('grid grid-cols-1 gap-4', grid, className)}>{children}</div>;
}
