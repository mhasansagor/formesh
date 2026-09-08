import type { FormStore, FormValues } from "../types/store";
import type { FormSection } from "../types/section";
import { getAtPath } from "../utils/paths";
import { watchPath } from "../utils/watch";

/**
 * Wraps a slice of a FormStore (identified by a top-level or dot-path key)
 * as an independently usable FormSection.
 *
 * This is the primitive behind multi-section ERP-style forms: each section
 * of a form (e.g. "employeeInfo", "jobInfo", "bankInfo") can be built,
 * tested, and reasoned about as if it owned its own store, while every
 * write actually lands on the shared parent store — so the parent always
 * has the complete, merged plain object (see roadmap section 8).
 *
 * Framework-agnostic: no React import here either. `useForm(store, {
 * section })` (in the react entry point) is a thin hook wrapper around this.
 */
export function createFormSection<TSectionValues extends FormValues = FormValues>(
  store: FormStore<FormValues>,
  key: string,
): FormSection<TSectionValues> {
  const prefix = `${key}.`;

  const toRelative = (path: string): string | null => {
    if (path === key) return "";
    if (path.startsWith(prefix)) return path.slice(prefix.length);
    return null;
  };

  const toAbsolute = (relativePath: string): string =>
    relativePath ? `${key}.${relativePath}` : key;

  return {
    key,

    getValues: () => (getAtPath(store.getValues(), key) ?? {}) as TSectionValues,

    getValue: (relativePath) => getAtPath(store.getValues(), toAbsolute(relativePath)),

    setValue: (relativePath, value) => {
      store.setValue(toAbsolute(relativePath), value);
    },

    setValues: (partial) => {
      const current = (getAtPath(store.getValues(), key) ?? {}) as TSectionValues;
      store.setValue(key, { ...current, ...partial });
    },

    reset: () => {
      const baseline = getAtPath(store.getInitialValues(), key) ?? {};
      store.setValue(key, baseline);
    },

    getInitialValues: () =>
      (getAtPath(store.getInitialValues(), key) ?? {}) as TSectionValues,

    subscribe: (listener) => {
      return store.subscribe((changedPaths) => {
        const relevant: string[] = [];
        for (const path of changedPaths) {
          const relative = toRelative(path);
          if (relative !== null) relevant.push(relative);
        }
        if (relevant.length > 0) listener(relevant);
      });
    },

    /**
     * Same semantics as `FormStore.watch`, but with section-relative paths.
     * Also fires when the section's slice is replaced wholesale on the
     * parent (`store.setValue(key, {...})` arrives here as a relative ""
     * change) and the watched value actually changed as a result.
     */
    watch: (relativePath, listener) =>
      watchPath(
        (cb) =>
          store.subscribe((changedPaths) => {
            const relevant: string[] = [];
            for (const path of changedPaths) {
              const relative = toRelative(path);
              if (relative !== null) relevant.push(relative);
            }
            if (relevant.length > 0) cb(relevant);
          }),
        () => getAtPath(store.getValues(), toAbsolute(relativePath)),
        relativePath,
        listener,
      ),
  };
}
