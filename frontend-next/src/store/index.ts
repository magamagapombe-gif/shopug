import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User { name: string; email: string; is_admin: boolean; role: string }
interface AuthState {
  token: string | null; user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null, user: null,
      setAuth: (token, user) => { localStorage.setItem("token", token); set({ token, user }); },
      logout: () => { localStorage.removeItem("token"); set({ token: null, user: null }); },
    }),
    { name: "auth" }
  )
);

interface CartItem { product_id: number; title: string; price: number; image_url: string; quantity: number; currency: string }
interface CartState { items: CartItem[]; total: number; setCart: (i: CartItem[], t: number) => void; clearLocal: () => void }
export const useCartStore = create<CartState>((set) => ({
  items: [], total: 0,
  setCart: (items, total) => set({ items, total }),
  clearLocal: () => set({ items: [], total: 0 }),
}));
