# ForMesh

**Multi-section forms for React, without the re-render tax.**

`@mhasansagor/formesh` is a small, framework-agnostic form state library built for forms that outgrow `useState` — long ERP/CRM-style forms made of independent sections, each merging into one plain JavaScript object, with validation, debounced sync, and derived fields as first-class primitives instead of hand-rolled hooks per component.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Status](https://img.shields.io/badge/status-active%20development-orange.svg)]()
[![Tests](https://img.shields.io/badge/tests-124%20passing-brightgreen.svg)]()
[![Core size](https://img.shields.io/badge/core-3.4%20KB%20gzip-success.svg)]()

---

## Why ForMesh

Most form libraries assume one flat form. Real enterprise forms rarely look like that — an employee record is Personal Info + Job Info + Bank Info + Documents, each built as its own component, all merging into one object to submit. Wiring that by hand means the same plumbing rewritten in every section: sync-to-parent, type-sniffing `onChange` handlers, visual-only validation, and re-renders that cascade across the whole form on every keystroke.

ForMesh starts from that problem instead of retrofitting it:

- **Sections are a first-class primitive**, not a convention you maintain yourself. Each section owns its slice; the parent always has the complete, merged object.
- **Fine-grained by construction.** The store only clones the branch that changed (structural sharing), so a component subscribed to one field never re-renders when an unrelated field changes — no memoization, no selectors to get right.
- **Debounced sync and derived fields are one primitive, not two.** The same `createDebouncedSync` wrapper fronts a whole store, a single section, or a future array row — and it composes straight into the same hooks as the un-wrapped target.
- **Validation is a plain function, not a schema DSL.** `(value, context) => message | undefined`. Ship the built-ins, or write a domain rule in one line.
- **Nearly zero dependencies.** No lodash, no schema-validation runtime baked into core. `~3.4 KB` gzip for the core, `~3.9 KB` for the React bindings — pay only for what you import.

## Installation

```bash
npm install @mhasansagor/formesh
# or
pnpm add @mhasansagor/formesh
```

> **Status:** ForMesh is under active development and not yet published to the public npm registry. The API below reflects what's implemented and tested today; `/file` and `/array` entry points are reserved for upcoming phases (see [Roadmap](#roadmap)).

## Quick start

```tsx
import { createFormStore } from "@mhasansagor/formesh";
import { useForm } from "@mhasansagor/formesh/react";

const store = createFormStore({ firstName: "", email: "" });

function ProfileForm() {
  const form = useForm(store);
  const firstName = form.registerField("firstName");
  const email = form.registerField("email");

  return (
    <form onSubmit={(e) => { e.preventDefault(); console.log(form.values); }}>
      <input {...firstName} />
      <input {...email} />
      <button type="submit" disabled={!form.isValid}>Save</button>
    </form>
  );
}
```

## Multi-section forms

Each section is built independently and reads/writes its own slice — the parent store ends up with the full merged object, with no manual wiring in between.

```tsx
const store = createFormStore({
  employeeInfo: { firstName: "", lastName: "" },
  jobInfo: { department: "", designation: "" },
  bankInfo: { accountNumber: "", bankName: "" },
});

function EmployeeInfoSection() {
  const form = useForm(store, { section: "employeeInfo" });
  return <input {...form.registerField("firstName")} />;
}

function JobInfoSection() {
  const form = useForm(store, { section: "jobInfo" });
  return <input {...form.registerField("department")} />;
}

// store.getValues() → { employeeInfo: {...}, jobInfo: {...}, bankInfo: {...} }
```

## Validation

Validators are plain functions — pure, synchronous, composable. Use the built-ins or write your own; both compose identically.

```tsx
import { required, email, minLength } from "@mhasansagor/formesh/validators";

const form = useForm(store, {
  validation: {
    fields: {
      firstName: required(),
      email: [required(), email()],
      sku: (value, { values }) =>
        values.existingSkus.includes(value) ? "SKU already exists." : undefined,
    },
    form: (values) =>
      values.endDate < values.startDate
        ? { endDate: "End date must be after start date." }
        : undefined,
  },
});

form.errors;    // { email: "Enter a valid email address." }
form.isValid;   // false
```

## Debounced sync & derived fields

One wrapper, any target — a whole store, a section, or (soon) an array row. Writes batch and commit after a quiet period; reads stay live the whole time.

```tsx
import { useDebouncedSync } from "@mhasansagor/formesh/react";

function EmployeeInfoSection() {
  const section = useForm(store, { section: "employeeInfo" });
  const sync = useDebouncedSync(section, { delay: 300 });
  const form = useForm(sync); // composes straight in — same hooks, buffered target
  return <input {...form.registerField("firstName")} />;
}
```

Derived and cascading fields subscribe to one path and react to real changes only:

```tsx
import { useWatch } from "@mhasansagor/formesh/react";

useWatch(store, "jobInfo.department", (department) => {
  store.setValue("jobInfo.designation", "");
});
```

## Why not just React Context?

A Context-based form re-renders every consumer on every keystroke, regardless of which field they read. ForMesh instead exposes a subscribable store (`useSyncExternalStore` under the hood) where each write only touches the objects along its own path — so a field's re-render is gated by whether *its own* value actually changed, not by anything else in the form. No `Controller` ceremony required for third-party inputs that don't expose a ref.

## Roadmap

| Phase | Status |
|---|---|
| Core store, sections, `useForm` | ✅ Shipped |
| Field registration & normalization | ✅ Shipped |
| Debounced sync & `watch` | ✅ Shipped |
| Validation (`/validators`) | ✅ Shipped |
| File uploads (`/file`) | ✅ Shipped |
| Field arrays (`/array`) | ✅ Shipped |
| TypeScript path autocomplete, `FormDebugger` | 📋 Planned |

## Contributing

This is a pnpm workspace. Install with `pnpm install`, then:

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit, strict mode
pnpm test        # Vitest
pnpm build       # tsup, all entry points
```

Please run the full pipeline above before opening a pull request — CI runs the same four commands and will fail on any regression.

## Author

Built by **Mehedi Hasan Sagor** ([@mhasansagor](https://github.com/mhasansagor)), out of real multi-module ERP form work, and generalized to be useful well beyond it.

## License

Apache License Version 2.0, January 2004

See the [full license text](https://www.apache.org/licenses/LICENSE-2.0).