import { useState } from 'react'
import type { Camera } from '../model/types'
import { formatDate } from '@/shared/lib'
import styles from './CameraRow.module.css'

function TrashIcon() {
  return (
    <svg width="14" height="15" viewBox="0 0 14 15" fill="none">
      <path d="M1 3.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M4.5 3.5V2.5C4.5 1.95 4.95 1.5 5.5 1.5H8.5C9.05 1.5 9.5 1.95 9.5 2.5V3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M2.5 3.5L3.5 12.5C3.5 13.05 3.95 13.5 4.5 13.5H9.5C10.05 13.5 10.5 13.05 10.5 12.5L11.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.5 6.5V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8.5 6.5V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

interface CameraRowProps {
  camera: Camera
  onClick?: (id: string) => void
  onDelete?: (id: string) => void
}

export function CameraRow({ camera, onClick, onDelete }: CameraRowProps) {
  const [confirming, setConfirming] = useState(false)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirming(true)
  }

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirming(false)
    onDelete?.(camera.guid)
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirming(false)
  }

  return (
    <tr
      className={`${styles.row} ${onClick ? styles.rowClickable : ''}`}
      onClick={() => !confirming && onClick?.(camera.guid)}
    >
      <td className={styles.nameCell}>
        <div className={styles.cameraName}>{camera.name}</div>
      </td>

      <td className={styles.streamCell}>
        <span className={styles.streamUrl}>{camera.stream}</span>
      </td>

      <td className={styles.streamCell}>
        <span className={styles.streamUrl}>{camera.streamHd}</span>
      </td>

      <td className={styles.cell}>
        <span className={camera.isEnabled ? styles.statusActive : styles.statusDisabled}>
          <span className={styles.statusDot} />
          {camera.isEnabled ? 'Активна' : 'Отключена'}
        </span>
      </td>

      <td className={styles.cell}>
        {camera.accessPointId !== null ? (
          <span className={styles.accessPoint}>#{camera.accessPointId}</span>
        ) : (
          <span className={styles.dash}>—</span>
        )}
      </td>

      <td className={styles.cell}>
        <span className={styles.date}>{formatDate(camera.createdAt)}</span>
      </td>

      <td className={styles.actionCell}>
        {onDelete && !confirming && (
          <button className={styles.deleteBtn} onClick={handleDeleteClick} title="Удалить камеру">
            <TrashIcon />
          </button>
        )}
        {onDelete && confirming && (
          <div className={styles.confirmRow}>
            <button className={styles.confirmYes} onClick={handleConfirm}>Удалить</button>
            <button className={styles.confirmNo} onClick={handleCancel}>Отмена</button>
          </div>
        )}
      </td>
    </tr>
  )
}
