import { Check, ClipboardList, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, Navigate, useLocation } from 'react-router';

export const Component = CheckoutSuccess;

function CheckoutSuccess() {
  const location = useLocation();
  const state = location.state as {
    fromCheckout?: boolean;
    orderId?: string;
  } | null;
  const fromCheckout = state?.fromCheckout;

  // Prevent direct URL access — only allow navigation from checkout flow
  if (!fromCheckout) {
    return <Navigate to="/products" replace />;
  }

  const orderId = state?.orderId ?? 'N/A';

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

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h1 className="font-display text-3xl font-bold text-text-primary">
            Đặt hàng thành công!
          </h1>

          <p className="mt-4 text-text-secondary">
            Cảm ơn bạn đã tin tưởng và mua hàng. Mã đơn hàng của bạn là{' '}
            <span className="font-mono font-bold text-text-primary">
              #{orderId.slice(-8).toUpperCase()}
            </span>
            .
          </p>

          <p className="mt-2 text-sm text-text-muted">
            Chúng tôi sẽ liên hệ sớm để xác nhận và giao hàng đến bạn.
          </p>

          {/* Actions */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/profile"
              state={{ tab: 'orders' }}
              className="btn-primary flex items-center justify-center gap-2 no-underline"
            >
              <ClipboardList className="h-4 w-4" />
              Xem đơn hàng
            </Link>
            <Link
              to="/products"
              className="btn-outline flex items-center justify-center gap-2 no-underline"
            >
              <ShoppingBag className="h-4 w-4" />
              Tiếp tục mua sắm
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
