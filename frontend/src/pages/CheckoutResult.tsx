import { Check, ShoppingBag, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router';

export const Component = CheckoutResult;

function CheckoutResult() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const orderId = searchParams.get('orderId') ?? 'N/A';

  if (success) {
    return (
      <section className="flex min-h-[70vh] items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-md text-center"
        >
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
            Thanh toán thành công!
          </h1>

          <p className="mt-4 text-text-secondary">
            Đơn hàng{' '}
            <span className="font-mono font-bold text-text-primary">
              #{orderId}
            </span>{' '}
            đã được thanh toán qua MoMo. Chúng tôi sẽ xử lý và giao hàng sớm
            nhất có thể.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/products"
              className="btn-primary flex items-center justify-center gap-2 no-underline"
            >
              <ShoppingBag className="h-4 w-4" />
              Tiếp tục mua sắm
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

  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-md text-center"
      >
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
            className="flex h-24 w-24 items-center justify-center rounded-full bg-red-100 ring-8 ring-red-50"
          >
            <XCircle className="h-12 w-12 text-red-500" strokeWidth={2} />
          </motion.div>
        </div>

        <h1 className="font-display text-3xl font-bold text-text-primary">
          Thanh toán thất bại
        </h1>

        <p className="mt-4 text-text-secondary">
          Giao dịch MoMo cho đơn hàng{' '}
          <span className="font-mono font-bold text-text-primary">
            #{orderId}
          </span>{' '}
          không thành công. Đơn hàng của bạn đã bị huỷ.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/cart"
            className="btn-primary flex items-center justify-center gap-2 no-underline"
          >
            Thử lại
          </Link>
          <Link
            to="/products"
            className="btn-outline flex items-center justify-center gap-2 no-underline"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
