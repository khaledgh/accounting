import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, ShoppingBag, Truck, Shield, Zap, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import apiClient from '@/api/client'
import type { Product, Category, CarouselSlide, PaginatedResponse } from '@/types'
import ProductCard from '@/components/product/ProductCard'
import { getImageUrl } from '@/lib/utils'

const DEFAULT_SLIDES: CarouselSlide[] = [
  { title: 'Next-Gen Electronics', subtitle: 'Discover the latest tech at unbeatable prices', button_text: 'Shop Electronics', button_link: '/products', gradient: 'from-violet-600 via-indigo-600 to-blue-600', image_url: '', is_active: true, sort_order: 0 },
  { title: 'Premium Laptops', subtitle: 'Power meets portability — MacBook, Dell XPS & more', button_text: 'Explore Laptops', button_link: '/products', gradient: 'from-emerald-600 via-teal-600 to-cyan-600', image_url: '', is_active: true, sort_order: 1 },
  { title: 'Smart Accessories', subtitle: 'Complete your setup with top-rated accessories', button_text: 'Browse Accessories', button_link: '/products', gradient: 'from-orange-500 via-rose-500 to-pink-600', image_url: '', is_active: true, sort_order: 2 },
]

const CATEGORY_COLORS: Record<string, string> = {
  electronics: 'from-blue-500 to-indigo-600',
  clothing: 'from-pink-500 to-rose-600',
  books: 'from-amber-500 to-orange-600',
  'home-garden': 'from-emerald-500 to-green-600',
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } }),
}

const stagger = { visible: { transition: { staggerChildren: 0.06 } } }

