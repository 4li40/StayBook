import { ApiClientError } from "./api";

export function collectFieldErrors<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  pathMap?: Partial<Record<string, TField>>,
): Partial<Record<TField | "form", string>> {
  if (!(error instanceof ApiClientError)) {
    return {};
  }

  return (error.issues ?? []).reduce<Partial<Record<TField | "form", string>>>(
    (fieldErrors, issue) => {
      const serverPath = issue.path.split(".")[0];
      const field = (pathMap?.[serverPath] ?? serverPath) as TField;

      if (fields.includes(field) && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }

      return fieldErrors;
    },
    {},
  );
}
