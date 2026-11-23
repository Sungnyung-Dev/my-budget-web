import { useState } from 'react'
import { createPortal } from 'react-dom'
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, Modifier } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Category } from '../domain/types'
import { formatNumber } from '../domain/formatters'
import { Icon } from './Icon'

type CategoryItem = Category & { usageCount: number }
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

function CategoryOrderRow({ category, index, count, disabled, editingDisabled, onEdit, onMove }: {
  category: CategoryItem
  index: number
  count: number
  disabled: boolean
  editingDisabled: boolean
  onEdit: (category: Category) => void
  onMove: (from: number, to: number) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: category.id, disabled })
  return (
    <li ref={setNodeRef} className={`categories-item${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" className="categories-row" disabled={editingDisabled}
        aria-label={`${category.name}, 카테고리 수정`} onClick={() => onEdit(category)}>
        <span><span className="categories-name">{category.name}</span><span className="categories-count">{formatNumber(category.usageCount)}건 사용</span></span>
        <span className="settings-arrow" aria-hidden="true">›</span>
      </button>
      <div className="categories-move-buttons" role="group" aria-label={`${category.name} 순서 변경`}>
        <button type="button" disabled={editingDisabled || index === 0} aria-label={`${category.name} 위로 이동`} onClick={() => onMove(index, index - 1)}><Icon name="arrowUp" size={16} /></button>
        <button type="button" disabled={editingDisabled || index === count - 1} aria-label={`${category.name} 아래로 이동`} onClick={() => onMove(index, index + 1)}><Icon name="arrowDown" size={16} /></button>
      </div>
      <button ref={setActivatorNodeRef} type="button" className="categories-drag-handle"
        {...attributes} {...listeners} disabled={disabled || count < 2}
        aria-label={`${category.name} 순서 변경 핸들`} aria-roledescription="정렬 핸들"
        title="길게 눌러 위아래로 이동" onContextMenu={(event) => event.preventDefault()}>
        <Icon name="grip" size={18} />
      </button>
    </li>
  )
}

export function CategoryOrderList({ items, disabled, editingDisabled, onEdit, onOrder, onDraggingChange }: {
  items: CategoryItem[]
  disabled: boolean
  editingDisabled: boolean
  onEdit: (category: Category) => void
  onOrder: (categoryIds: string[]) => void
  onDraggingChange: (dragging: boolean) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const active = items.find((category) => category.id === activeId)

  function move(from: number, to: number) {
    if (disabled || from < 0 || to < 0 || to >= items.length || from === to) return
    onOrder(arrayMove(items, from, to).map((category) => category.id))
  }

  function endDrag({ active, over }: DragEndEvent) {
    setActiveId(null)
    onDraggingChange(false)
    if (over) move(items.findIndex((category) => category.id === active.id), items.findIndex((category) => category.id === over.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]}
      accessibility={{
        screenReaderInstructions: { draggable: '스페이스 또는 Enter 키로 이동을 시작하고 위아래 방향키로 순서를 변경하세요. 다시 스페이스 또는 Enter 키로 저장하고 Escape 키로 취소하세요.' },
        announcements: {
          onDragStart: ({ active }) => `${items.find((item) => item.id === active.id)?.name} 순서 변경을 시작합니다.`,
          onDragOver: ({ over }) => over ? `${items.findIndex((item) => item.id === over.id) + 1}번째 위치입니다.` : '이동할 위치가 없습니다.',
          onDragEnd: () => '순서 변경 드래그를 마쳤습니다.',
          onDragCancel: () => '순서 변경을 취소했습니다.',
        },
      }}
      onDragStart={({ active }) => { setActiveId(String(active.id)); onDraggingChange(true) }}
      onDragCancel={() => { setActiveId(null); onDraggingChange(false) }} onDragEnd={endDrag}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className="categories-list" aria-busy={disabled}>
          {items.map((category, index) => (
            <CategoryOrderRow key={category.id} category={category} index={index} count={items.length}
              disabled={disabled} editingDisabled={editingDisabled} onEdit={onEdit} onMove={move} />
          ))}
        </ul>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {active && <div className="categories-drag-preview"><span className="categories-name">{active.name}</span><Icon name="grip" size={18} /></div>}
        </DragOverlay>, document.body,
      )}
    </DndContext>
  )
}
