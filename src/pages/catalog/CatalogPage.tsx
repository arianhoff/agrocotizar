import { useState, useRef } from 'react'
import { Trash2, Plus, Pencil, Check, X, TrendingUp, Package, Loader2, FileImage, CreditCard, Upload, RefreshCw } from 'lucide-react'
import { useCatalogStore, type CsvRow } from '@/store/catalogStore'
import { dataSyncBus } from '@/App'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, Button, Badge, FieldGroup, Label, Input, Select } from '@/components/ui'
import {
  extractCatalogFromFile, extractPaymentConditionsFromFile, diffCatalog, readFileAsBase64,
  type CatalogDiff, type ProductDiff, type OptionDiff, type ExtractionProgress,
  type ExtractedPaymentCondition,
} from '@/lib/ai/catalogExtraction'
import { fmt } from '@/utils'
import type { PriceList, Product, ProductOption, ProductCategory, PaymentConditionTemplate, PaymentMode } from '@/types'

const UPLOAD_STEPS = ['Leyendo archivo...', 'Enviando a IA...', 'Comparando con lista actual...']

const CATEGORIES: ProductCategory[] = [
  'Mixer / Unifeed', 'Tolva', 'Embolsadora', 'Implemento varios',
  'Tractor', 'Cosechadora', 'Sembradora', 'Pulverizadora',
  'Repuesto / Accesorio', 'Servicio / Mano de obra',
]

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase().split(/[,;|\t]/).map(h => h.trim())
  const idx = (key: string) => header.findIndex(h => h.includes(key))
  const iCode = idx('cod'), iName = idx('nom'), iCat = idx('cat'), iPrice = idx('prec'), iCur = idx('mon')

  return lines.slice(1).flatMap(line => {
    const cols = line.split(/[,;|\t]/).map(c => c.trim().replace(/^"|"$/g, ''))
    const code = cols[iCode >= 0 ? iCode : 0]
    const name = cols[iName >= 0 ? iName : 1]
    const price = parseFloat((cols[iPrice >= 0 ? iPrice : 3] ?? '0').replace(/\./g, '').replace(',', '.'))
    if (!code || !name || isNaN(price)) return []
    return [{
      code,
      name,
      category: (cols[iCat >= 0 ? iCat : 2] as ProductCategory) || 'Implemento varios',
      price,
      currency: (cols[iCur >= 0 ? iCur : 4]?.toUpperCase() === 'ARS' ? 'ARS' : 'USD') as 'USD' | 'ARS',
      description: cols[5] ?? undefined,
    }]
  })
}

// ─── New Price List Modal ─────────────────────────────────────────────────────
function NewPriceListModal({ onClose }: { onClose: () => void }) {
  const { addPriceList, setActivePriceListId } = useCatalogStore()
  const [form, setForm] = useState({
    brand: '', name: '', currency: 'USD' as 'USD' | 'ARS',
    valid_from: new Date().toISOString().slice(0, 10),
    iva_included: true, iva_rate: 10.5,
  })

  function handleCreate() {
    if (!form.brand || !form.name) return
    const pl = addPriceList({
      tenant_id: '*', is_active: true,
      brand: form.brand, name: form.name, currency: form.currency,
      valid_from: form.valid_from, iva_included: form.iva_included, iva_rate: form.iva_rate,
    })
    setActivePriceListId(pl.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-5">Nueva lista de precios</div>
        <FieldGroup>
          <Label>Marca / Fabricante</Label>
          <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Ej: GEA, John Deere, Case..." />
        </FieldGroup>
        <FieldGroup>
          <Label>Nombre de la lista</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Lista Enero 2026" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>Moneda</Label>
            <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as 'USD' | 'ARS' }))}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label>Vigencia desde</Label>
            <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
          </FieldGroup>
        </div>
        <div className="flex gap-3 mt-4">
          <Button variant="primary" className="flex-1" onClick={handleCreate}>Crear lista</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Price Adjustment Modal ───────────────────────────────────────────────────
