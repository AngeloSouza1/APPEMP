'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { auth } from '@/lib/auth';

const PUBLIC_PATHS = ['/login'];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isLoggedIn = auth.isAuthenticated();
  const user = auth.getUser();

  const vendedorPermitido =
    pathname === '/' ||
    pathname.startsWith('/pedidos') ||
    pathname.startsWith('/trocar-senha');
  const motoristaPermitido =
    vendedorPermitido ||
    pathname.startsWith('/remaneio');
  const backofficePermitido = !pathname.startsWith('/usuarios');

  useEffect(() => {
    if (!isPublic && !isLoggedIn) {
      router.replace('/login');
      return;
    }

    if (isPublic && isLoggedIn) {
      router.replace('/');
      return;
    }

    if (!isPublic && isLoggedIn && user) {
      if (user.perfil === 'vendedor' && !vendedorPermitido) {
        router.replace('/');
        return;
      }

      if (user.perfil === 'motorista' && !motoristaPermitido) {
        router.replace('/');
        return;
      }

      if (user.perfil === 'backoffice' && !backofficePermitido) {
        router.replace('/');
        return;
      }

      return;
    }
  }, [backofficePermitido, isLoggedIn, isPublic, motoristaPermitido, router, user, vendedorPermitido]);

  return <>{children}</>;
}
