'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { auth } from '@/lib/auth';
import FeedbackModal from '@/components/FeedbackModal';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [previewNome, setPreviewNome] = useState<string | null>(null);
  const [previewImagem, setPreviewImagem] = useState<string | null>(null);

  useEffect(() => {
    const user = username.trim();
    if (!user) {
      setPreviewNome(null);
      setPreviewImagem(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await authApi.userPreview(user);
        setPreviewNome(response.data.nome);
        setPreviewImagem(response.data.imagem_url);
      } catch {
        setPreviewNome(null);
        setPreviewImagem(null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErro(null);

    try {
      const response = await authApi.login(username, password);
      auth.setSession(response.data.token, response.data.user);
      router.replace('/');
    } catch {
      setErro('Usuário ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell relative flex min-h-screen items-center justify-center overflow-hidden px-3 py-4 sm:px-4 sm:py-6 md:py-8">
      <div
        className="pointer-events-none absolute inset-0 bg-center bg-repeat"
        style={{
          backgroundImage: "url('/telas/fundo_login.png')",
          backgroundSize: '210px auto',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.62),rgba(15,23,42,0.5),rgba(8,47,73,0.58))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.14),transparent_40%),radial-gradient(circle_at_85%_12%,rgba(34,211,238,0.1),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(99,102,241,0.1),transparent_45%)]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/30 bg-slate-50/95 shadow-[0_18px_45px_rgba(2,6,23,0.5)] backdrop-blur sm:rounded-3xl md:grid-cols-[1.08fr_0.92fr]">
        <aside className="relative hidden p-9 md:block">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-950" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_82%_84%,rgba(99,102,241,0.22),transparent_40%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between text-white">
            <div className="space-y-5">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-white/10">
                <Image src="/processado1.png" alt="APPEMP" width={46} height={46} className="h-11 w-11 object-contain" />
              </div>
              <h1 className="text-4xl font-black tracking-tight">APPEMP</h1>
              <p className="max-w-sm text-sm leading-relaxed text-slate-100/95">
                Acesse sua central de operações para gerenciar pedidos, clientes, produtos e rotas.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-300/25 bg-slate-900/25 p-4 backdrop-blur-[1px]">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/90">Ambiente</p>
              <p className="mt-1 text-base font-semibold">Sistema de Pedidos</p>
              <div className="mt-3 h-px w-full bg-cyan-100/20" />
              <p className="mt-3 text-xs text-slate-200/90">Operação segura e sincronizada em tempo real.</p>
            </div>
          </div>
        </aside>

        <section className="bg-slate-50/92 p-4 sm:p-6 md:p-8">
          <div className="mb-4 flex items-center gap-3 md:hidden">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50">
              <Image src="/processado1.png" alt="APPEMP" width={34} height={34} className="h-8 w-8 object-contain" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">APPEMP</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-[1.75rem] font-extrabold tracking-tight text-slate-900 sm:text-[2rem]">Login APPEMP</h2>
            <p className="text-sm text-slate-600">Entre para acessar o painel de pedidos.</p>
          </div>
          <div className="mt-4 rounded-xl border border-slate-300/80 bg-white/92 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.1)] sm:mt-6 sm:rounded-2xl sm:p-5">
            {(previewImagem || previewNome) && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2.5 sm:px-4 sm:py-3">
                {previewImagem ? (
                  <img
                    src={previewImagem}
                    alt={previewNome || 'Usuário'}
                    className="h-14 w-14 rounded-full border-2 border-blue-200 object-cover sm:h-16 sm:w-16"
                  />
                ) : (
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-200 bg-white text-lg font-bold text-blue-700 sm:h-16 sm:w-16 sm:text-xl">
                    {(previewNome || username).trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Usuário identificado</p>
                  <p className="truncate text-base font-bold text-slate-900">
                    {previewNome || username}
                  </p>
                </div>
              </div>
            )}

            <FeedbackModal
              open={Boolean(erro)}
              variant="error"
              message={erro || ''}
              onClose={() => setErro(null)}
            />

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Usuário</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="ui-input"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ui-input"
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 text-base font-bold"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
