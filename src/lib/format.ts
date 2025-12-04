/**
 * Format date in Dominican Republic locale
 */
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format currency in Dominican Republic format
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'DOP'
): string => {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Format area in square meters
 */
export const formatArea = (area: number): string => {
  return area.toLocaleString('es-DO') + ' m²'
}