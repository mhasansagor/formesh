// Framework-agnostic core. This file (and everything it imports) must
// never import React — it is usable standalone, and the /react entry
// point is built on top of it, not the other way around.

export { createFormStore } from "./core/store/createFormStore";
export { createFormSection } from "./core/store/createFormSection";
export { createDebouncedSync } from "./core/store/createDebouncedSync";
export { validateValues } from "./core/validation/validateValues";

export { defaultNormalize } from "./core/utils/normalize";
export { deepEqual } from "./core/utils/deepEqual";
export { getAtPath, setAtPath, mergeAtRoot, diffPaths } from "./core/utils/paths";
export { isPathWithin } from "./core/utils/watch";

export type {
  FormStore,
  FormValues,
  FieldPath,
  StoreListener,
  WatchListener,
  Unsubscribe,
} from "./core/types/store";
export type { FormSection, SectionListener } from "./core/types/section";
export type {
  SyncTarget,
  DebouncedSync,
  DebouncedSyncOptions,
} from "./core/types/sync";
export type {
  Normalizer,
  NormalizeContext,
  FieldOptions,
  RegisteredField,
} from "./core/types/field";
export type {
  Validator,
  ValidationContext,
  FieldRules,
  FormLevelValidator,
  ValidationSchema,
  ValidationResult,
} from "./core/types/validation";
