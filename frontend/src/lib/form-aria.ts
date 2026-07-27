/**
 * Builds the id and ARIA attributes a control needs so its hint and inline error
 * are announced. Pair with `MachineFormField`, which renders `${id}-hint`
 * and `${id}-error` using the same convention.
 */
export function fieldAria(id: string, error?: string, hint?: string) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const;
}
