import axios from "axios";
const api = axios.create({ baseURL: "http://localhost:8000" });
api.interceptors.request.use(c => {
  if (typeof window !== "undefined") {
    const t = localStorage.getItem("token");
    if (t) c.headers.Authorization = `Bearer ${t}`;
  }
  return c;
});
export default api;

// Auth
export const loginCustomer    = (b: any) => api.post("/auth/login", b).then(r => r.data);
export const registerCustomer = (b: any) => api.post("/auth/register", b).then(r => r.data);
export const loginSupplier    = (b: any) => api.post("/auth/supplier/login", b).then(r => r.data);
export const registerSupplier = (b: any) => api.post("/auth/supplier/register", b).then(r => r.data);
export const fetchMe          = ()        => api.get("/auth/me").then(r => r.data);

// Catalog
export const fetchCategories = ()       => api.get("/categories").then(r => r.data);
export const fetchProducts   = (p: any) => api.get("/products", { params: p }).then(r => r.data);
export const fetchProduct    = (id: number) => api.get(`/products/${id}`).then(r => r.data);
export const fetchRelated    = (id: number) => api.get(`/products/${id}/related`).then(r => r.data);

// Cart
export const fetchCart      = ()                         => api.get("/cart").then(r => r.data);
export const addToCart      = (product_id: number, quantity = 1) => api.post("/cart", { product_id, quantity });
export const updateCart     = (product_id: number, quantity: number) => api.patch(`/cart/${product_id}`, null, { params: { quantity } });
export const removeFromCart = (product_id: number)       => api.delete(`/cart/${product_id}`);
export const clearCart      = ()                         => api.delete("/cart");

// Orders
export const placeOrder  = (b: any) => api.post("/orders", b).then(r => r.data);
export const fetchOrders = ()       => api.get("/orders").then(r => r.data);
export const fetchOrder  = (id: number) => api.get(`/orders/${id}`).then(r => r.data);
export const fileComplaint = (b: any) => api.post("/complaints", b).then(r => r.data);

// Admin
export const fetchAdminStats        = ()             => api.get("/admin/stats").then(r => r.data);
export const fetchAdminOrders       = (s?: string)   => api.get("/admin/orders", { params: { status: s } }).then(r => r.data);
export const fetchAdminSuppliers    = (s?: string)   => api.get("/admin/suppliers", { params: { status: s } }).then(r => r.data);
export const fetchAdminPayouts      = (s?: string)   => api.get("/admin/payouts", { params: { status: s } }).then(r => r.data);
export const fetchAdminComplaints   = ()             => api.get("/admin/complaints").then(r => r.data);
export const fetchPendingProducts   = ()             => api.get("/admin/supplier-products?status=pending").then(r => r.data);
export const fetchAdminNotifications = ()            => api.get("/admin/notifications").then(r => r.data);
export const updateOrderStatus      = (id: number, status: string) => api.patch(`/admin/orders/${id}/status`, null, { params: { status } });
export const updateSupplierStatus   = (id: number, status: string) => api.patch(`/admin/suppliers/${id}/status`, null, { params: { status } });
export const updateSupplierTier     = (id: number, tier: string)   => api.patch(`/admin/suppliers/${id}/tier`, null, { params: { tier } });
export const selectBid              = (bid_id: number)             => api.post(`/admin/bids/${bid_id}/select`);
export const autoSelectBids         = (order_id: number)           => api.post(`/admin/bids/auto-select/${order_id}`);
export const getItemBids            = (item_id: number)            => api.get(`/admin/bids/${item_id}`).then(r => r.data);
export const updateFulfillment      = (id: number, status: string, note = "") => api.patch(`/admin/fulfillments/${id}/status`, null, { params: { status, admin_note: note } });
export const markPayoutPaid         = (id: number, ref = "")       => api.patch(`/admin/payouts/${id}/pay`, null, { params: { payment_ref: ref } });
export const approveProduct         = (id: number, b: any)         => api.post(`/admin/supplier-products/${id}/approve`, b);
export const rejectProduct          = (id: number, note = "")      => api.post(`/admin/supplier-products/${id}/reject`, null, { params: { note } });

// Supplier portal
export const fetchSupplierDashboard   = ()       => api.get("/supplier/dashboard").then(r => r.data);
export const fetchSupplierCategories  = ()       => api.get("/supplier/categories").then(r => r.data);
export const setSupplierCategories    = (ids: number[]) => api.post("/supplier/categories", { category_ids: ids });
export const fetchSupplierInventory   = ()       => api.get("/supplier/inventory").then(r => r.data);
export const addInventoryItem         = (b: any) => api.post("/supplier/inventory", b);
export const removeInventoryItem      = (product_id: number) => api.delete(`/supplier/inventory/${product_id}`);
export const fetchSupplierBids        = (s?: string) => api.get("/supplier/bids", { params: { status: s } }).then(r => r.data);
export const fetchSupplierFulfillments = ()      => api.get("/supplier/fulfillments").then(r => r.data);
export const confirmFulfillment       = (id: number) => api.patch(`/supplier/fulfillments/${id}/confirm`);
export const submitProduct            = (b: any) => api.post("/supplier/products/submit", b).then(r => r.data);
export const fetchMySubmissions       = ()       => api.get("/supplier/products/submissions").then(r => r.data);
export const fetchSupplierPayouts     = ()       => api.get("/supplier/payouts").then(r => r.data);
export const fetchSupplierNotifications = ()     => api.get("/supplier/notifications").then(r => r.data);
