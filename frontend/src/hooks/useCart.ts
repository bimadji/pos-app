import { useCallback, useEffect, useState } from 'react'
import type { CategoryItem } from '../services/api'

export interface CartLine {
  product_id: string
  name: string
  price: number
  quantity: number
  notes: string
}

const storageKey = (tableId: string) => `pos_cart_table_${tableId}`

/**
 * Cart draft persisted to localStorage so a page reload or app switch
 * on the customer's phone never loses their selections.
 */
export function useCart(tableId: string) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey(tableId))
      return raw ? (JSON.parse(raw) as CartLine[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(storageKey(tableId), JSON.stringify(lines))
  }, [tableId, lines])

  const addItem = useCallback((product: CategoryItem, notes: string = '') => {
    setLines((prev) => {
      // Same product + same notes merge into one line
      const idx = prev.findIndex((l) => l.product_id === product.id && l.notes === notes)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [
        ...prev,
        { product_id: product.id, name: product.name, price: product.price, quantity: 1, notes },
      ]
    })
  }, [])

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0)
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0)

  return { lines, addItem, removeLine, clear, totalItems, subtotal }
}
