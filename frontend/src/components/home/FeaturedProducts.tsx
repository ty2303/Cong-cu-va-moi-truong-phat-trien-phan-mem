import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import ProductCard from '@/components/ui/ProductCard';
import { featuredProducts } from '@/data/products';

export default function FeaturedProducts() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="mb-12 flex items-end justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand-accent">
              Nổi bật
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-brand md:text-4xl">
              Sản phẩm đáng chú ý
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/products"
              className="group hidden items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-brand no-underline md:flex"
            >
              Xem tất cả
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.slice(0, 8).map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>

        {/* Mobile "View all" */}
        <div className="mt-8 flex justify-center md:hidden">
          <Link
            to="/products"
            className="btn-outline inline-flex items-center gap-2 no-underline"
          >
            Xem tất cả sản phẩm
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
