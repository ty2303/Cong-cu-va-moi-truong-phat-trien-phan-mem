import { Check, Loader2, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';

import { useOrderStore } from '@/store/useOrderStore';

export const Component = CheckoutSuccess;

function CheckoutSuccess() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fetchOrderById = useOrderStore((store) => store.fetchOrderById);
  const currentOrder = useOrderStore((store) => store.currentOrder);
  const isLoading = useOrderStore((store) => store.isLoading);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const state = location.state as {
    fromCheckout?: boolean;
    orderId?: string;
  } | null;
  const fromCheckout = state?.fromCheckout;

  useEffect(() => {
    const resolvedOrderId = state?.orderId ?? searchParams.get('orderId') ?? '';
    if (!resolvedOrderId) return;
    let cancelled = false;

    fetchOrderById(resolvedOrderId).finally(() => {
      if (!cancelled) {
        setHasAttemptedLoad(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchOrderById, searchParams, state?.orderId]);

  // Prevent direct URL access — only allow navigation from checkout flow
  if (!fromCheckout && !searchParams.get('orderId')) {
    return <Navigate to="/products" replace />;
  }

  const orderId = state?.orderId ?? searchParams.get('orderId') ?? 'N/A';
  const order = currentOrder?.id === orderId ? currentOrder : null;
  const shippingAddress = order
    ? [order.address, order.ward, order.district, order.city]
        .filter(Boolean)
        .join(', ')
    : null;

  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-md text-center"
      >
        {/* Success icon */}
        <div className="mb-8 flex justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
              delay: 0.2,
            }}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50"
          >
            <Check className="h-12 w-12 text-green-600" strokeWidth={3} />
          </motion.div>
        </div>

        <h1 className="font-display text-3xl font-bold text-text-primary">
          Đặt hàng thành công!
        </h1>

        <p className="mt-4 text-text-secondary">
          Cảm ơn bạn đã tin tưởng và mua hàng. Mã đơn hàng của bạn là{' '}
          <span className="font-mono font-bold text-text-primary">
            #{orderId}
          </span>
          .
        </p>

        <p className="mt-2 text-sm text-text-muted">
          Thông tin chi tiết đơn hàng đã được gửi vào email của bạn. Chúng tôi
          sẽ liên hệ sớm để xác nhận.
        </p>

        {isLoading && !order && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải thông tin đơn hàng...
          </div>
        )}

        {order && (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-5 text-left shadow-sm">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              Thông tin đơn hàng
            </h2>
            <div className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
              <p>
                Người nhận:{' '}
                <span className="font-medium text-text-primary">
                  {order.customerName}
                </span>
              </p>
              <p>
                Số điện thoại:{' '}
                <span className="font-medium text-text-primary">
                  {order.phone}
                </span>
              </p>
              <p className="sm:col-span-2">
                Giao tới:{' '}
                <span className="font-medium text-text-primary">
                  {shippingAddress}
                </span>
              </p>
              <p>
                Trạng thái thanh toán:{' '}
                <span className="font-medium text-text-primary">
                  {order.paymentStatus === 'UNPAID'
                    ? 'Thanh toán khi nhận hàng'
                    : order.paymentStatus}
                </span>
              </p>
              <p>
                Tổng thanh toán:{' '}
                <span className="font-semibold text-brand">
                  {order.total.toLocaleString('vi-VN')}₫
                </span>
              </p>
            </div>
          </div>
        )}

        {!order && hasAttemptedLoad && !isLoading && (
          <p className="mt-6 text-sm text-text-muted">
            Nếu chưa thấy chi tiết đơn, bạn có thể xem lại trong trang cá nhân.
          </p>
        )}

        {/* Actions */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/products"
            className="btn-primary flex items-center justify-center gap-2 no-underline"
          >
            <ShoppingBag className="h-4 w-4" />
            Tiếp tục mua sắm
          </Link>
          <Link
            to="/profile"
            className="btn-outline flex items-center justify-center gap-2 no-underline"
          >
            Xem đơn hàng
          </Link>
          <Link
            to="/"
            className="btn-outline flex items-center justify-center gap-2 no-underline"
          >
            Về trang chủ
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
