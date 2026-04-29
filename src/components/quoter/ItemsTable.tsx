import { useState } from 'react'
import { Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuoteStore } from '@/store/quoteStore'
import { useCatalogStore } from '@/store/catalogStore'
import { Button, Select, Badge } from '@/components/ui'
import { fmt, cn } from '@/utils'
import type { ProductCategory } from '@/types'

const CATEGORIES: ProductCategory[] = [
  'Mixer / Unifeed', 'Tolva', 'Embolsadora', 'Implemento varios',
  'Tractor', 'Cosechadora', 'Sembradora', 'Pulverizadora',
  'Repuesto / Accesorio', 'Servicio / Mano de obra',
]

export function ItemsTable({ priceListId }: { priceListId?: string | null }) {
  const { quote, addItem, updateItem, removeItem } = useQuoteStore()
  const { getAllProducts, getProductsByList, getOptionsByProduct } = useCatalogStore()
  const { items, currency, exchange_rate } = quote
  const sym = currency === 'USD' ? 'U$S' : '$'
  const [expandedOptions, setExpandedOptions] = useState<string | null>(null)

  // If a price list is selected, only show products from that list
  const allProducts = priceListId ? getProductsByList(priceListId) : getAllProducts()

  /** Convierte un precio al currency de la cotización */
  function convertPrice(price: number, fromCurrency: 'USD' | 'ARS'): number {
    if (fromCurrency === currency) return price
    if (fromCurrency === 'USD' && currency === 'ARS') return Math.round(price * exchange_rate)
    if (fromCurrency === 'ARS' && currency === 'USD') return Math.round((price / exchange_rate) * 100) / 100
    return price
  }

  const handleProductSelect = (itemId: string, productId: string) => {
    if (!productId) return
    const product = allProducts.find(p => p.id === productId)
    if (!product) return
    updateItem(itemId, {
      product_id: product.id,
      description: product.name,
      category: product.category,
      unit_price: convertPrice(product.base_price, product.currency),
    })
    setExpandedOptions(itemId)
  }

  const handleAddOption = (itemId: string, optionPrice: number, optionCurrency: 'USD' | 'ARS', optionName: string) => {
    addItem({
      description: optionName,
      category: 'Repuesto / Accesorio',
      quantity: 1,
      unit_price: convertPrice(optionPrice, optionCurrency),
      discount_pct: 0,
    })
  }

  return (
    <div className="rounded-xl bg-white border border-[#E2E8F0] overflow-hidden shadow-sm">
      {/* Scrollable table area */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: '640px' }}>
          {/* Table header */}
          <div className="grid gap-2 px-4 py-2.5 border-b border-[#E2E8F0] text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] bg-[#F8FAFC]"
            style={{ gridTemplateColumns: '2fr 1.2fr 80px 140px 90px 120px 40px' }}>
            <span>Descripción / Equipo</span>
            <span>Categoría</span>
            <span>Cant.</span>
            <span>Precio unit.</span>
            <span>Desc. %</span>
            <span>Subtotal</span>
            <span />
          </div>

          {/* Empty state */}
          {items.length === 0 && (
            <div className="text-center py-10 text-[13px] text-[#94A3B8]">
              Sin equipos — agregá uno abajo
            </div>
          )}

          {/* Rows */}
          {items.map(item => {
            const productOptions = item.product_id ? getOptionsByProduct(item.product_id) : []
            const isExpanded = expandedOptions === item.id
            const subtotal = item.unit_price * item.quantity * (1 - item.discount_pct / 100)

            return (
              <div key={item.id} className="border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors">
                {/* Main row */}
                <div className="grid gap-2 px-4 py-2 items-center"
                  style={{ gridTemplateColumns: '2fr 1.2fr 80px 140px 90px 120px 40px' }}>

                  {/* Description + catalog selector */}
                  <div className="flex flex-col gap-1">
                    <input
                      value={item.description}
                      onChange={e => updateItem(item.id, { description: e.target.value })}
                      placeholder="Descripción del equipo..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm px-2.5 py-1.5 outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 placeholder:text-[#94A3B8]"
                    />
                    <select
                      value={item.product_id ?? ''}
                      onChange={e => handleProductSelect(item.id, e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] text-[11px] px-2 py-1 outline-none focus:border-[#22C55E] appearance-none"
                    >
                      <option value="">— Seleccionar de lista de precios —</option>
                      {allProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          [{p.code}] {p.name} — {p.currency} {p.base_price.toLocaleString('es-AR')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category */}
                  <Select
                    value={item.category}
                    onChange={e => updateItem(item.id, { category: e.target.value as ProductCategory })}
                    className="text-xs py-1.5"
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </Select>

                  {/* Quantity */}
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(item.id, { quantity: Number(e.target.value) })}
                    min={1}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm px-2.5 py-1.5 outline-none focus:border-[#22C55E] text-center"
                  />

                  {/* Unit price */}
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#64748B]">$</span>
                    <input
                      type="number"
                      value={currency === 'ARS' ? item.unit_price : (exchange_rate > 0 ? Math.round(item.unit_price * exchange_rate) : item.unit_price)}
                      onChange={e => updateItem(item.id, { unit_price: currency === 'ARS' ? Number(e.target.value) : (exchange_rate > 0 ? Number(e.target.value) / exchange_rate : Number(e.target.value)) })}
                      min={0}
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm pl-8 pr-2 py-1.5 outline-none focus:border-[#22C55E]"
                    />
                  </div>

                  {/* Discount */}
                  <input
                    type="number"
                    value={item.discount_pct}
                    onChange={e => updateItem(item.id, { discount_pct: Number(e.target.value) })}
                    min={0} max={100} step={0.5}
                    className="w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm px-2.5 py-1.5 outline-none focus:border-[#22C55E] text-center"
                  />

                  {/* Subtotal */}
                  <span className="text-[13px] text-[#22C55E] font-semibold text-right whitespace-nowrap">
                    $ {fmt(currency === 'ARS' ? subtotal : (exchange_rate > 0 ? subtotal * exchange_rate : subtotal))}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {productOptions.length > 0 && (
                      <button
                        onClick={() => setExpandedOptions(isExpanded ? null : item.id)}
                        className="text-[#94A3B8] hover:text-[#22C55E] transition-colors cursor-pointer"
                        title="Ver opcionales"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-[#94A3B8] hover:text-[#EF4444] transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Opcionales GEA */}
                {isExpanded && productOptions.length > 0 && (
                  <div className="mx-4 mb-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                    <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">
                      Opcionales — {allProducts.find(p => p.id === item.product_id)?.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {productOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => handleAddOption(item.id, opt.price, (opt as any).currency ?? 'USD', opt.name)}
                          className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded-lg hover:border-[#22C55E]/50 hover:bg-[#F0FDF4] transition-all cursor-pointer group"
                        >
                          <Plus size={10} className="text-[#22C55E]" />
                          <span className="text-[11px] text-[#64748B] group-hover:text-[#0F172A] transition-colors">{opt.name}</span>
                          <Badge variant="trigo" className="text-[10px]">$ {Math.round((opt as any).currency === 'ARS' ? opt.price : exchange_rate > 0 ? opt.price * exchange_rate : opt.price).toLocaleString('es-AR')}</Badge>
                          {!opt.requires_commission && <Badge variant="acero" className="text-[9px]">sin comisión</Badge>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add row */}
      <div className="p-3 border-t border-[#F1F5F9]">
        <Button variant="add" onClick={() => addItem()}>
          + Agregar Equipo / Producto
        </Button>
      </div>
    </div>
  )
}

export function GeneralDiscounts() {
  const { quote, addDiscount, updateDiscount, removeDiscount } = useQuoteStore()
  const { discounts } = quote

  return (
    <div className="rounded-xl bg-white border border-[#E2E8F0] p-6 shadow-sm">
      <div className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-4">
        Descuentos & Recargos Generales
      </div>

      {discounts.length === 0 && (
        <p className="text-center text-[12px] text-[#94A3B8] py-4">Sin descuentos generales</p>
      )}

      <div className="flex flex-col gap-2 mb-3">
        {discounts.map(d => (
          <div key={d.id} className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Select
                value={d.type}
                onChange={e => updateDiscount(d.id, { type: e.target.value as 'discount' | 'surcharge' })}
                className="w-32 text-xs py-1.5 flex-shrink-0"
              >
                <option value="discount">Descuento</option>
                <option value="surcharge">Recargo</option>
              </Select>
              <input
                value={d.concept}
                onChange={e => updateDiscount(d.id, { concept: e.target.value })}
                placeholder="Concepto (ej: descuento campaña...)"
                className="flex-1 min-w-0 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm px-2.5 py-1.5 outline-none focus:border-[#22C55E] placeholder:text-[#94A3B8]"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={d.percentage}
                  onChange={e => updateDiscount(d.id, { percentage: Number(e.target.value) })}
                  min={0} max={100} step={0.5}
                  className="w-20 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm px-2 py-1.5 outline-none focus:border-[#22C55E] text-center"
                />
                <span className="text-[#64748B] text-sm">%</span>
              </div>
              <button onClick={() => removeDiscount(d.id)} className="ml-auto text-[#94A3B8] hover:text-[#EF4444] transition-colors cursor-pointer p-1">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="add" onClick={addDiscount}>
        + Agregar Descuento / Recargo
      </Button>
    </div>
  )
}
