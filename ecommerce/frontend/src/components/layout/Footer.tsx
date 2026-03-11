import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-white text-lg font-bold mb-4">Store</h3>
          <p className="text-sm">Your one-stop shop for quality products at great prices.</p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Shop</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/products" className="hover:text-white">All Products</Link></li>
            <li><Link to="/products?sort=created_at&order=desc" className="hover:text-white">New Arrivals</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Account</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/account" className="hover:text-white">My Account</Link></li>
            <li><Link to="/account/orders" className="hover:text-white">Order History</Link></li>
            <li><Link to="/wishlist" className="hover:text-white">Wishlist</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Support</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="mailto:support@store.com" className="hover:text-white">support@store.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800 py-4 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Store. All rights reserved.
      </div>
    </footer>
  )
}
