import { useState, type FormEvent } from 'react';

/**
 * A short form asked for in place, where the action was taken.
 *
 * The screens that use this ask for a caption, a reason, or what a customer
 * said on the phone. Those are consequential enough to want a real field — a
 * browser prompt gives no label, no validation, no multi-line answer, and no
 * way to say which of two similar questions is being asked.
 */

export interface InlineField {
  readonly name: string;
  readonly label: string;
  /** Empty is refused when true. */
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly initial?: string;
  /** When set, the field is a picker instead of free text. */
  readonly options?: readonly { readonly value: string; readonly label: string }[];
}

export default function InlineForm({
  title,
  note,
  fields,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  title: string;
  note?: string;
  fields: readonly InlineField[];
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: Readonly<Record<string, string>>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((field) => [field.name, field.initial ?? ''])),
  );

  const missing = fields.some((field) => field.required && (values[field.name] ?? '').trim() === '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (missing || busy) return;
    onSubmit(Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()]),
    ));
  };

  return (
    <form className="state" onSubmit={submit} style={{ textAlign: 'left' }}>
      <h3>{title}</h3>
      {note !== undefined && <p>{note}</p>}
      {fields.map((field) => (
        <label key={field.name} className="field">
          <span>{field.label}{field.required === true ? '' : ' (optional)'}</span>
          {field.options !== undefined ? (
            <select
              value={values[field.name] ?? ''}
              onChange={(event) => setValues((previous) => ({ ...previous, [field.name]: event.target.value }))}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : field.multiline === true ? (
            <textarea
              value={values[field.name] ?? ''}
              placeholder={field.placeholder ?? ''}
              onChange={(event) => setValues((previous) => ({ ...previous, [field.name]: event.target.value }))}
            />
          ) : (
            <input
              type="text"
              value={values[field.name] ?? ''}
              placeholder={field.placeholder ?? ''}
              onChange={(event) => setValues((previous) => ({ ...previous, [field.name]: event.target.value }))}
            />
          )}
        </label>
      ))}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="submit" className="action action-solid" disabled={busy || missing}>
          {submitLabel}
        </button>
        <button type="button" className="action action-quiet" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
