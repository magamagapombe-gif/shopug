import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = { title: "ShopUG", description: "Uganda's Online Marketplace" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <footer className="bg-gray-900 text-gray-400 text-sm py-10 mt-16">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-display font-bold text-white mb-3 text-lg">ShopUG</h4>
              <p>Uganda's favourite marketplace. Every product inspected before delivery.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Shop</h4>
              <ul className="space-y-1">
                <li><a href="/shop" className="hover:text-white">All Products</a></li>
                <li><a href="/shop?sort=price_asc" className="hover:text-white">Best Price</a></li>
                <li><a href="/shop?sort=rating" className="hover:text-white">Top Rated</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Account</h4>
              <ul className="space-y-1">
                <li><a href="/auth/login" className="hover:text-white">Login</a></li>
                <li><a href="/auth/register" className="hover:text-white">Register</a></li>
                <li><a href="/orders" className="hover:text-white">My Orders</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Sell With Us</h4>
              <ul className="space-y-1">
                <li><a href="/supplier/register" className="hover:text-white">Become a Supplier</a></li>
                <li><a href="/supplier/login" className="hover:text-white">Supplier Login</a></li>
              </ul>
            </div>
          </div>
          <div className="text-center mt-8 border-t border-gray-800 pt-6">
            © {new Date().getFullYear()} ShopUG. All rights reserved. Delivery within 24–48 hours.
          </div>
        </footer>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
