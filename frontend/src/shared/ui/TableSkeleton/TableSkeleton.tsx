import styles from './TableSkeleton.module.css'

interface TableSkeletonProps {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 5, cols = 5 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={styles.row}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className={styles.cell}>
              <div className={styles.bone} style={{ width: j === 0 ? '60%' : j === cols - 1 ? '40%' : '80%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
