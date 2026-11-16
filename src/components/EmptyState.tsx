import { Icon, type IconName } from './Icon'

export function EmptyState({ icon = 'receipt', title, description }: {
  icon?: IconName
  title: string
  description: string
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={24} /></span>
      <p className="empty-title">{title}</p>
      <p className="empty-description">{description}</p>
    </div>
  )
}
