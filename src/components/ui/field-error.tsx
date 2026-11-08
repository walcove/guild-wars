export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
 return <p id={id} className="field-error">Error: {children}</p>;
}
