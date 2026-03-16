import type { Product } from '@/types/product';

export const featuredProducts: Product[] = [
  {
    id: 'iphone-16-pro-max',
    name: 'iPhone 16 Pro Max',
    brand: 'Apple',
    price: 34990000,
    originalPrice: 37990000,
    image:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-hero-desert-702702_AV1?wid=940&hei=1112&fmt=png-alpha',
    rating: 4.9,
    stock: 24,
    badge: 'Nổi bật',
    specs: '256GB · Titanium · A18 Pro',
  },
  {
    id: 'samsung-galaxy-s25-ultra',
    name: 'Samsung Galaxy S25 Ultra',
    brand: 'Samsung',
    price: 33990000,
    originalPrice: 36990000,
    image:
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-coldsnap-titanium-471198-sm-s938blbdxxv-544691988?$650_519_PNG$',
    rating: 4.8,
    stock: 18,
    badge: 'Mới',
    specs: '256GB · Titanium · Snapdragon 8 Elite',
  },
  {
    id: 'google-pixel-9-pro',
    name: 'Google Pixel 9 Pro',
    brand: 'Google',
    price: 26990000,
    image:
      'https://lcdn.altex.ro/resize/media/catalog/product/G/o/9b82e35b1c54daa67d2e0003e2fec2c6/Google_Pixel_9_Pro_Obsidian_1.jpg',
    rating: 4.7,
    stock: 12,
    specs: '128GB · AI Camera · Tensor G4',
  },
  {
    id: 'xiaomi-15-ultra',
    name: 'Xiaomi 15 Ultra',
    brand: 'Xiaomi',
    price: 23990000,
    originalPrice: 25990000,
    image:
      'https://i02.appmifile.com/images/2025/03/14/c67e6fac-f2ef-4406-aa96-b914449751f0.png',
    rating: 4.6,
    stock: 15,
    badge: 'Giảm giá',
    specs: '512GB · Leica Camera · Snapdragon 8 Elite',
  },
  {
    id: 'oppo-find-x8-pro',
    name: 'OPPO Find X8 Pro',
    brand: 'OPPO',
    price: 24990000,
    image:
      'https://image.oppo.com/content/dam/oppo/common/mkt/v2-2/find-x8-pro-en/navigation/Find-X8-Pro-Space-Black-Navigation-542x540.png',
    rating: 4.5,
    stock: 21,
    specs: '256GB · Hasselblad Camera · Dimensity 9400',
  },
  {
    id: 'nothing-phone-3',
    name: 'Nothing Phone (3)',
    brand: 'Nothing',
    price: 15990000,
    originalPrice: 17990000,
    image:
      'https://nothing.tech/cdn/shop/files/Phone_2a_Plus_Gray_Front.png?v=1721628090&width=800',
    rating: 4.4,
    stock: 30,
    badge: 'Xu hướng',
    specs: '256GB · Glyph Interface · Snapdragon 8s Gen 4',
  },
  {
    id: 'iphone-16',
    name: 'iPhone 16',
    brand: 'Apple',
    price: 24990000,
    originalPrice: 26990000,
    image:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-hero-geo-702702_AV1?wid=940&hei=1112&fmt=png-alpha',
    rating: 4.7,
    stock: 27,
    specs: '128GB · A18 chip · Dynamic Island',
  },
  {
    id: 'samsung-galaxy-a56',
    name: 'Samsung Galaxy A56 5G',
    brand: 'Samsung',
    price: 10990000,
    originalPrice: 12990000,
    image:
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-a56-5g-sm-a566-sm-a566elbdxxv-544048507?$650_519_PNG$',
    rating: 4.3,
    stock: 36,
    badge: 'Bán chạy',
    specs: '128GB · Exynos 1580 · OIS Camera',
  },
];

export const allProducts: Product[] = [
  ...featuredProducts,
  {
    id: 'oneplus-13',
    name: 'OnePlus 13',
    brand: 'OnePlus',
    price: 22990000,
    image:
      'https://oasis.opstatics.com/content/dam/oasis/page/2025/operation/0107/midnight-ocean-800.png',
    rating: 4.6,
    stock: 17,
    specs: '256GB · Snapdragon 8 Elite · 6000mAh',
  },
  {
    id: 'realme-gt7-pro',
    name: 'Realme GT7 Pro',
    brand: 'Realme',
    price: 16990000,
    originalPrice: 18990000,
    image: 'https://image01.realme.net/general/20241120/1732077616673.png',
    rating: 4.4,
    stock: 29,
    badge: 'Giá tốt',
    specs: '256GB · Snapdragon 8 Elite · IP69',
  },
  {
    id: 'vivo-x200-pro',
    name: 'Vivo X200 Pro',
    brand: 'Vivo',
    price: 24990000,
    image:
      'https://www.vivo.com.vn/media/catalog/product/x/2/x200_pro_cosmic_black_3.png',
    rating: 4.5,
    stock: 14,
    specs: '256GB · ZEISS Camera · Dimensity 9400',
  },
  {
    id: 'huawei-pura-70-ultra',
    name: 'Huawei Pura 70 Ultra',
    brand: 'Huawei',
    price: 29990000,
    image:
      'https://consumer.huawei.com/content/dam/huawei-cbg-site/common/mkt/pdp/phones/pura70-ultra/img/design/pura70-ultra-green-back.png',
    rating: 4.3,
    stock: 9,
    specs: '512GB · XMAGE Camera · Kirin 9010',
  },
];