function PriceAdjustModal({ priceListId, onClose }: { priceListId: string; onClose: () => void }) {
  const { applyPriceAdjustment, importCSV, getProductsByList, updateProduct } = useCatalogStore()
  const [tab, setTab] = useState<'general' | 'individual' | 'csv'>('general')

  // General tab
  const [pct, setPct] = useState(0)

  // Individual tab — map productId → new price (string for input control)
  const products = getProductsByList(priceListId)
  const [prices, setPrices] = useState<Record<string, string>>(
    () => Object.fromEntries(products.map(p => [p.id, String(p.base_price)]))
  )

  // CSV tab
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<CsvRow[]>([])
  const csvFileRef = useRef<HTMLInputElement>(null)

  // ── General ──────────────────────────────────────────────────────────────────
  function handleGeneralApply() {
    if (pct === 0) return
    applyPriceAdjustment(priceListId, pct)
    onClose()
  }

  // ── Individual ───────────────────────────────────────────────────────────────
  function applyPctToAll(p: number) {
    if (p === 0) return
    setPrices(prev =>
      Object.fromEntries(
        products.map(prod => [
          prod.id,
          String(Math.round(prod.base_price * (1 + p / 100))),
        ])
      )
    )
  }

  function handleIndividualApply() {
    for (const prod of products) {
      const newPrice = parseFloat(prices[prod.id] ?? '')
      if (!isNaN(newPrice) && newPrice !== prod.base_price) {
        updateProduct(prod.id, { base_price: newPrice })
      }
    }
    onClose()
  }

  const changedCount = products.filter(p => {
    const v = parseFloat(prices[p.id] ?? '')
    return !isNaN(v) && v !== p.base_price
  }).length

  // ── CSV ──────────────────────────────────────────────────────────────────────
  function handleCSVImport() {
    if (preview.length === 0) return
    importCSV(priceListId, preview)
    onClose()
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => {
      const text = (ev.target?.result as string) ?? ''
      setCsvText(text)
      const parsed = parseCSV(text)
      setPreview(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const TABS = [
    { key: 'general' as const, label: 'General' },
    { key: 'individual' as const, label: 'Individual' },
    { key: 'csv' as const, label: 'Importar CSV' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border border-[#E2E8F0] rounded-xl shadow-xl w-full flex flex-col"
        style={{ maxWidth: tab === 'individual' ? '680px' : '520px', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-0 shrink-0">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-4">Actualizar precios</div>
          <div className="flex gap-1 border-b border-[#E2E8F0]">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-[11px] font-medium transition-colors cursor-pointer border-b-2 -mb-px ${tab === t.key ? 'text-[#22C55E] border-[#22C55E]' : 'text-[#64748B] border-transparent hover:text-[#0F172A]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── GENERAL ── */}
          {tab === 'general' && (
            <div>
              <p className="text-[12px] text-[#64748B] mb-4">
                Aplica el mismo porcentaje a los {products.length} productos de esta lista.
              </p>
              <FieldGroup>
                <Label>Porcentaje de ajuste</Label>
                <div className="flex items-center gap-3">
                  <Input type="number" value={pct} onChange={e => setPct(Number(e.target.value))}
                    step={0.5} className="w-32" />
                  <span className="text-[#64748B]">%</span>
                  <span className={`text-[12px] font-medium ${pct > 0 ? 'text-[#22C55E]' : pct < 0 ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                    {pct > 0 ? `+${pct}% aumento` : pct < 0 ? `${pct}% descuento` : 'sin cambio'}
                  </span>
                </div>
              </FieldGroup>
            </div>
          )}

          {/* ── INDIVIDUAL ── */}
          {tab === 'individual' && (
            <div>
              {/* Quick % apply row */}
              <div className="flex items-center gap-2 mb-4 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <span className="text-[11px] text-[#64748B] shrink-0 font-medium">Aplicar % a todos:</span>
                <QuickPctInput onApply={applyPctToAll} />
              </div>

              {/* Product table */}
              <div className="grid text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] px-2 mb-1"
                style={{ gridTemplateColumns: '90px 1fr 120px 120px 70px' }}>
                <span>Código</span><span>Nombre</span>
                <span className="text-right">Precio actual</span>
                <span className="text-right">Precio nuevo</span>
                <span className="text-right">Variación</span>
              </div>

              <div className="space-y-px">
                {products.map(p => {
                  const newVal = parseFloat(prices[p.id] ?? '')
                  const valid = !isNaN(newVal) && newVal > 0
                  const changed = valid && newVal !== p.base_price
                  const delta = valid ? ((newVal - p.base_price) / p.base_price) * 100 : 0

                  return (
                    <div key={p.id}
                      className={`grid gap-2 items-center px-2 py-1.5 rounded-lg transition-colors ${changed ? 'bg-[#F0FDF4] border border-[#22C55E]/20' : 'hover:bg-[#F8FAFC]'}`}
                      style={{ gridTemplateColumns: '90px 1fr 120px 120px 70px' }}>
                      <span className="font-mono text-[11px] text-[#64748B] truncate">{p.code}</span>
                      <span className="text-sm text-[#0F172A] truncate">{p.name}</span>
                      <span className="text-[12px] text-[#64748B] text-right">
                        {p.currency} {p.base_price.toLocaleString('es-AR')}
                      </span>
                      <input
                        type="number"
                        value={prices[p.id] ?? ''}
                        onChange={e => setPrices(prev => ({ ...prev, [p.id]: e.target.value }))}
                        min={0}
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-[12px] px-2 py-1 outline-none focus:border-[#22C55E] text-right"
                      />
                      <span className={`text-[11px] text-right font-medium ${delta > 0 ? 'text-[#22C55E]' : delta < 0 ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                        {changed ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── CSV ── */}
          {tab === 'csv' && (
            <div>
              <p className="text-[12px] text-[#64748B] mb-3">
                Columnas: <span className="text-[#22C55E] font-medium">código, nombre, categoría, precio, moneda</span><br />
                <span className="text-[#94A3B8]">Separadores: coma, punto y coma o tab · Primera fila = encabezado · Reemplaza todos los productos actuales</span>
              </p>

              {/* File upload button */}
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleCSVFile}
              />
              <button
                onClick={() => csvFileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 mb-3 rounded-lg border-2 border-dashed border-[#E2E8F0] text-[#64748B] text-[12px] font-medium hover:border-[#22C55E]/50 hover:text-[#22C55E] hover:bg-[#F0FDF4]/50 transition-colors cursor-pointer"
              >
                <Upload size={14} />
                Cargar archivo CSV (cualquier tamaño)
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest">o pegá el texto</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              <textarea
                value={csvText}
                onChange={e => { setCsvText(e.target.value); setPreview([]) }}
                rows={5}
                placeholder={'codigo,nombre,categoria,precio,moneda\nMGV110F,Mixer vertical 110F,Mixer / Unifeed,29000,USD'}
                className="w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-[12px] px-3 py-2 outline-none focus:border-[#22C55E] placeholder:text-[#94A3B8] resize-none mb-3 font-mono"
              />

              {preview.length > 0 && (
                <div className="mb-3 p-3 bg-[#F0FDF4] border border-[#22C55E]/30 rounded-lg">
                  <div className="text-[11px] text-[#22C55E] font-semibold mb-2">
                    ✓ {preview.length} productos listos para importar
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {preview.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-[#64748B] font-mono">
                        <span className="truncate max-w-[60%]">[{r.code}] {r.name}</span>
                        <span>{r.currency} {r.price.toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                    {preview.length > 5 && <div className="text-[11px] text-[#94A3B8]">...y {preview.length - 5} más</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-3 shrink-0">
          {tab === 'general' && (
            <Button variant="primary" className="flex-1" onClick={handleGeneralApply} disabled={pct === 0}>
              Aplicar a {products.length} productos
            </Button>
          )}
          {tab === 'individual' && (
            <Button variant="primary" className="flex-1" onClick={handleIndividualApply} disabled={changedCount === 0}>
              Guardar {changedCount} cambio{changedCount !== 1 ? 's' : ''}
            </Button>
          )}
          {tab === 'csv' && (
            preview.length === 0
              ? <Button variant="secondary" className="flex-1" onClick={() => setPreview(parseCSV(csvText))} disabled={!csvText.trim()}>Previsualizar</Button>
              : <Button variant="primary" className="flex-1" onClick={handleCSVImport}>Importar {preview.length} productos</Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// Small helper: % input + apply button used inside the individual tab
function QuickPctInput({ onApply }: { onApply: (pct: number) => void }) {
  const [val, setVal] = useState(0)
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={val}
        onChange={e => setVal(Number(e.target.value))}
        step={0.5}
        className="w-20 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-[12px] px-2 py-1 outline-none focus:border-[#22C55E] text-center font-mono"
      />
      <span className="text-[12px] text-[#64748B]">%</span>
      <button
        onClick={() => onApply(val)}
        disabled={val === 0}
        className="px-3 py-1 text-[11px] font-medium rounded-lg border border-[#22C55E]/40 text-[#22C55E] hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Aplicar
      </button>
      <span className={`text-[11px] font-medium ${val > 0 ? 'text-[#22C55E]' : val < 0 ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
        {val > 0 ? `+${val}%` : val < 0 ? `${val}%` : ''}
      </span>
    </div>
  )
}

// ─── Machine row (main product) ───────────────────────────────────────────────
function MachineRow({ product }: { product: Product }) {
  const { updateProduct, deleteProduct } = useCatalogStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(product)

  function save() { updateProduct(product.id, draft); setEditing(false) }
  function cancel() { setDraft(product); setEditing(false) }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] group hover:bg-[#F1F5F9] transition-colors">
        <span className="font-mono text-[11px] text-[#94A3B8] w-24 shrink-0">{product.code}</span>
        <span className="text-sm font-semibold text-[#0F172A] flex-1 truncate">{product.name}</span>
        <span className="text-[13px] text-[#22C55E] font-bold shrink-0">
          {product.currency} {fmt(product.base_price)}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)} className="p-1 rounded text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 cursor-pointer transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={() => deleteProduct(product.id)} className="p-1 rounded text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 cursor-pointer transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border-b border-[#22C55E]/20 bg-[#F0FDF4]">
      <div className="flex items-center gap-2 px-4 py-2" style={{ minWidth: '560px' }}>
        <Input value={draft.code} onChange={e => setDraft(d => ({ ...d, code: e.target.value }))} className="py-1 text-xs w-24 shrink-0" placeholder="Código" />
        <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className="py-1 text-xs flex-1" placeholder="Nombre" />
        <Select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value as ProductCategory }))} className="py-1 text-xs w-44 shrink-0">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </Select>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-[#64748B] font-medium">{draft.currency}</span>
          <Input type="number" value={draft.base_price} onChange={e => setDraft(d => ({ ...d, base_price: Number(e.target.value) }))} className="py-1 text-xs w-28" min={0} />
        </div>
        <button onClick={save} className="text-[#22C55E] hover:text-[#16A34A] cursor-pointer p-1"><Check size={14} /></button>
        <button onClick={cancel} className="text-[#94A3B8] hover:text-[#EF4444] cursor-pointer p-1"><X size={14} /></button>
      </div>
    </div>
  )
}

// ─── Option row (opcional nested under a machine) ─────────────────────────────
function OptionRow({ option, productId }: { option: ProductOption; productId: string }) {
  const { updateOptionPrice, deleteOption } = useCatalogStore()
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(String(option.price))

  function save() {
    const p = parseFloat(price)
    if (!isNaN(p) && p > 0) updateOptionPrice(productId, option.name, p)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 pl-10 pr-4 py-1.5 border-b border-[#F1F5F9] hover:bg-[#FAFAFA] group transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1] shrink-0" />
      <span className="text-[12px] text-[#475569] flex-1 truncate">{option.name}</span>
      {option.requires_commission === false && (
        <span className="text-[10px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded shrink-0">s/comisión</span>
      )}
      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-[#64748B]">{option.currency}</span>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="w-24 border border-[#22C55E] rounded px-2 py-0.5 text-xs text-right outline-none" />
          <button onClick={save} className="text-[#22C55E] cursor-pointer p-0.5"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="text-[#94A3B8] cursor-pointer p-0.5"><X size={12} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[12px] text-[#22C55E] font-medium">{option.currency} {fmt(option.price)}</span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
            <button onClick={() => setEditing(true)} className="p-1 rounded text-[#CBD5E1] hover:text-[#3B82F6] cursor-pointer"><Pencil size={11} /></button>
            <button onClick={() => deleteOption(productId, option.id)} className="p-1 rounded text-[#CBD5E1] hover:text-[#EF4444] cursor-pointer"><Trash2 size={11} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add option inline ────────────────────────────────────────────────────────
function AddOptionRow({ productId, currency }: { productId: string; currency: 'USD' | 'ARS' }) {
  const { addOption } = useCatalogStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', price: 0 })

  function handleAdd() {
    if (!form.name || form.price <= 0) return
    addOption(productId, { name: form.name, price: form.price, currency, requires_commission: true })
    setForm({ name: '', price: 0 })
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="pl-10 pr-4 py-1.5 border-b border-[#F1F5F9]">
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[11px] text-[#CBD5E1] hover:text-[#22C55E] transition-colors cursor-pointer">
          <Plus size={11} /> Agregar opcional
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 pl-10 pr-4 py-1.5 border-b border-[#22C55E]/20 bg-[#F0FDF4]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]/40 shrink-0" />
      <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del opcional" className="py-0.5 text-xs flex-1" autoFocus />
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[11px] text-[#64748B]">{currency}</span>
        <Input type="number" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="py-0.5 text-xs w-24" min={0} placeholder="Precio" />
      </div>
      <button onClick={handleAdd} disabled={!form.name || form.price <= 0} className="text-[#22C55E] disabled:opacity-40 cursor-pointer p-0.5"><Check size={13} /></button>
      <button onClick={() => setOpen(false)} className="text-[#94A3B8] cursor-pointer p-0.5"><X size={13} /></button>
    </div>
  )
}

// ─── Add machine row ──────────────────────────────────────────────────────────
function AddMachineRow({ priceListId }: { priceListId: string }) {
  const { addProduct, priceLists } = useCatalogStore()
  const pl = priceLists.find(p => p.id === priceListId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', category: 'Implemento varios' as ProductCategory, base_price: 0 })

  function handleAdd() {
    if (!form.code || !form.name) return
    addProduct({ ...form, price_list_id: priceListId, currency: pl?.currency ?? 'USD' })
    setForm({ code: '', name: '', category: 'Implemento varios', base_price: 0 })
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="p-4 border-t border-[#E2E8F0]">
        <Button variant="add" onClick={() => setOpen(true)}>
          <Plus size={12} className="inline mr-1" /> Agregar máquina / producto
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border-t border-[#22C55E]/20 bg-[#F0FDF4]">
      <div className="flex items-center gap-2 px-4 py-3" style={{ minWidth: '560px' }}>
        <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="Código" className="py-1 text-xs w-24 shrink-0" autoFocus />
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre de la máquina / producto" className="py-1 text-xs flex-1" />
        <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ProductCategory }))} className="py-1 text-xs w-44 shrink-0">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </Select>
        <Input type="number" value={form.base_price || ''} onChange={e => setForm(f => ({ ...f, base_price: Number(e.target.value) }))} className="py-1 text-xs w-28 shrink-0" min={0} placeholder="Precio" />
        <button onClick={handleAdd} className="text-[#22C55E] hover:text-[#16A34A] cursor-pointer p-1"><Check size={14} /></button>
        <button onClick={() => setOpen(false)} className="text-[#94A3B8] hover:text-[#EF4444] cursor-pointer p-1"><X size={14} /></button>
      </div>
    </div>
  )
}

// ─── Price List Edit Modal ────────────────────────────────────────────────────
function EditPriceListModal({ pl, onClose }: { pl: PriceList; onClose: () => void }) {
  const { updatePriceList } = useCatalogStore()
  const [form, setForm] = useState({
    brand: pl.brand,
    name:  pl.name,
    currency: pl.currency,
    valid_from: pl.valid_from,
    iva_included: pl.iva_included,
    iva_rate: pl.iva_rate,
  })

  const handleSave = () => {
    updatePriceList(pl.id, form)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8]">Editar lista de precios</div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"><X size={16} /></button>
        </div>
        <FieldGroup>
          <Label>Marca / Fabricante</Label>
          <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Ej: Agromec, John Deere..." />
        </FieldGroup>
        <FieldGroup>
          <Label>Nombre de la lista</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Lista Enero 2026" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>Moneda</Label>
            <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as 'USD' | 'ARS' }))}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label>Vigencia desde</Label>
            <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
          </FieldGroup>
        </div>
        <div className="flex gap-3 mt-4">
          <Button variant="primary" className="flex-1" onClick={handleSave}>Guardar cambios</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Price List Card ──────────────────────────────────────────────────────────
function PriceListCard({ pl, active, onClick }: { pl: PriceList; active: boolean; onClick: () => void }) {
  const { getProductsByList, deletePriceList, updatePriceList } = useCatalogStore()
  const [showEdit, setShowEdit] = useState(false)
  const count = getProductsByList(pl.id).length

  return (
    <>
      {showEdit && <EditPriceListModal pl={pl} onClose={() => setShowEdit(false)} />}
      <div onClick={onClick}
        className={`p-4 rounded-xl border cursor-pointer transition-all ${active ? 'border-[#22C55E] bg-[#F0FDF4]' : 'border-[#E2E8F0] bg-white hover:border-[#22C55E]/40'}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-[#94A3B8] font-semibold tracking-wider uppercase truncate">{pl.brand}</div>
            <div className="text-sm text-[#0F172A] font-semibold mt-0.5 truncate">{pl.name}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={e => { e.stopPropagation(); updatePriceList(pl.id, { is_active: !pl.is_active }) }}
              className={`w-2 h-2 rounded-full transition-colors ${pl.is_active ? 'bg-[#22C55E]' : 'bg-[#CBD5E1]'}`}
              title={pl.is_active ? 'Activa' : 'Inactiva'} />
            <button onClick={e => { e.stopPropagation(); setShowEdit(true) }}
              className="text-[#CBD5E1] hover:text-[#3B82F6] transition-colors ml-1 cursor-pointer"
              title="Editar lista">
              <Pencil size={11} />
            </button>
            <button onClick={e => { e.stopPropagation(); if (confirm(`¿Eliminar "${pl.name}"?`)) deletePriceList(pl.id) }}
              className="text-[#CBD5E1] hover:text-[#EF4444] transition-colors cursor-pointer"
              title="Eliminar lista">
              <Trash2 size={11} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Badge variant={pl.currency === 'USD' ? 'trigo' : 'verde'}>{pl.currency}</Badge>
          <span className="text-[11px] text-[#64748B]">{count} productos</span>
          <span className="text-[11px] text-[#64748B] ml-auto">{pl.valid_from.slice(0, 7)}</span>
        </div>
      </div>
    </>
  )
}

// ─── AI Diff Modal ────────────────────────────────────────────────────────────

type DiffKey = string
const keyP = (d: ProductDiff) => `p:${d.extracted.code}`
const keyO = (d: OptionDiff)  => `o:${d.extracted.product_code}:${d.extracted.name}`

// iOS-style toggle
function Toggle({ checked, onChange, color = 'green' }: { checked: boolean; onChange: () => void; color?: 'green' | 'amber' }) {
  const bg = checked
    ? color === 'green' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
    : 'bg-[#CBD5E1]'
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${bg}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function DiffModal({
  diff, onApply, onClose,
}: {
  diff: CatalogDiff
  onApply: (pDiffs: ProductDiff[], oDiffs: OptionDiff[]) => void
  onClose: () => void
}) {
  const { productDiffs, optionDiffs } = diff

  const [selected, setSelected] = useState<Set<DiffKey>>(() => {
    const s = new Set<DiffKey>()
    productDiffs.filter(d => d.status !== 'unchanged').forEach(d => s.add(keyP(d)))
    optionDiffs.filter(d => d.status !== 'unchanged').forEach(d => s.add(keyO(d)))
    return s
  })

  const toggle = (key: DiffKey) =>
    setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  const toggleAll = (keys: DiffKey[]) => {
    const allOn = keys.every(k => selected.has(k))
    setSelected(s => { const n = new Set(s); keys.forEach(k => allOn ? n.delete(k) : n.add(k)); return n })
  }

  function handleApply() {
    onApply(
      productDiffs.filter(d => selected.has(keyP(d))),
      optionDiffs.filter(d => selected.has(keyO(d))),
    )
  }

  const optionsByCode = optionDiffs.reduce<Record<string, OptionDiff[]>>((acc, d) => {
    const code = d.extracted.product_code.toLowerCase()
    ;(acc[code] ??= []).push(d)
    return acc
  }, {})

  const knownCodes = new Set(productDiffs.map(d => d.extracted.code.toLowerCase()))
  const orphanOptions = optionDiffs.filter(d => !knownCodes.has(d.extracted.product_code.toLowerCase()))

  const byCategory = productDiffs.reduce<Record<string, ProductDiff[]>>((acc, d) => {
    ;(acc[d.extracted.category || 'Implemento varios'] ??= []).push(d)
    return acc
  }, {})

  const totalNew      = productDiffs.filter(d => d.status === 'new').length + optionDiffs.filter(d => d.status === 'new').length
  const totalUpdates  = productDiffs.filter(d => d.status === 'price_update').length + optionDiffs.filter(d => d.status === 'price_update').length
  const totalUnchanged = productDiffs.filter(d => d.status === 'unchanged').length + optionDiffs.filter(d => d.status === 'unchanged').length

  const selectableTotal = productDiffs.filter(d => d.status !== 'unchanged').length +
    optionDiffs.filter(d => d.status !== 'unchanged').length
  const allSelected = selected.size === selectableTotal && selectableTotal > 0

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="text-[15px] font-semibold text-[#0F172A]">Revisión de cambios</div>
              <div className="text-[12px] text-[#94A3B8] mt-0.5">Detectados por IA — activá los que querés importar</div>
            </div>
            <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer mt-0.5"><X size={18} /></button>
          </div>
          {/* Stats pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {totalNew > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#22C55E]/30 text-[11px] font-semibold text-[#16A34A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />{totalNew} nuevos
              </span>
            )}
            {totalUpdates > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFFBEB] border border-[#F59E0B]/30 text-[11px] font-semibold text-[#B45309]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />{totalUpdates} actualizaciones de precio
              </span>
            )}
            {totalUnchanged > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-medium text-[#94A3B8]">
                {totalUnchanged} sin cambios
              </span>
            )}
            {/* Select all toggle */}
            {selectableTotal > 0 && (
              <button
                onClick={() => toggleAll([
                  ...productDiffs.filter(d => d.status !== 'unchanged').map(keyP),
                  ...optionDiffs.filter(d => d.status !== 'unchanged').map(keyO),
                ])}
                className="ml-auto text-[11px] font-medium text-[#64748B] hover:text-[#22C55E] cursor-pointer transition-colors"
              >
                {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
            )}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid px-6 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] shrink-0"
          style={{ gridTemplateColumns: '36px 80px 1fr 160px 36px' }}>
          <span />
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#CBD5E1]">Código</span>
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#CBD5E1]">Nombre</span>
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#CBD5E1] text-right">Precio</span>
          <span />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {Object.keys(byCategory).sort().map(cat => (
            <div key={cat}>
              {/* Category header */}
              <div className="flex items-center gap-2 px-6 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] sticky top-0 z-10">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#64748B]">{cat}</span>
                <span className="text-[10px] text-[#CBD5E1]">· {byCategory[cat].length}</span>
              </div>

              {byCategory[cat].map(pd => {
                const pk = keyP(pd)
                const pChecked = selected.has(pk)
                const machineOptions = optionsByCode[pd.extracted.code.toLowerCase()] ?? []
                const actionableOptions = machineOptions.filter(o => o.status !== 'unchanged')
                const allKeys = [pk, ...actionableOptions.map(keyO)]
                const isUnchanged = pd.status === 'unchanged'

                return (
                  <div key={pk} className={`border-b border-[#F1F5F9] last:border-b-0 ${isUnchanged ? 'opacity-40' : ''}`}>
                    {/* Machine row */}
                    <div
                      className={`grid items-center px-6 py-3 transition-colors gap-3 ${
                        !isUnchanged && 'cursor-pointer hover:bg-[#F8FAFC]'
                      } ${pChecked && pd.status === 'new' ? 'bg-[#F0FDF4]/70' : pChecked && pd.status === 'price_update' ? 'bg-[#FFFBEB]/70' : ''}`}
                      style={{ gridTemplateColumns: '36px 80px 1fr 160px 36px' }}
                      onClick={() => !isUnchanged && toggle(pk)}
                    >
                      {/* Toggle */}
                      <div onClick={e => e.stopPropagation()}>
                        {!isUnchanged
                          ? <Toggle checked={pChecked} onChange={() => toggle(pk)} color={pd.status === 'new' ? 'green' : 'amber'} />
                          : <span className="w-9" />
                        }
                      </div>
                      {/* Code */}
                      <span className="font-mono text-[11px] text-[#94A3B8] truncate">{pd.extracted.code}</span>
                      {/* Name + badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-semibold text-[#0F172A] truncate">{pd.extracted.name}</span>
                        {pd.status === 'new' && (
                          <span className="shrink-0 text-[9px] font-bold tracking-wider text-[#16A34A] bg-[#DCFCE7] px-1.5 py-0.5 rounded-full">NUEVO</span>
                        )}
                        {pd.status === 'price_update' && (
                          <span className="shrink-0 text-[9px] font-bold tracking-wider text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">PRECIO</span>
                        )}
                      </div>
                      {/* Price */}
                      <div className="text-right">
                        {pd.status === 'price_update' ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] text-[#CBD5E1] line-through">{pd.extracted.currency} {pd.oldPrice?.toLocaleString('es-AR')}</span>
                            <span className="text-[13px] font-bold text-[#F59E0B]">{pd.extracted.currency} {pd.extracted.price.toLocaleString('es-AR')}</span>
                          </div>
                        ) : (
                          <span className="text-[13px] font-bold text-[#22C55E]">{pd.extracted.currency} {pd.extracted.price.toLocaleString('es-AR')}</span>
                        )}
                      </div>
                      {/* Sel. todo button for machine with options */}
                      <div className="flex justify-center">
                        {actionableOptions.length > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); toggleAll(allKeys) }}
                            title={allKeys.every(k => selected.has(k)) ? 'Deseleccionar todo' : 'Seleccionar con opcionales'}
                            className="text-[#CBD5E1] hover:text-[#22C55E] cursor-pointer transition-colors"
                          >
                            <Check size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Opcionales */}
                    {machineOptions.length > 0 && (
                      <div className="border-t border-[#F1F5F9]">
                        {machineOptions.map(od => {
                          const ok = keyO(od)
                          const oChecked = selected.has(ok)
                          const oUnchanged = od.status === 'unchanged'
                          return (
                            <div
                              key={ok}
                              className={`grid items-center px-6 py-2 gap-3 border-b border-[#F8FAFC] last:border-b-0 transition-colors ${
                                oUnchanged ? 'opacity-35' : 'cursor-pointer hover:bg-[#F8FAFC]'
                              } ${oChecked && od.status === 'new' ? 'bg-[#F0FDF4]/40' : oChecked && od.status === 'price_update' ? 'bg-[#FFFBEB]/40' : ''}`}
                              style={{ gridTemplateColumns: '36px 80px 1fr 160px 36px' }}
                              onClick={() => !oUnchanged && toggle(ok)}
                            >
                              {/* indent + toggle */}
                              <div className="flex items-center gap-2 pl-5" onClick={e => e.stopPropagation()}>
                                {!oUnchanged
                                  ? <Toggle checked={oChecked} onChange={() => toggle(ok)} color={od.status === 'new' ? 'green' : 'amber'} />
                                  : <span className="w-9" />
                                }
                              </div>
                              {/* code placeholder (dot) */}
                              <div className="flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1] ml-1" />
                              </div>
                              {/* name + badge */}
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[12px] text-[#475569] truncate">{od.extracted.name}</span>
                                {od.status === 'new' && (
                                  <span className="shrink-0 text-[9px] font-bold tracking-wider text-[#16A34A] bg-[#DCFCE7] px-1.5 py-0.5 rounded-full">NUEVO</span>
                                )}
                                {od.status === 'price_update' && (
                                  <span className="shrink-0 text-[9px] font-bold tracking-wider text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">PRECIO</span>
                                )}
                              </div>
                              {/* price */}
                              <div className="text-right">
                                {od.status === 'price_update' ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-[10px] text-[#CBD5E1] line-through">{od.extracted.currency} {od.oldPrice?.toLocaleString('es-AR')}</span>
                                    <span className="text-[12px] font-semibold text-[#F59E0B]">{od.extracted.currency} {od.extracted.price.toLocaleString('es-AR')}</span>
                                  </div>
                                ) : (
                                  <span className="text-[12px] font-semibold text-[#22C55E]">{od.extracted.currency} {od.extracted.price.toLocaleString('es-AR')}</span>
                                )}
                              </div>
                              <span />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Orphaned options */}
          {orphanOptions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-6 py-2 bg-[#FFF7ED] border-y border-[#FED7AA]">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#92400E]">Sin máquina asignada</span>
                <span className="text-[10px] text-[#FCA5A5]">· {orphanOptions.length}</span>
              </div>
              {orphanOptions.map(od => {
                const ok = keyO(od)
                const oChecked = selected.has(ok)
                return (
                  <div
                    key={ok}
                    className="grid items-center px-6 py-2.5 gap-3 border-b border-[#F8FAFC] cursor-pointer hover:bg-[#FFF7ED]/50 transition-colors"
                    style={{ gridTemplateColumns: '36px 80px 1fr 160px 36px' }}
                    onClick={() => toggle(ok)}
                  >
                    <div onClick={e => e.stopPropagation()}>
                      <Toggle checked={oChecked} onChange={() => toggle(ok)} color="amber" />
                    </div>
                    <span className="font-mono text-[10px] text-[#F59E0B] truncate">{od.extracted.product_code}</span>
                    <span className="text-[12px] text-[#475569] truncate">{od.extracted.name}</span>
                    <span className="text-[12px] font-semibold text-[#F59E0B] text-right">{od.extracted.currency} {od.extracted.price.toLocaleString('es-AR')}</span>
                    <span />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0 bg-[#F8FAFC] rounded-b-2xl">
          <div>
            <span className="text-[13px] font-semibold text-[#0F172A]">{selected.size}</span>
            <span className="text-[12px] text-[#64748B]"> de {selectableTotal} cambio{selectableTotal !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={handleApply} disabled={selected.size === 0}>
              Aplicar {selected.size > 0 ? selected.size : ''} cambio{selected.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Payment Conditions Section ───────────────────────────────────────────────
const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  contado: 'Contado',
  cheques: 'Cheques',
  financiado: 'Financiado',
  leasing: 'Leasing',
}

function PaymentConditionsSection({ priceListId }: { priceListId: string }) {
  const { priceLists, addPaymentCondition, removePaymentCondition } = useCatalogStore()
  const pl = priceLists.find(p => p.id === priceListId)
  const conditions = pl?.payment_conditions ?? []
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<{ label: string; mode: PaymentMode; discount_pct: number; num_checks: number; deposit_pct: number; installments: number; monthly_rate: number }>({
    label: '', mode: 'contado', discount_pct: 20, num_checks: 3, deposit_pct: 30, installments: 12, monthly_rate: 0,
  })

  function handleAdd() {
    if (!form.label) return
    const condition = form.mode === 'contado'
      ? { mode: form.mode as PaymentMode, discount_pct: form.discount_pct }
      : form.mode === 'cheques'
      ? { mode: form.mode as PaymentMode, discount_pct: form.discount_pct, num_checks: form.num_checks }
      : form.mode === 'financiado'
      ? { mode: form.mode as PaymentMode, discount_pct: 0, deposit_pct: form.deposit_pct, installments: form.installments, monthly_rate: form.monthly_rate }
      : { mode: form.mode as PaymentMode, discount_pct: 0, deposit_pct: form.deposit_pct }
    addPaymentCondition(priceListId, { label: form.label, condition })
    setAdding(false)
    setForm({ label: '', mode: 'contado', discount_pct: 20, num_checks: 3, deposit_pct: 30, installments: 12, monthly_rate: 0 })
  }

  return (
    <div className="border-t border-[#E2E8F0] px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard size={14} className="text-[#94A3B8]" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#94A3B8]">Condiciones de pago</span>
          {conditions.length > 0 && (
            <span className="text-[10px] text-[#CBD5E1]">{conditions.length}</span>
          )}
        </div>
        <button
          onClick={() => setAdding(a => !a)}
          className="flex items-center gap-1.5 text-[11px] text-[#22C55E] hover:text-[#16A34A] cursor-pointer transition-colors"
        >
          <Plus size={12} /> Agregar
        </button>
      </div>

      {/* Existing conditions */}
      {conditions.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {conditions.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] group">
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-medium text-[#0F172A]">{t.label}</span>
                <span className="text-[11px] text-[#94A3B8] ml-2">
                  {PAYMENT_MODE_LABELS[t.condition.mode]}
                  {t.condition.discount_pct ? ` · ${t.condition.discount_pct}% desc.` : ''}
                  {t.condition.num_checks ? ` · ${t.condition.num_checks} cheques` : ''}
                  {t.condition.installments ? ` · ${t.condition.installments} cuotas` : ''}
                </span>
              </div>
              <button
                onClick={() => removePaymentCondition(priceListId, t.id)}
                className="text-[#CBD5E1] hover:text-[#EF4444] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#22C55E]/20 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre de la condición</Label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder='Ej: "Contado efectivo", "3 cheques 90 días"'
                className="text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label>Modalidad</Label>
              <Select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as PaymentMode }))}>
                <option value="contado">Contado</option>
                <option value="cheques">Cheques diferidos</option>
                <option value="financiado">Financiado</option>
                <option value="leasing">Leasing</option>
              </Select>
            </div>
            {(form.mode === 'contado' || form.mode === 'cheques') && (
              <div>
                <Label>Descuento %</Label>
                <Input type="number" value={form.discount_pct} min={0} max={100} step={0.5}
                  onChange={e => setForm(f => ({ ...f, discount_pct: Number(e.target.value) }))} />
              </div>
            )}
            {form.mode === 'cheques' && (
              <div>
                <Label>Cantidad de cheques</Label>
                <Input type="number" value={form.num_checks} min={1} max={24}
                  onChange={e => setForm(f => ({ ...f, num_checks: Number(e.target.value) }))} />
              </div>
            )}
            {(form.mode === 'financiado' || form.mode === 'leasing') && (
              <>
                <div>
                  <Label>Anticipo %</Label>
                  <Input type="number" value={form.deposit_pct} min={0} max={100} step={5}
                    onChange={e => setForm(f => ({ ...f, deposit_pct: Number(e.target.value) }))} />
                </div>
                {form.mode === 'financiado' && (
                  <>
                    <div>
                      <Label>Cuotas</Label>
                      <Select value={form.installments} onChange={e => setForm(f => ({ ...f, installments: Number(e.target.value) }))}>
                        {[3, 6, 12, 18, 24, 36, 48, 60].map(n => <option key={n} value={n}>{n}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>Tasa mensual %</Label>
                      <Input type="number" value={form.monthly_rate} min={0} step={0.1}
                        onChange={e => setForm(f => ({ ...f, monthly_rate: Number(e.target.value) }))} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleAdd} disabled={!form.label}>Guardar condición</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {conditions.length === 0 && !adding && (
        <p className="text-[11px] text-[#94A3B8]">
          Sin condiciones — agregá las condiciones de pago de esta lista para pre-cargarlas al cotizar.
        </p>
      )}
    </div>
  )
}

// ─── Payment Conditions Import Review ────────────────────────────────────────

const PC_MODE_META: Record<string, { icon: string; color: string; bg: string }> = {
  contado:    { icon: '💵', color: 'text-[#16A34A]', bg: 'bg-[#F0FDF4] border-[#22C55E]/30' },
  cheques:    { icon: '🧾', color: 'text-[#92400E]', bg: 'bg-[#FFFBEB] border-[#F59E0B]/30' },
  financiado: { icon: '🏦', color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF] border-[#93C5FD]/50' },
  leasing:    { icon: '📋', color: 'text-[#6D28D9]', bg: 'bg-[#F5F3FF] border-[#C4B5FD]/50' },
}

function PaymentConditionsImportReview({
  conditions,
  existingCount,
  onApply,
  onCancel,
}: {
  conditions: ExtractedPaymentCondition[]
  existingCount: number
  onApply: (selected: ExtractedPaymentCondition[]) => void
  onCancel: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(conditions.map((_, i) => i)))

  const toggle = (i: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })

  return (
    <div className="mx-6 mt-4 rounded-xl border border-[#8B5CF6]/30 bg-[#F5F3FF] overflow-hidden">
      <div className="px-5 py-3 bg-[#EDE9FE] border-b border-[#8B5CF6]/20 flex items-center gap-2">
        <CreditCard size={14} className="text-[#7C3AED]" />
        <span className="text-[12px] font-semibold text-[#6D28D9]">
          {conditions.length} condición{conditions.length !== 1 ? 'es' : ''} detectada{conditions.length !== 1 ? 's' : ''} — revisá y confirmá
        </span>
        {existingCount > 0 && (
          <span className="ml-auto text-[11px] text-[#7C3AED] bg-[#DDD6FE] px-2 py-0.5 rounded-full">
            Se agregarán a las {existingCount} existentes
          </span>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {conditions.map((pc, i) => {
          const meta = PC_MODE_META[pc.mode] ?? PC_MODE_META.contado
          const isSelected = selected.has(i)
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#8B5CF6] bg-white shadow-sm'
                  : 'border-[#DDD6FE] bg-[#F5F3FF] opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 border ${meta.bg}`}>
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#0F172A] truncate">{pc.label}</div>
                  <div className={`text-[11px] font-medium capitalize mt-0.5 ${meta.color}`}>
                    {pc.mode}
                    {pc.discount_pct   ? ` · ${pc.discount_pct}% desc.`    : ''}
                    {pc.num_checks     ? ` · ${pc.num_checks} cheques`      : ''}
                    {pc.installments   ? ` · ${pc.installments} cuotas`     : ''}
                    {pc.lease_term_months ? ` · ${pc.lease_term_months} meses` : ''}
                  </div>
                </div>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'bg-[#7C3AED] border-[#7C3AED]' : 'border-[#C4B5FD]'
                }`}>
                  {isSelected && <Check size={10} className="text-white" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-5 pb-4 flex items-center gap-3">
        <button
          onClick={() => onApply(conditions.filter((_, i) => selected.has(i)))}
          disabled={selected.size === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-[12px] font-semibold hover:bg-[#6D28D9] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={13} />
          Agregar {selected.size} condición{selected.size !== 1 ? 'es' : ''}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-white/60 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CatalogPage() {
  const { priceLists, activePriceListId, setActivePriceListId, getProductsByList, addProduct, updateProduct, addOption, updateOptionPrice, options: storeOptions, addPaymentCondition } = useCatalogStore()
  const [showNewModal, setShowNewModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [diff, setDiff] = useState<{ catalog: CatalogDiff; paymentConditions: ExtractedPaymentCondition[] } | null>(null)
  const [uploadStep, setUploadStep] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [streamingProgress, setStreamingProgress] = useState<ExtractionProgress | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Payment-conditions-only upload ──
  const [pcUploading, setPcUploading] = useState(false)
  const [pcError, setPcError] = useState<string | null>(null)
  const [pendingPaymentConditions, setPendingPaymentConditions] = useState<ExtractedPaymentCondition[] | null>(null)
  const pcFileInputRef = useRef<HTMLInputElement>(null)

  const uploading = uploadStep !== null

  const activeList = priceLists.find(pl => pl.id === activePriceListId) ?? priceLists[0] ?? null
  const products = activeList ? getProductsByList(activeList.id) : []

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeList) return
    e.target.value = ''

    // Hard limit: > 50 MB no tiene sentido — la API de Anthropic no acepta más de ~32 MB
    const HARD_LIMIT_MB = 50
    const fileSizeMB = file.size / 1024 / 1024
    if (fileSizeMB > HARD_LIMIT_MB) {
      setUploadError(`El archivo es demasiado grande (${fileSizeMB.toFixed(1)} MB). El límite es ${HARD_LIMIT_MB} MB. Dividí el PDF en partes más pequeñas e importalas por separado.`)
      return
    }

    setUploadStep('Leyendo archivo...')
    setUploadError(null)
    try {
      const { base64, mediaType } = await readFileAsBase64(file)
      setUploadStep('Enviando a IA...')
      setStreamingProgress(null)
      const result = await extractCatalogFromFile(base64, mediaType, '', (progress) => {
        setStreamingProgress({ ...progress })
      })
      setStreamingProgress(null)
      setUploadStep('Comparando con lista actual...')
      // Build options lookup by productId for diffing
      const optionsByProductId: Record<string, { id: string; name: string; price: number }[]> = {}
      for (const p of products) {
        optionsByProductId[p.id] = (storeOptions[p.id] ?? []).map(o => ({ id: o.id, name: o.name, price: o.price }))
      }
      setDiff({ catalog: diffCatalog(result, products, optionsByProductId), paymentConditions: result.paymentConditions })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setUploadStep(null)
      setStreamingProgress(null)
    }
  }

  function handleApplyDiffs(selectedProducts: ProductDiff[], selectedOptions: OptionDiff[]) {
    if (!activeList) return

    // Apply product changes
    for (const d of selectedProducts) {
      if (d.status === 'new') {
        addProduct({
          price_list_id: activeList.id,
          code: d.extracted.code,
          name: d.extracted.name,
          category: d.extracted.category,
          base_price: d.extracted.price,
          currency: d.extracted.currency,
          description: d.extracted.description,
        })
      } else if (d.status === 'price_update') {
        const existing = products.find(p => p.code.toLowerCase() === d.extracted.code.toLowerCase())
        if (existing) updateProduct(existing.id, { base_price: d.extracted.price })
      }
    }

    // Apply option changes (re-fetch products after adds above via store)
    const allProducts = getProductsByList(activeList.id)
    for (const d of selectedOptions) {
      const targetProduct = allProducts.find(p => p.code.toLowerCase() === d.extracted.product_code.toLowerCase())
      if (!targetProduct) continue
      if (d.status === 'new') {
        addOption(targetProduct.id, {
          name: d.extracted.name,
          price: d.extracted.price,
          requires_commission: d.extracted.requires_commission,
        })
      } else if (d.status === 'price_update') {
        updateOptionPrice(targetProduct.id, d.extracted.name, d.extracted.price)
      }
    }

    // Save extracted payment conditions (only if list has none yet)
    if (diff && diff.paymentConditions.length > 0 && (activeList.payment_conditions ?? []).length === 0) {
      for (const pc of diff.paymentConditions) {
        addPaymentCondition(activeList.id, {
          label: pc.label,
          condition: {
            mode: pc.mode,
            discount_pct: pc.discount_pct ?? 0,
            num_checks: pc.num_checks,
            deposit_pct: pc.deposit_pct,
            installments: pc.installments,
            monthly_rate: pc.monthly_rate,
            lease_term_months: pc.lease_term_months,
            buyout_pct: pc.buyout_pct,
          },
        })
      }
    }

    setDiff(null)
  }

  async function handlePaymentConditionsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeList) return
    e.target.value = ''

    const fileSizeMB = file.size / 1024 / 1024
    if (fileSizeMB > 50) {
      setPcError(`Archivo demasiado grande (${fileSizeMB.toFixed(1)} MB). Máximo: 50 MB.`)
      return
    }

    setPcUploading(true)
    setPcError(null)
    setPendingPaymentConditions(null)
    try {
      const { base64, mediaType } = await readFileAsBase64(file)
      const conditions = await extractPaymentConditionsFromFile(base64, mediaType)
      if (conditions.length === 0) {
        setPcError('No se encontraron condiciones de pago en el archivo.')
      } else {
        setPendingPaymentConditions(conditions)
      }
    } catch (err) {
      setPcError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setPcUploading(false)
    }
  }

  function handleApplyPaymentConditions(selected: ExtractedPaymentCondition[]) {
    if (!activeList) return
    for (const pc of selected) {
      addPaymentCondition(activeList.id, {
        label: pc.label,
        condition: {
          mode: pc.mode,
          discount_pct: pc.discount_pct ?? 0,
          num_checks: pc.num_checks,
          deposit_pct: pc.deposit_pct,
          installments: pc.installments,
          monthly_rate: pc.monthly_rate,
          lease_term_months: pc.lease_term_months,
          buyout_pct: pc.buyout_pct,
        },
      })
    }
    setPendingPaymentConditions(null)
  }

  return (
    <>
      <PageHeader
        title="Lista de precios"
        subtitle={`${priceLists.length} lista${priceLists.length !== 1 ? 's' : ''} · ${priceLists.reduce((a, pl) => a + getProductsByList(pl.id).length, 0)} productos`}
        actions={
          <div className="hidden md:flex items-center gap-2">
            <Button variant="secondary" onClick={() => dataSyncBus.trigger()} title="Sincronizar con la nube">
              <RefreshCw size={12} className="inline mr-1" /> Sincronizar
            </Button>
            <Button variant="primary" onClick={() => setShowNewModal(true)}>
              <Plus size={12} className="inline mr-1" /> Nueva lista
            </Button>
          </div>
        }
      />

      {/* Mobile: price list selector */}
      <div className="md:hidden bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center gap-2">
        {priceLists.length === 0 ? (
          <span className="flex-1 text-[13px] text-[#94A3B8]">Sin listas de precios</span>
        ) : (
          <select
            value={activeList?.id ?? ''}
            onChange={e => setActivePriceListId(e.target.value)}
            className="flex-1 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-[13px] px-3 py-2 outline-none focus:border-[#22C55E] appearance-none"
          >
            {priceLists.map(pl => (
              <option key={pl.id} value={pl.id}>{pl.brand} — {pl.name} ({pl.currency})</option>
            ))}
          </select>
        )}
        <button
          onClick={() => dataSyncBus.trigger()}
          className="shrink-0 p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
          title="Sincronizar"
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={() => setShowNewModal(true)}
          className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg bg-[#22C55E] text-white text-[12px] font-medium cursor-pointer hover:bg-[#16A34A] transition-colors"
        >
          <Plus size={12} /> Nueva
        </button>
      </div>

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Sidebar: price lists — desktop only */}
        <aside className="hidden md:flex w-72 shrink-0 bg-white border-r border-[#E2E8F0] flex-col">
          <div className="px-5 py-3 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#94A3B8]">Listas de precios</span>
            <span className="text-[10px] text-[#CBD5E1]">{priceLists.length}</span>
          </div>
          <div className="flex-1 p-3 space-y-2">
            {priceLists.map(pl => (
              <PriceListCard key={pl.id} pl={pl} active={activeList?.id === pl.id} onClick={() => setActivePriceListId(pl.id)} />
            ))}
            {priceLists.length === 0 && (
              <div className="text-center py-12 text-[12px] text-[#94A3B8]">Sin listas — creá una</div>
            )}
          </div>
        </aside>

        {/* Main: products table */}
        <div className="flex-1 min-w-0 bg-[#F8FAFC]">
        <div className="p-3 sm:p-6">
          {!activeList ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Package size={32} className="text-[#CBD5E1]" />
              <p className="text-[13px] text-[#94A3B8]">Seleccioná o creá una lista de precios</p>
            </div>
          ) : (
            <Card className="p-0 overflow-hidden">
              {/* List header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#E2E8F0] flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[#94A3B8] font-semibold tracking-wider uppercase">{activeList.brand}</div>
                  <div className="text-base text-[#0F172A] font-semibold truncate">{activeList.name}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <input
                    ref={pcFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="hidden"
                    onChange={handlePaymentConditionsUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || pcUploading}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-lg border border-[#22C55E]/40 text-[#22C55E] hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {uploading
                      ? <><Loader2 size={12} className="animate-spin" /> <span className="hidden sm:inline">{uploadStep}</span><span className="sm:hidden">Cargando…</span></>
                      : <><FileImage size={12} /> <span className="hidden sm:inline">Importar lista</span><span className="sm:hidden">Lista</span></>
                    }
                  </button>
                  <button
                    onClick={() => pcFileInputRef.current?.click()}
                    disabled={uploading || pcUploading}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-lg border border-[#8B5CF6]/40 text-[#7C3AED] hover:bg-[#8B5CF6]/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {pcUploading
                      ? <><Loader2 size={12} className="animate-spin" /> <span className="hidden sm:inline">Analizando…</span></>
                      : <><CreditCard size={12} /> <span className="hidden sm:inline">Importar condiciones</span><span className="sm:hidden">Condiciones</span></>
                    }
                  </button>
                  <button
                    onClick={() => setShowAdjustModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <TrendingUp size={12} /> <span className="hidden sm:inline">Actualizar precios</span><span className="sm:hidden">Precios</span>
                  </button>
                </div>
              </div>

              {/* Upload progress */}
              {uploading && uploadStep && (
                <div className="mx-6 mt-4 rounded-xl border border-[#3B82F6]/30 bg-[#EFF6FF] px-5 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 size={16} className="animate-spin text-[#3B82F6] shrink-0" />
                    <span className="text-[13px] font-semibold text-[#1D4ED8]">{uploadStep}</span>
                  </div>
                  <div className="flex items-center gap-0">
                    {UPLOAD_STEPS.map((step, i) => {
                      const currentIdx = UPLOAD_STEPS.indexOf(uploadStep ?? '')
                      const done   = i < currentIdx
                      const active = i === currentIdx
                      return (
                        <div key={step} className="flex items-center flex-1 last:flex-none">
                          <div className={`w-3 h-3 rounded-full border-2 shrink-0 transition-all ${
                            done   ? 'bg-[#3B82F6] border-[#3B82F6]' :
                            active ? 'bg-white border-[#3B82F6] ring-2 ring-[#3B82F6]/30' :
                                     'bg-white border-[#BFDBFE]'
                          }`} />
                          {i < UPLOAD_STEPS.length - 1 && (
                            <div className={`h-px flex-1 transition-colors ${done ? 'bg-[#3B82F6]' : 'bg-[#BFDBFE]'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    {UPLOAD_STEPS.map((step, i) => {
                      const currentIdx = UPLOAD_STEPS.indexOf(uploadStep ?? '')
                      return (
                        <span key={step} className={`text-[10px] font-medium ${i <= currentIdx ? 'text-[#2563EB]' : 'text-[#93C5FD]'}`}>
                          {step.replace('...', '')}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Streaming live preview */}
              {uploading && streamingProgress && (streamingProgress.products.length > 0 || streamingProgress.options.length > 0) && (
                <div className="mx-6 mt-3 rounded-xl border border-[#3B82F6]/20 bg-white overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#EFF6FF] border-b border-[#BFDBFE] flex items-center gap-2">
                    <Loader2 size={11} className="animate-spin text-[#3B82F6] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#1D4ED8]">
                      Identificando… {streamingProgress.products.length} producto{streamingProgress.products.length !== 1 ? 's' : ''}
                      {streamingProgress.options.length > 0 && ` · ${streamingProgress.options.length} opcional${streamingProgress.options.length !== 1 ? 'es' : ''}`}
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {(() => {
                      const grouped = streamingProgress.products.reduce<Record<string, typeof streamingProgress.products>>(
                        (acc, p) => { (acc[p.category] ??= []).push(p); return acc }, {}
                      )
                      const optsByCode = streamingProgress.options.reduce<Record<string, typeof streamingProgress.options>>(
                        (acc, o) => { (acc[o.product_code] ??= []).push(o); return acc }, {}
                      )
                      return Object.keys(grouped).sort().map(cat => (
                        <div key={cat}>
                          <div className="px-4 py-1 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <span className="text-[9px] font-bold tracking-widest uppercase text-[#94A3B8]">{cat}</span>
                          </div>
                          {grouped[cat].map(p => (
                            <div key={p.code}>
                              <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[#F1F5F9]">
                                <span className="font-mono text-[10px] text-[#94A3B8] w-16 shrink-0 truncate">{p.code}</span>
                                <span className="text-[12px] text-[#0F172A] font-medium flex-1 truncate">{p.name}</span>
                                <span className="text-[11px] font-semibold text-[#3B82F6] shrink-0">{p.currency} {p.price.toLocaleString('es-AR')}</span>
                              </div>
                              {(optsByCode[p.code] ?? []).map((opt, i) => (
                                <div key={i} className="flex items-center gap-3 pl-10 pr-4 py-1 border-b border-[#F8FAFC] bg-[#FAFAFA]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1] shrink-0" />
                                  <span className="text-[11px] text-[#64748B] flex-1 truncate">{opt.name}</span>
                                  <span className="text-[10px] text-[#3B82F6] shrink-0">{opt.currency} {opt.price.toLocaleString('es-AR')}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))
                    })()}
                    {/* Orphaned options (no matching product yet) */}
                    {streamingProgress.options.filter(o => !streamingProgress.products.find(p => p.code === o.product_code)).map((o, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-1.5 border-b border-[#F1F5F9] bg-[#FFFBEB]">
                        <span className="font-mono text-[10px] text-[#F59E0B] w-16 shrink-0 truncate">{o.product_code}</span>
                        <span className="text-[11px] text-[#64748B] flex-1 truncate">{o.name}</span>
                        <span className="text-[10px] text-[#F59E0B] shrink-0">{o.currency} {o.price.toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload error */}
              {uploadError && (
                <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10">
                  <span className="text-[#EF4444] text-xs">✗</span>
                  <span className="text-[11px] text-[#EF4444] font-medium">{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="ml-auto text-[#EF4444]/60 hover:text-[#EF4444] cursor-pointer"><X size={12} /></button>
                </div>
              )}

              {/* Payment conditions upload: error */}
              {pcError && (
                <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10">
                  <span className="text-[#EF4444] text-xs">✗</span>
                  <span className="text-[11px] text-[#EF4444] font-medium">{pcError}</span>
                  <button onClick={() => setPcError(null)} className="ml-auto text-[#EF4444]/60 hover:text-[#EF4444] cursor-pointer"><X size={12} /></button>
                </div>
              )}

              {/* Payment conditions upload: review & confirm */}
              {pendingPaymentConditions && (
                <PaymentConditionsImportReview
                  conditions={pendingPaymentConditions}
                  existingCount={activeList?.payment_conditions?.length ?? 0}
                  onApply={handleApplyPaymentConditions}
                  onCancel={() => setPendingPaymentConditions(null)}
                />
              )}

              {/* Nested product list — grouped by category, each product with its opcionales */}
              {products.length === 0 ? (
                <div className="text-center py-12 text-[12px] text-[#94A3B8]">
                  Sin productos — importá desde PDF / Imagen o agregá manualmente
                </div>
              ) : (() => {
                const grouped = products.reduce<Record<string, typeof products>>((acc, p) => {
                  ;(acc[p.category] ??= []).push(p)
                  return acc
                }, {})
                return Object.keys(grouped).sort().map(cat => (
                  <div key={cat}>
                    {/* Category header */}
                    <div className="flex items-center gap-3 px-6 py-2 bg-[#F1F5F9] border-y border-[#E2E8F0] sticky top-0 z-10">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-[#64748B]">{cat}</span>
                      <span className="text-[10px] text-[#CBD5E1]">{grouped[cat].length}</span>
                      <div className="flex-1 h-px bg-[#E2E8F0]" />
                    </div>
                    {/* Machines in this category */}
                    {grouped[cat].map(p => (
                      <div key={p.id} className="border-b border-[#F1F5F9]">
                        <MachineRow product={p} />
                        {/* Options under this machine */}
                        {(storeOptions[p.id] ?? []).map(opt => (
                          <OptionRow key={opt.id} option={opt} productId={p.id} />
                        ))}
                        <AddOptionRow productId={p.id} currency={activeList.currency} />
                      </div>
                    ))}
                  </div>
                ))
              })()}

              <AddMachineRow priceListId={activeList.id} />
              <PaymentConditionsSection priceListId={activeList.id} />
            </Card>
          )}
        </div>
        </div>
      </div>

      {showNewModal && <NewPriceListModal onClose={() => setShowNewModal(false)} />}
      {showAdjustModal && activeList && (
        <PriceAdjustModal priceListId={activeList.id} onClose={() => setShowAdjustModal(false)} />
      )}
      {diff && (
        <DiffModal
          diff={diff.catalog}
          onApply={handleApplyDiffs}
          onClose={() => setDiff(null)}
        />
      )}
    </>
  )
}
