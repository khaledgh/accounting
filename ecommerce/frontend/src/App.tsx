import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import HomePage from '@/pages/HomePage'
import ProductListPage from '@/pages/ProductListPage'
import ProductDetailPage from '@/pages/ProductDetailPage'
import CartPage from '@/pages/CartPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import AccountPage from '@/pages/AccountPage'
import ProfilePage from '@/pages/ProfilePage'
import FavoritesPage from '@/pages/FavoritesPage'
import CheckoutPage from '@/pages/CheckoutPage'
import { useAuthStore } from '@/store/authStore'
import { useFavoritesStore } from '@/store/favoritesStore'

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
}

export default function App() {
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()
  const { fetchFavoriteIds, clear } = useFavoritesStore()

  useEffect(() => {
    if (isAuthenticated) fetchFavoriteIds()
    else clear()
  }, [isAuthenticated, fetchFavoriteIds, clear])

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} {...pageTransition}>
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductListPage />} />
              <Route path="/products/:slug" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/account/*" element={<AccountPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
