import { ArrowRight, Check, Lock, Mail, Smartphone, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import { useAuthStore, type AuthUser } from '@/store/useAuthStore';
import { useWishlistStore } from '@/store/useWishlistStore';

interface AuthResponse {
  token: string;
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export function Component() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const passwordStrength = useMemo(() => {
    if (!password) return { level: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 1) return { level: 1, label: 'Yếu', color: 'bg-red-500' };
    if (score <= 2) return { level: 2, label: 'Trung bình', color: 'bg-yellow-500' };
    if (score <= 3) return { level: 3, label: 'Khá', color: 'bg-blue-500' };
    return { level: 4, label: 'Mạnh', color: 'bg-green-500' };
  }, [password]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!isLogin) {
      if (username && username.length < 3) {
        errors.push('Tên đăng nhập phải có ít nhất 3 ký tự');
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Email không hợp lệ');
      }
      if (password && password.length < 6) {
        errors.push('Mật khẩu phải có ít nhất 6 ký tự');
      }
      if (confirmPassword && password !== confirmPassword) {
        errors.push('Mật khẩu nhập lại không khớp');
      }
    }
    return errors;
  }, [isLogin, username, email, password, confirmPassword]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }

    if (!isLogin && !agreeTerms) {
      setError('Vui lòng đồng ý với điều khoản sử dụng');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? ENDPOINTS.AUTH.LOGIN : ENDPOINTS.AUTH.REGISTER;
      const body = isLogin
        ? { username, password }
        : { username, email, password };
      const res = await apiClient.post<ApiResponse<AuthResponse>>(
        endpoint,
        body,
      );
      const { token, ...user } = res.data.data;
      login(token, user as AuthUser);
      useWishlistStore.getState().fetch();
      
      if (!isLogin) {
        setRegisterSuccess(true);
        setTimeout(() => {
          setIsLogin(true);
          setRegisterSuccess(false);
        }, 2000);
      } else {
        navigate(user.role === 'ADMIN' ? '/admin' : '/');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message ??
          'Đã có lỗi xảy ra, vui lòng thử lại',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="card overflow-hidden bg-surface p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10">
              <Smartphone className="h-6 w-6 text-brand" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              {isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản'}
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              {isLogin
                ? 'Đăng nhập để tiếp tục mua sắm'
                : 'Đăng ký để bắt đầu trải nghiệm'}
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-8 flex rounded-lg bg-surface-alt p-1">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 cursor-pointer rounded-md py-2 text-sm font-medium transition-all ${
                isLogin
                  ? 'bg-surface text-brand shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 cursor-pointer rounded-md py-2 text-sm font-medium transition-all ${
                !isLogin
                  ? 'bg-surface text-brand shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Đăng ký
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username - always visible */}
            <div className="space-y-1">
              <label
                htmlFor="username"
                className="text-xs font-medium text-text-secondary"
              >
                Tên đăng nhập
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-text-muted" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-10 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                  placeholder="username123"
                  required
                />
              </div>
            </div>

            {/* Email - only for register */}
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  key="email-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1">
                    <label
                      htmlFor="email"
                      className="text-xs font-medium text-text-secondary"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-text-muted" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-10 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                        placeholder="email@example.com"
                        required
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-xs font-medium text-text-secondary"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-text-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-10 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {!isLogin && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= passwordStrength.level
                            ? passwordStrength.color
                            : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted">
                    Độ mạnh: <span className={passwordStrength.color.replace('bg-', 'text-')}>{passwordStrength.label}</span>
                  </p>
                </div>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  key="confirm-password-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-1">
                    <label
                      htmlFor="confirmPassword"
                      className="text-xs font-medium text-text-secondary"
                    >
                      Nhập lại mật khẩu
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-text-muted" />
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-10 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-text-muted hover:text-text-secondary"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Terms Checkbox */}
                  <label className="flex cursor-pointer items-start gap-3 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 rounded border-border text-brand focus:ring-brand"
                    />
                    <span>
                      Tôi đồng ý với{' '}
                      <Link to="/terms" className="text-brand hover:underline no-underline">
                        Điều khoản sử dụng
                      </Link>{' '}
                      và{' '}
                      <Link to="/privacy" className="text-brand hover:underline no-underline">
                        Chính sách bảo mật
                      </Link>
                    </span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {isLogin && (
              <div className="flex items-center justify-between">
                <label
                  htmlFor="remember"
                  className="flex items-center gap-2 text-xs text-text-secondary"
                >
                  <input
                    id="remember"
                    type="checkbox"
                    className="rounded border-border text-brand focus:ring-brand"
                  />
                  Ghi nhớ đăng nhập
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-brand hover:underline no-underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                {error}
              </p>
            )}

            {/* Success Message */}
            <AnimatePresence>
              {registerSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-600"
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Đăng ký thành công! Đang chuyển hướng...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || (!isLogin && validationErrors.length > 0)}
              className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </>
              )}
            </button>

            {/* Social Login Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-text-muted">
                  Hoặc tiếp tục với
                </span>
              </div>
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              className="btn-outline flex w-full cursor-pointer items-center justify-center gap-2 transition-all hover:bg-surface-alt"
              onClick={() => {
                window.location.href = `${import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080'}/oauth2/authorization/google`;
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="text-text-primary">Đăng nhập với Google</span>
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
