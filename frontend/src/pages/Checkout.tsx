import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Truck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import type { ApiResponse } from '@/api/types';
import type { CreateOrderPayload, Order } from '@/types/order';

export const Component = Checkout;

type PaymentMethod = 'COD' | 'MOMO';

const inputClass =
  'w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-colors';

function Checkout() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const clear = useCartStore((s) => s.clear);
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');

  if (items.length === 0) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Giỏ hàng trống
        </h2>
        <p className="mt-2 text-text-secondary">
          Vui lòng thêm sản phẩm trước khi thanh toán.
        </p>
        <Link to="/products" className="btn-primary mt-6 no-underline">
          Tiếp tục mua sắm
        </Link>
      </section>
    );
  }

  const shippingFee = totalPrice >= 500000 ? 0 : 30000;
  const total = totalPrice + shippingFee;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    const payload: CreateOrderPayload = {
      email: fd.get('email') as string,
      customerName: fd.get('name') as string,
      phone: fd.get('phone') as string,
      address: fd.get('address') as string,
      city: fd.get('city') as string,
      district: fd.get('district') as string,
      ward: fd.get('ward') as string,
      note: (fd.get('note') as string) || undefined,
      paymentMethod,
      items: items.map(({ product, quantity }) => ({
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        brand: product.brand,
        price: product.price,
        quantity,
      })),
    };

    try {
      const res = await apiClient.post<ApiResponse<Order>>(
        ENDPOINTS.ORDERS.BASE,
        payload,
      );
      const orderId = res.data.data.id;
      clear();

      if (paymentMethod === 'MOMO') {
        // Get MoMo payment URL then redirect browser to it
        const momoRes = await apiClient.post<ApiResponse<{ payUrl: string }>>(
          ENDPOINTS.MOMO.CREATE(orderId),
        );
        window.location.href = momoRes.data.data.payUrl;
      } else {
        navigate('/checkout/success', {
          state: { fromCheckout: true, orderId },
        });
      }
    } catch {
      setError('Đặt hàng thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
      {/* Back link & heading */}
      <div className="mb-10">
        <Link
          to="/cart"
          className="group inline-flex items-center gap-2 text-sm text-text-muted no-underline transition-colors hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Quay lại giỏ hàng
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold text-text-primary lg:text-4xl">
          Thanh toán
        </h1>
      </div>

      <div className="grid gap-12 lg:grid-cols-12">
        {/* ── Left Column: Form ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-7"
        >
          <form
            id="checkout-form"
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            {/* Contact Info */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-text-primary">
                <CheckCircle2 className="h-5 w-5 text-brand-accent" />
                Thông tin liên hệ
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-text-primary"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    defaultValue={user?.email ?? ''}
                    placeholder="nguyenvan@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-medium text-text-primary"
                  >
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    placeholder="Nguyễn Văn A"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-medium text-text-primary"
                  >
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    placeholder="0912 345 678"
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            {/* Shipping Address */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-text-primary">
                <MapPin className="h-5 w-5 text-brand-accent" />
                Địa chỉ giao hàng
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="address"
                    className="mb-2 block text-sm font-medium text-text-primary"
                  >
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    required
                    placeholder="Số nhà, Tên đường"
                    className={inputClass}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="city"
                      className="mb-2 block text-sm font-medium text-text-primary"
                    >
                      Tỉnh / Thành phố
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      required
                      placeholder="Tỉnh / Thành phố"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="district"
                      className="mb-2 block text-sm font-medium text-text-primary"
                    >
                      Quận / Huyện
                    </label>
                    <input
                      type="text"
                      id="district"
                      name="district"
                      required
                      placeholder="Quận / Huyện"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ward"
                      className="mb-2 block text-sm font-medium text-text-primary"
                    >
                      Phường / Xã
                    </label>
                    <input
                      type="text"
                      id="ward"
                      name="ward"
                      required
                      placeholder="Phường / Xã"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Payment Method */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-text-primary">
                <CreditCard className="h-5 w-5 text-brand-accent" />
                Phương thức thanh toán
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* COD */}
                <label
                  className={`relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-all ${
                    paymentMethod === 'COD'
                      ? 'border-brand bg-brand-subtle ring-1 ring-brand'
                      : 'border-border bg-surface hover:border-border-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-3">
                    <Truck
                      className={`h-5 w-5 ${paymentMethod === 'COD' ? 'text-brand' : 'text-text-muted'}`}
                    />
                    <span className="font-display text-sm font-semibold text-text-primary">
                      Thanh toán khi nhận hàng
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Thanh toán bằng tiền mặt khi giao hàng.
                  </p>
                </label>

                {/* MoMo */}
                <label
                  className={`relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-all ${
                    paymentMethod === 'MOMO'
                      ? 'border-pink-500 bg-pink-50 ring-1 ring-pink-500'
                      : 'border-border bg-surface hover:border-border-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="MOMO"
                    checked={paymentMethod === 'MOMO'}
                    onChange={() => setPaymentMethod('MOMO')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-pink-500 text-[9px] font-bold text-white">
                      M
                    </div>
                    <span className="font-display text-sm font-semibold text-text-primary">
                      Ví MoMo
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Quét mã QR qua ứng dụng MoMo.
                  </p>
                </label>
              </div>
            </section>

            {/* Note */}
            <section className="space-y-4">
              <label
                htmlFor="note"
                className="block text-sm font-medium text-text-primary"
              >
                Ghi chú đơn hàng{' '}
                <span className="text-text-muted">(tùy chọn)</span>
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                placeholder="Ghi chú thêm về đơn hàng, ví dụ: giao vào buổi sáng..."
                className={`${inputClass} resize-none`}
              />
            </section>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </form>
        </motion.div>

        {/* ── Right Column: Order Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-5"
        >
          <div className="sticky top-28 space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-text-primary">
              Đơn hàng của bạn
            </h3>

            {/* Product list */}
            <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-4">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-alt p-1">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-auto object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-1 text-sm font-medium text-text-primary">
                      {product.name}
                    </h4>
                    <p className="text-xs text-text-muted">
                      Số lượng: {quantity}
                    </p>
                    <p className="text-sm font-semibold text-brand">
                      {(product.price * quantity).toLocaleString('vi-VN')}₫
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Tạm tính</span>
                <span className="font-medium text-text-primary">
                  {totalPrice.toLocaleString('vi-VN')}₫
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Phí vận chuyển</span>
                <span className="font-medium text-text-primary">
                  {shippingFee === 0
                    ? 'Miễn phí'
                    : `${shippingFee.toLocaleString('vi-VN')}₫`}
                </span>
              </div>
              {shippingFee > 0 && (
                <p className="text-xs text-text-muted">
                  Miễn phí vận chuyển cho đơn hàng từ 500.000₫
                </p>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-display text-base font-bold text-text-primary">
                  Tổng cộng
                </span>
                <span className="font-display text-xl font-bold text-brand">
                  {total.toLocaleString('vi-VN')}₫
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              form="checkout-form"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand py-4 font-display text-sm font-bold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Đặt hàng ngay'
              )}
            </button>

            <p className="text-center text-xs text-text-muted">
              Bằng việc đặt hàng, bạn đồng ý với điều khoản dịch vụ và chính
              sách bảo mật của chúng tôi.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
