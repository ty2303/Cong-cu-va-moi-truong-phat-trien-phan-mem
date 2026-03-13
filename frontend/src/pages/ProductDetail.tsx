import {
  ArrowLeft,
  Camera,
  Check,
  Heart,
  Loader2,
  RotateCcw,
  Send,
  Shield,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ProductCard from '@/components/ui/ProductCard';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse, PaginatedResponse } from '@/api/types';
import type { Product } from '@/types/product';
import type { Review, CreateReviewPayload } from '@/types/review';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';

export function Component() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.has(product?.id ?? ''));
  const addToCart = useCartStore((s) => s.addItem);
  const { isLoggedIn, isAdmin, user } = useAuthStore();

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [uploadingReviewImage, setUploadingReviewImage] = useState(false);

  const myReview = reviews.find((r) => r.userId === user?.id);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .get<ApiResponse<Product>>(ENDPOINTS.PRODUCTS.BY_ID(id))
      .then((res) => {
        const p = res.data.data;
        setProduct(p);
        return apiClient
          .get<ApiResponse<PaginatedResponse<Product>>>(
            ENDPOINTS.PRODUCTS.BASE,
            {
              params: { size: 100 },
            },
          )
          .then((all) => {
            setRelated(
              all.data.data.content
                .filter((r) => r.brand === p.brand && r.id !== p.id)
                .slice(0, 4),
            );
          });
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setReviewsLoading(true);
    apiClient
      .get<ApiResponse<Review[]>>(ENDPOINTS.REVIEWS.BASE, {
        params: { productId: id },
      })
      .then((res) => setReviews(res.data.data))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!isLoggedIn) {
      setReviewError('Vui lòng đăng nhập để gửi đánh giá');
      return;
    }
    setReviewError('');
    setReviewSubmitting(true);
    try {
      const payload: CreateReviewPayload = {
        productId: id,
        rating: reviewRating,
        comment: reviewComment,
        images: reviewImages.length > 0 ? reviewImages : undefined,
      };
      const res = await apiClient.post<ApiResponse<Review>>(
        ENDPOINTS.REVIEWS.BASE,
        payload,
      );
      setReviews((prev) => [res.data.data, ...prev]);
      setReviewComment('');
      setReviewRating(5);
      setReviewImages([]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setReviewError(
        axiosErr.response?.data?.message ??
          'Không thể gửi đánh giá, thử lại sau',
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await apiClient.delete(ENDPOINTS.REVIEWS.BY_ID(reviewId));
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch {
      // silent fail
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface pt-20 text-text-muted">
        Đang tải...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface pt-20">
        <h1 className="font-display text-2xl font-bold text-brand">
          Sản phẩm không tồn tại
        </h1>
        <p className="mt-2 text-text-secondary">
          Sản phẩm bạn tìm kiếm không có trong hệ thống.
        </p>
        <Link
          to="/products"
          className="btn-primary mt-6 inline-flex items-center gap-2 no-underline"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại cửa hàng
        </Link>
      </div>
    );
  }

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  return (
    <div className="min-h-screen bg-surface pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-6">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 flex items-center gap-2 text-sm text-text-muted"
        >
          <Link
            to="/"
            className="text-text-muted transition-colors hover:text-brand no-underline"
          >
            Trang chủ
          </Link>
          <span>/</span>
          <Link
            to="/products"
            className="text-text-muted transition-colors hover:text-brand no-underline"
          >
            Sản phẩm
          </Link>
          <span>/</span>
          <span className="text-text-secondary">{product.name}</span>
        </motion.nav>

        {/* Product detail */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="relative flex items-center justify-center rounded-3xl bg-surface-alt p-12"
          >
            <motion.img
              src={product.image}
              alt={product.name}
              className="relative z-10 max-h-[400px] w-auto object-contain"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 100 }}
              whileHover={{ scale: 1.05 }}
            />

            {product.badge && (
              <span className="absolute top-6 left-6 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white">
                {product.badge}
              </span>
            )}
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="text-sm font-medium uppercase tracking-widest text-brand-accent">
              {product.brand}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand md:text-4xl">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.floor(product.rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-transparent text-text-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-text-secondary">
                {product.rating.toFixed(1)} · {reviews.length} đánh giá
              </span>
            </div>

            {/* Specs */}
            {product.specs && (
              <p className="mt-4 text-sm text-text-secondary">
                {product.specs}
              </p>
            )}

            {/* Price */}
            <div className="mt-6 flex items-end gap-3">
              <span className="font-display text-4xl font-bold text-brand">
                {product.price.toLocaleString('vi-VN')}₫
              </span>
              {product.originalPrice && (
                <>
                  <span className="text-lg text-text-muted line-through">
                    {product.originalPrice.toLocaleString('vi-VN')}₫
                  </span>
                  <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">
                    -{discount}%
                  </span>
                </>
              )}
            </div>

            {/* Color options (mock) */}
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-text-secondary">
                Màu sắc
              </p>
              <div className="flex gap-2">
                {[
                  'bg-zinc-800',
                  'bg-zinc-400',
                  'bg-amber-700',
                  'bg-blue-900',
                ].map((color, i) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 cursor-pointer rounded-full ${color} ring-2 ring-offset-2 ring-offset-surface transition-all ${
                      i === 0
                        ? 'ring-brand'
                        : 'ring-transparent hover:ring-border-strong'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Storage (mock) */}
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-text-secondary">
                Dung lượng
              </p>
              <div className="flex gap-2">
                {['128GB', '256GB', '512GB', '1TB'].map((size, i) => (
                  <button
                    key={size}
                    type="button"
                    className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                      i === 1
                        ? 'border-brand-accent bg-brand-subtle text-brand-accent'
                        : 'border-border bg-surface text-text-secondary hover:border-border-strong'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock info */}
            <div className="mt-6">
              {product.stock > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                  <Check className="h-3.5 w-3.5" />
                  Còn hàng ({product.stock} sản phẩm)
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                  Hết hàng
                </span>
              )}
            </div>

            {/* CTA - ẩn với admin */}
            {!isAdmin && product.stock > 0 && (
              <div className="mt-8 flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => product && addToCart(product)}
                  className="btn-primary flex flex-1 items-center justify-center gap-2 py-4"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Thêm vào giỏ hàng
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (product) {
                      addToCart(product);
                      navigate('/checkout');
                    }
                  }}
                  className="btn-outline px-6 py-4"
                >
                  Mua ngay
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => product && toggleWishlist(product)}
                  className={`flex aspect-square h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 transition-colors ${
                    isWishlisted
                      ? 'border-red-200 bg-red-50 text-red-500 hover:border-red-300 hover:bg-red-100'
                      : 'border-border bg-surface text-text-secondary hover:border-brand-accent hover:text-brand-accent'
                  }`}
                  aria-label={
                    isWishlisted ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'
                  }
                >
                  <Heart
                    className={`h-6 w-6 ${isWishlisted ? 'fill-current' : ''}`}
                  />
                </motion.button>
              </div>
            )}

            {/* Services */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { icon: Shield, label: 'Bảo hành 12 tháng' },
                { icon: Truck, label: 'Miễn phí giao hàng' },
                { icon: RotateCcw, label: 'Đổi trả 30 ngày' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-alt p-3 text-center"
                >
                  <s.icon className="h-5 w-5 text-brand-accent" />
                  <span className="text-[11px] text-text-secondary">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Highlights */}
            <div className="mt-8 card p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-brand">
                Điểm nổi bật
              </h3>
              <ul className="space-y-2">
                {[
                  'Màn hình Super AMOLED 120Hz',
                  'Chip xử lý thế hệ mới nhất',
                  'Camera AI chuyên nghiệp',
                  'Sạc nhanh 100W',
                  'Kháng nước IP68',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Reviews Section */}
        <section className="mt-20">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-brand">
              Đánh giá sản phẩm
            </h2>
            <span className="text-sm text-text-secondary">
              {reviews.length} đánh giá
            </span>
          </div>

          {/* Submit form - ẩn với admin */}
          {isLoggedIn && !isAdmin && !myReview && (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmitReview}
              className="mb-8 rounded-2xl border border-border bg-surface p-6"
            >
              <p className="mb-4 font-medium text-text-primary">
                Viết đánh giá của bạn
              </p>

              {/* Star selector */}
              <div className="mb-4 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    onMouseEnter={() => setReviewHover(star)}
                    onMouseLeave={() => setReviewHover(0)}
                    className="cursor-pointer p-0.5 transition-transform hover:scale-110"
                    aria-label={`${star} sao`}
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        star <= (reviewHover || reviewRating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-transparent text-text-muted'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-text-secondary">
                  {reviewRating} / 5
                </span>
              </div>

              {/* Comment textarea */}
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
                rows={3}
                maxLength={1000}
                required
                className="w-full resize-none rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {reviewComment.length}/1000
                </span>
              </div>

              {/* Review images */}
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {reviewImages.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        src={url}
                        alt={`Review ${i + 1}`}
                        className="h-20 w-20 rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setReviewImages((prev) =>
                            prev.filter((_, j) => j !== i),
                          )
                        }
                        className="absolute -right-1.5 -top-1.5 cursor-pointer rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {reviewImages.length < 5 && (
                    <label
                      className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors ${
                        uploadingReviewImage
                          ? 'border-brand/30 bg-brand/5'
                          : 'border-border hover:border-brand hover:bg-brand/5'
                      }`}
                    >
                      {uploadingReviewImage ? (
                        <Loader2 className="h-5 w-5 animate-spin text-brand" />
                      ) : (
                        <>
                          <Camera className="h-5 w-5 text-text-muted" />
                          <span className="text-[10px] text-text-muted">
                            Thêm ảnh
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        disabled={uploadingReviewImage}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          e.target.value = '';
                          setUploadingReviewImage(true);
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const res = await apiClient.post<
                              ApiResponse<string>
                            >(ENDPOINTS.REVIEWS.UPLOAD_IMAGE, formData, {
                              headers: {
                                'Content-Type': 'multipart/form-data',
                              },
                            });
                            setReviewImages((prev) => [...prev, res.data.data]);
                          } catch {
                            setReviewError('Upload ảnh thất bại');
                          } finally {
                            setUploadingReviewImage(false);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {reviewImages.length}/5 ảnh (JPEG, PNG, WebP, GIF)
                </p>
              </div>

              {reviewError && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {reviewError}
                </p>
              )}

              <div className="mt-4 flex justify-end">
                <motion.button
                  type="submit"
                  disabled={reviewSubmitting || !reviewComment.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary flex cursor-pointer items-center gap-2 disabled:opacity-60"
                >
                  {reviewSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Gửi đánh giá
                </motion.button>
              </div>
            </motion.form>
          )}

          {!isLoggedIn && (
            <div className="mb-8 rounded-2xl border border-border bg-surface-alt px-6 py-5 text-center">
              <p className="text-sm text-text-secondary">
                <Link
                  to="/login"
                  className="font-medium text-brand hover:underline"
                >
                  Đăng nhập
                </Link>{' '}
                để viết đánh giá sản phẩm.
              </p>
            </div>
          )}

          {/* Reviews list */}
          {reviewsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Star className="h-10 w-10 text-text-muted" />
              <p className="mt-3 text-text-secondary">
                Chưa có đánh giá nào. Hãy là người đầu tiên!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">
                        {review.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {review.username}
                        </p>
                        <p className="text-xs text-text-muted">
                          {new Date(review.createdAt).toLocaleDateString(
                            'vi-VN',
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${
                              s <= review.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-transparent text-text-muted'
                            }`}
                          />
                        ))}
                      </div>
                      {review.userId === user?.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(review.id)}
                          className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="Xóa đánh giá"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    {review.comment}
                  </p>
                  {review.images && review.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.images.map((img, i) => (
                        <a
                          key={i}
                          href={img}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={img}
                            alt={`Review ảnh ${i + 1}`}
                            className="h-20 w-20 rounded-lg border border-border object-cover transition-transform hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-8 font-display text-2xl font-bold text-brand">
              Sản phẩm cùng thương hiệu
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
