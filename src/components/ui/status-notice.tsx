export function StatusNotice({ title, children, error = false }: { title: string; children?: React.ReactNode; error?: boolean }) {
 return <section className={`status-notice${error ? " error" : ""}`} role={error ? "alert" : "status"}><strong>{title}</strong>{children && <div>{children}</div>}</section>;
}
