/**
 * next/navigation shim for Kiln preview.
 */

export function useRouter() {
  return {
    push: (url: string) => { window.location.href = url; },
    replace: (url: string) => { window.location.replace(url); },
    back: () => { window.history.back(); },
    forward: () => { window.history.forward(); },
    refresh: () => { window.location.reload(); },
    prefetch: () => {},
  };
}

export function usePathname() {
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

export function useSearchParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

export function useParams() {
  return {};
}

export function notFound() {
  throw new Error('Not Found');
}

export function redirect(url: string) {
  window.location.href = url;
}
