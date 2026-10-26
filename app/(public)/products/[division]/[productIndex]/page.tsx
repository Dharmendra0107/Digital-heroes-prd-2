import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DIVISIONS } from '@/lib/products'
import ProductConfigurator from './ProductConfigurator'
import type { Division } from '@/types'
import { getCatalogProducts } from '@/lib/catalog'

interface Props {
  params: Promise<{
    division: string
    productIndex: string
  }>
}

export default async function ProductDetailPage({ params }: Props) {
  const { division, productIndex } = await params
  const index = parseInt(productIndex, 10)

  const divisionInfo = DIVISIONS.find((d) => d.slug === division)
  if (!divisionInfo || isNaN(index)) {
    notFound()
  }

  const divisionProducts = await getCatalogProducts(division as Division)
  const product = divisionProducts[index]

  if (!product) {
    notFound()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="text-xs sm:text-sm text-neutral-500 mb-6 flex items-center gap-2">
        <Link href="/products" className="hover:text-amber-500">
          Products
        </Link>
        <span>›</span>
        <Link href={`/products/${division}`} className="hover:text-amber-500">
          {divisionInfo.name}
        </Link>
        <span>›</span>
        <span className="text-neutral-900 font-medium">{product.name}</span>
      </nav>

      {/* Main Configurator */}
      <ProductConfigurator
        product={product}
        divisionSlug={division}
        productIndex={index}
      />
    </div>
  )
}
