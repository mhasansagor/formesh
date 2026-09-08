/**
 * Context passed to a normalizer alongside the raw input value.
 * Kept intentionally small in Phase 1 — extend only when a real normalizer
 * needs more (e.g. sibling values), not speculatively.
 */
export interface NormalizeContext {
  /** The dot-path of the field being normalized. */
  path: string;
}

/**
 * A normalizer takes whatever a UI component hands back (a DOM event, a
 * Date, a react-select-style option object, a plain value...) and returns
 * the value that should actually be stored.
 *
 * This is the single place that replaces the hand-written
 * `handleFieldChange` type-sniffing function duplicated across form
 * components in the reference application — implemented once here, with an
 * escape hatch (a custom Normalizer) for shapes it doesn't know about.
 */
export type Normalizer<TValue = unknown> = (
  input: unknown,
  context: NormalizeContext,
) => TValue;

export interface FieldOptions<TValue = unknown> {
  /** Custom normalizer. Defaults to `defaultNormalize` when omitted. */
  normalize?: Normalizer<TValue>;
  /** Value to use when the field has never been set. */
  defaultValue?: TValue;
}

/**
 * The prop bag `registerField` hands back — deliberately shaped like the
 * value/onChange/onBlur triplet every existing input component
 * (native inputs, and the reference app's AppInput/AppDropdown/etc.)
 * already expects, so adopting the library is a plumbing swap, not a
 * component rewrite.
 */
export interface RegisteredField<TValue = unknown> {
  name: string;
  value: TValue;
  onChange: (input: unknown) => void;
  onBlur: () => void;
}
