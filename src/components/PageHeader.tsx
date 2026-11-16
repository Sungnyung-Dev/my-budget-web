export function PageHeader({ title, description, eyebrow = 'MY PERSONAL LEDGER' }: {
  title: string
  description: string
  eyebrow?: string
}) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
    </header>
  )
}
