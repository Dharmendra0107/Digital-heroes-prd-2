import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Design, Order, PrintFile, Proof, Profile } from '@/types'

export type DemoOrder = Order & {
  customer?: Pick<Profile, 'email' | 'full_name' | 'company'>
}

export interface DemoStore {
  orders: DemoOrder[]
  designs: Design[]
  proofs: Proof[]
  printFiles: PrintFile[]
}

const STORE_PATH = path.join(process.cwd(), '.demo-data.json')

function emptyStore(): DemoStore {
  return { orders: [], designs: [], proofs: [], printFiles: [] }
}

export function readDemoStore(): DemoStore {
  if (!existsSync(STORE_PATH)) return emptyStore()

  const parsed: unknown = JSON.parse(readFileSync(STORE_PATH, 'utf8'))
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Local demo data file has an invalid format')
  }

  const data = parsed as Partial<DemoStore>
  return {
    orders: Array.isArray(data.orders) ? data.orders : [],
    designs: Array.isArray(data.designs) ? data.designs : [],
    proofs: Array.isArray(data.proofs) ? data.proofs : [],
    printFiles: Array.isArray(data.printFiles) ? data.printFiles : [],
  }
}

export function updateDemoStore<T>(update: (store: DemoStore) => T): T {
  const store = readDemoStore()
  const result = update(store)
  const temporaryPath = `${STORE_PATH}.${process.pid}.tmp`
  writeFileSync(temporaryPath, JSON.stringify(store), { encoding: 'utf8', mode: 0o600 })
  renameSync(temporaryPath, STORE_PATH)
  return result
}

export function getDemoOrder(orderId: string) {
  return readDemoStore().orders.find((order) => order.id === orderId) ?? null
}
