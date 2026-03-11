export interface Product {
  id: string
  category_id?: string
  category?: Category
  sku: string
  name: string
  description: string
  short_desc: string
  price: number
  compare_price: number
  original_price: number
  discount_percentage: number
  on_sale: boolean
  currency_code: string
  tax_rate: number
  weight: number
  unit: string
  image_url: string
  slug: string
  meta_title: string
  meta_description: string
  is_active: boolean
  is_digital: boolean
  track_stock: boolean
  stock_quantity: number
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  name: string
  price: number
  stock_quantity: number
  image_url: string
  is_active: boolean
}

export interface Category {
  id: string
  parent_id?: string
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  is_active: boolean
  children?: Category[]
}

export interface CartItem {
  id: string
  cart_id: string
  product_id: string
  variant_id?: string
  quantity: number
  product_name: string
  product_price: number
  product_image: string
  product_slug: string
}

export interface CartResponse {
  cart_id: string
  items: CartItem[]
  total_items: number
  total_amount: number
}

export interface Order {
  id: string
  created_at: string
  order_number: string
  order_date: string
  status: string
  payment_status: string
  currency_code: string
  subtotal: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  total_amount: number
  paid_amount: number
  notes: string
  shipping_name: string
  shipping_address: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  shipping_country: string
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  sku: string
  name: string
  quantity: number
  unit_price: number
  tax_amount: number
  discount: number
  total_amount: number
}

export interface Address {
  id: string
  label: string
  first_name: string
  last_name: string
  phone: string
  address1: string
  address2: string
  city: string
  state: string
  postal_code: string
  country: string
  is_default: boolean
}

export interface Customer {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  avatar: string
  is_active: boolean
  email_verified: boolean
}

export interface WishlistItem {
  id: string
  customer_id: string
  product_id: string
  product_name: string
  product_price: number
  product_image: string
  product_slug: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface CarouselSlide {
  title: string
  subtitle: string
  image_url: string
  button_text: string
  button_link: string
  gradient: string
  is_active: boolean
  sort_order: number
}

export interface PriceRange {
  min_price: number
  max_price: number
}

export interface FavoriteItem {
  id: string
  customer_id: string
  product_id: string
  product_name: string
  product_price: number
  product_image: string
  product_slug: string
}