// Reusable product carousel component
function ProductCarousel({ products }: { products: Product[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'start', slidesToScroll: 1, containScroll: 'trimSnaps' })
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  return (
    <div className="relative group/carousel">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {products.map(product => (
            <div key={product.id} className="flex-[0_0_48%] sm:flex-[0_0_32%] lg:flex-[0_0_24%] min-w-0">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
      <button onClick={scrollPrev} aria-label="Previous"
        className="absolute -left-3 top-1/2 -translate-y-1/2 bg-white border border-gray-200 shadow-lg shadow-gray-200/50 p-2.5 rounded-full hover:bg-gray-50 transition opacity-0 group-hover/carousel:opacity-100 z-10">
        <ChevronLeft className="w-4 h-4 text-gray-700" />
      </button>
      <button onClick={scrollNext} aria-label="Next"
        className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white border border-gray-200 shadow-lg shadow-gray-200/50 p-2.5 rounded-full hover:bg-gray-50 transition opacity-0 group-hover/carousel:opacity-100 z-10">
        <ChevronRight className="w-4 h-4 text-gray-700" />
      </button>
    </div>
  )
}

// Category section with products and Load More
function CategoryProductSection({ category }: { category: Category }) {
  const [limit, setLimit] = useState(4)
  const gradient = CATEGORY_COLORS[category.slug] || 'from-gray-600 to-gray-800'

  const { data, isLoading } = useQuery({
    queryKey: ['category-products', category.id, limit],
    queryFn: () => apiClient.get('/store/products', { params: { category_id: category.id, page_size: String(limit) } })
      .then(r => r.data.data as PaginatedResponse<Product>),
  })

  const products = data?.items || []
  const total = data?.total || 0
  const hasMore = products.length < total

  if (products.length === 0 && !isLoading) return null

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {category.image_url ? (
            <img src={getImageUrl(category.image_url)} alt="" className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold tracking-tight">{category.name}</h2>
            <p className="text-xs text-gray-400">{total} products</p>
          </div>
        </div>
        <Link to={`/products?category_id=${category.id}`}
          className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition">
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center mt-6">
          <button onClick={() => setLimit(prev => prev + 4)} disabled={isLoading}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition flex items-center gap-2 disabled:opacity-50">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Load More
          </button>
        </div>
      )}
      <Link to={`/products?category_id=${category.id}`}
        className="sm:hidden flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 mt-4">
        View All {category.name} <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  )
}

export default function HomePage() {
  const { data: carousel } = useQuery({ queryKey: ['carousel'], queryFn: () => apiClient.get('/store/cms/carousel').then(r => r.data.data as CarouselSlide[] | null) })
  const { data: featured } = useQuery({ queryKey: ['featured'], queryFn: () => apiClient.get('/store/featured').then(r => (r.data.data || []) as Product[]) })
  const { data: newArrivals } = useQuery({ queryKey: ['new-arrivals'], queryFn: () => apiClient.get('/store/new-arrivals').then(r => (r.data.data || []) as Product[]) })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => apiClient.get('/store/categories').then(r => (r.data.data || []) as Category[]) })

  const slides = carousel && carousel.length > 0 ? carousel : DEFAULT_SLIDES

  const [heroRef, heroApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000, stopOnInteraction: false })])
  const heroPrev = useCallback(() => heroApi?.scrollPrev(), [heroApi])
  const heroNext = useCallback(() => heroApi?.scrollNext(), [heroApi])

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Bazarkon — Premium Electronics, Clothing & More</title>
        <meta name="description" content="Shop the latest electronics, laptops, clothing, books and home goods. Free shipping on orders over $50. Secure checkout." />
        <meta property="og:title" content="Bazarkon — Premium Products" />
        <meta property="og:description" content="Discover quality products at great prices. Free shipping on orders over $50." />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="/" />
      </Helmet>

      {/* Hero Carousel */}
      <section className="relative overflow-hidden" ref={heroRef}>
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0">
              <div className={`bg-gradient-to-br ${slide.gradient || 'from-gray-700 to-gray-900'} text-white relative`}>
                {slide.image_url && (
                  <img src={getImageUrl(slide.image_url)} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30" />
                )}
                <div className="max-w-7xl mx-auto px-4 py-24 md:py-36 flex flex-col items-center text-center relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent_60%)]" />
                  <motion.span initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white/90 text-xs font-medium px-3 py-1.5 rounded-full mb-6 relative z-10">
                    <Sparkles className="w-3.5 h-3.5" /> New Collection Available
                  </motion.span>
                  <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
                    className="text-4xl md:text-7xl font-extrabold mb-4 tracking-tight relative z-10">
                    {slide.title}
                  </motion.h1>
                  <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
                    className="text-lg md:text-xl text-white/80 mb-10 max-w-xl relative z-10">
                    {slide.subtitle}
                  </motion.p>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                    <Link to={slide.button_link || '/products'}
                      className="bg-white text-gray-900 px-8 py-3.5 rounded-full font-semibold hover:bg-white/90 transition shadow-lg shadow-black/20 flex items-center gap-2 relative z-10">
                      {slide.button_text || 'Shop Now'} <ArrowRight className="w-5 h-5" />
                    </Link>
                  </motion.div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={heroPrev} aria-label="Previous slide"
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition z-20">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={heroNext} aria-label="Next slide"
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition z-20">
          <ChevronRight className="w-5 h-5" />
        </button>
      </section>

      {/* Trust Badges */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger}
        className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Truck, title: 'Free Shipping', desc: 'On orders over $50' },
              { icon: Shield, title: 'Secure Checkout', desc: '256-bit SSL encryption' },
              { icon: Zap, title: 'Fast Delivery', desc: '2-5 business days' },
            ].map((f, i) => (
              <motion.div key={f.title} custom={i} variants={fadeUp} className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Featured Products — Carousel */}
      {featured && featured.length > 0 && (
        <section className="bg-gray-50/60 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Featured Products</h2>
                <p className="text-gray-500 mt-1">Our top picks for you</p>
              </div>
              <Link to="/products" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <ProductCarousel products={featured} />
            <Link to="/products" className="sm:hidden flex items-center justify-center gap-1.5 text-sm font-medium text-gray-600 mt-8">
              View All Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* New Arrivals — Carousel */}
      {newArrivals && newArrivals.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">New Arrivals</h2>
              <p className="text-gray-500 mt-1">Fresh from the warehouse</p>
            </div>
            <Link to="/products?sort=created_at&order=desc" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <ProductCarousel products={newArrivals} />
        </section>
      )}

      {/* Category Product Sections */}
      {categories && categories.length > 0 && (
        <div className="border-t border-gray-100">
          {categories.map(cat => (
            <CategoryProductSection key={cat.id} category={cat} />
          ))}
        </div>
      )}

      {/* Newsletter */}
      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Stay in the loop</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Subscribe for exclusive deals, new arrivals, and insider-only discounts.</p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={e => e.preventDefault()}>
            <input type="email" placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700/50 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-gray-600 transition" />
            <button type="submit" className="bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition whitespace-nowrap">
              Subscribe
            </button>
          </form>
        </div>
      </motion.section>
    </div>
  )
}
