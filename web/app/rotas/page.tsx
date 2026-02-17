'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Rota, rotasApi } from '@/lib/api';
import { auth } from '@/lib/auth';
import FeedbackModal from '@/components/FeedbackModal';

const LIMITE_POR_PAGINA = 8;

export default function RotasPage() {
  const [mounted, setMounted] = useState(false);
  const [usuario, setUsuario] = useState<ReturnType<typeof auth.getUser>>(null);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [modalNovaRotaAberto, setModalNovaRotaAberto] = useState(false);

  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  const [nomeRota, setNomeRota] = useState('');
  const [imagemUrlRota, setImagemUrlRota] = useState('');

  const [rotaEditando, setRotaEditando] = useState<Rota | null>(null);
  const [editNomeRota, setEditNomeRota] = useState('');
  const [editImagemUrlRota, setEditImagemUrlRota] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  useEffect(() => {
    setUsuario(auth.getUser());
    setMounted(true);
  }, []);

  const canManageCadastros =
    mounted && (usuario?.perfil === 'admin' || usuario?.perfil === 'backoffice');

  const carregarRotas = useCallback(async () => {
    setLoading(true);
    try {
      const response = await rotasApi.listar();
      setRotas(response.data);
      setErro(null);
    } catch (error) {
      console.error('Erro ao carregar rotas:', error);
      setErro('Não foi possível carregar as rotas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarRotas();
  }, [carregarRotas]);

  const rotasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return rotas;
    return rotas.filter((rota) =>
      `${rota.nome} ${rota.id}`.toLowerCase().includes(termo)
    );
  }, [busca, rotas]);

  const totalPaginas = Math.max(1, Math.ceil(rotasFiltradas.length / LIMITE_POR_PAGINA));
  const rotasPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * LIMITE_POR_PAGINA;
    const fim = inicio + LIMITE_POR_PAGINA;
    return rotasFiltradas.slice(inicio, fim);
  }, [rotasFiltradas, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [busca]);

  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [pagina, totalPaginas]);

  const criarRota = async () => {
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para cadastrar rotas.');
      return;
    }
    if (!nomeRota.trim()) {
      setErro('Informe o nome da rota.');
      return;
    }

    setSaving(true);
    try {
      await rotasApi.criar({ nome: nomeRota.trim(), imagem_url: imagemUrlRota.trim() || null });
      setNomeRota('');
      setImagemUrlRota('');
      setModalNovaRotaAberto(false);
      setSucesso('Rota criada com sucesso.');
      await carregarRotas();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível criar a rota.');
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicaoRota = (rota: Rota) => {
    setErro(null);
    setSucesso(null);
    setRotaEditando(rota);
    setEditNomeRota(rota.nome);
    setEditImagemUrlRota(rota.imagem_url || '');
  };

  const salvarEdicaoRota = async () => {
    if (!rotaEditando) return;
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para editar rotas.');
      return;
    }
    if (!editNomeRota.trim()) {
      setErro('Informe o nome da rota.');
      return;
    }

    setSalvandoEdicao(true);
    try {
      await rotasApi.atualizar(rotaEditando.id, {
        nome: editNomeRota.trim(),
        imagem_url: editImagemUrlRota.trim() || null,
      });
      setSucesso('Rota atualizada com sucesso.');
      setRotaEditando(null);
      await carregarRotas();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível atualizar a rota.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const excluirRota = async () => {
    if (!rotaEditando) return;
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para excluir rotas.');
      return;
    }

    setProcessandoAcao(true);
    try {
      await rotasApi.excluir(rotaEditando.id);
      setSucesso('Rota excluída com sucesso.');
      setRotaEditando(null);
      setConfirmandoExclusao(false);
      await carregarRotas();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível excluir a rota.');
      setConfirmandoExclusao(false);
      setRotaEditando(null);
    } finally {
      setProcessandoAcao(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <nav className="surface p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span
                className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700"
                aria-hidden="true"
              >
                <Image src="/modulos/rotas.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              </span>
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Rotas
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Cadastro e edição de rotas de entrega.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link href="/" className="btn-secondary">
                Voltar
              </Link>
            </div>
          </div>
        </nav>

        <FeedbackModal
          open={Boolean(erro)}
          variant="error"
          message={erro || ''}
          onClose={() => setErro(null)}
        />
        <FeedbackModal
          open={Boolean(sucesso)}
          variant="success"
          message={sucesso || ''}
          onClose={() => setSucesso(null)}
        />

        {canManageCadastros && (
          <section className="surface p-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Nova Rota</h2>
              <p className="text-sm text-slate-600">Abra o modal para cadastrar uma nova rota.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalNovaRotaAberto(true)}
              className="btn-primary"
            >
              Nova Rota
            </button>
          </section>
        )}

        <section className="surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_22rem_1fr] md:items-center">
            <h2 className="text-xl font-bold text-slate-900">Lista de Rotas</h2>
            <input
              type="text"
              placeholder="Buscar por nome ou ID"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              className="ui-input"
            />
            <span className="text-sm text-slate-600 font-medium md:text-right">
              {rotasFiltradas.length} rota(s)
            </span>
          </div>

          {loading ? (
            <div className="py-6 text-slate-600">Carregando...</div>
          ) : rotasFiltradas.length === 0 ? (
            <div className="py-6 text-slate-600">Nenhuma rota encontrada.</div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
              {rotasPaginadas.map((rota) => (
                <div
                  key={rota.id}
                  className="surface surface-strong h-40 p-3 flex flex-col justify-between border-blue-400/70 bg-blue-50/35"
                >
                  <div>
                    <h3 className="truncate text-lg font-extrabold text-slate-900">{rota.nome}</h3>
                    <p className="mt-0.5 text-xs text-slate-700">Rota de entrega</p>
                  </div>

                  <div className="rounded-md border border-blue-400/70 bg-blue-100/70 px-2.5 py-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-700">Código interno</p>
                    <p className="text-lg font-extrabold leading-tight text-slate-900">#{rota.id}</p>
                    <p className="mt-1 text-xs text-slate-700">
                      Clientes: {rota.clientes_vinculados ?? 0} • Pedidos: {rota.pedidos_vinculados ?? 0}
                    </p>
                  </div>

                  {canManageCadastros && (
                    <div className="flex items-end justify-end gap-3 border-t border-slate-200 pt-2">
                      <button
                        type="button"
                        onClick={() => abrirEdicaoRota(rota)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRotaEditando(rota);
                          setEditNomeRota(rota.nome);
                          setConfirmandoExclusao(true);
                        }}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPagina((prev) => Math.max(prev - 1, 1))}
              disabled={pagina <= 1}
              className="btn-secondary disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-700 font-semibold">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((prev) => Math.min(prev + 1, totalPaginas))}
              disabled={pagina >= totalPaginas}
              className="btn-secondary disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </section>

        {rotaEditando && !confirmandoExclusao && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => setRotaEditando(null)}
          >
            <div
              className="surface surface-strong w-full max-w-lg p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Editar Rota #{rotaEditando.id}</h3>
                  <p className="text-sm text-slate-700">{rotaEditando.nome}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRotaEditando(null)}
                  className="nav-icon-link h-9 w-9"
                  aria-label="Fechar modal de edição"
                  title="Fechar"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293a1 1 0 1 0-1.414-1.414L12 10.586 6.707 5.293Z" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800">Nome da rota</label>
                <input
                  type="text"
                  value={editNomeRota}
                  onChange={(event) => setEditNomeRota(event.target.value)}
                  className="ui-input"
                />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">URL da imagem (opcional)</label>
                  <input
                    type="text"
                    value={editImagemUrlRota}
                    onChange={(event) => setEditImagemUrlRota(event.target.value)}
                    className="ui-input"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(true)}
                    className="nav-icon-link h-10 w-10 !text-red-600 hover:!text-red-700"
                    disabled={salvandoEdicao || processandoAcao}
                    aria-label="Excluir rota"
                    title="Excluir rota"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                      <path d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h.69l.81 12.15A2 2 0 0 0 8.49 21h7.02a2 2 0 0 0 1.99-1.85L18.31 7H19a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm2 2h2V5h-2V5Zm-2.5 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm7 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm-3.5 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRotaEditando(null)}
                    className="btn-secondary"
                    disabled={salvandoEdicao || processandoAcao}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarEdicaoRota}
                    className="btn-primary"
                    disabled={salvandoEdicao || processandoAcao}
                  >
                    {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {rotaEditando && confirmandoExclusao && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
            onClick={() => {
              setConfirmandoExclusao(false);
              setRotaEditando(null);
            }}
          >
            <div
              className="surface surface-strong w-full max-w-md p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900">Confirmar exclusão</h3>
              <p className="mt-2 text-sm text-slate-700">
                Excluir a rota <strong>{rotaEditando.nome}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setConfirmandoExclusao(false);
                    setRotaEditando(null);
                  }}
                  disabled={processandoAcao}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary !bg-red-600 hover:!bg-red-700"
                  onClick={excluirRota}
                  disabled={processandoAcao}
                >
                  {processandoAcao ? 'Excluindo...' : 'Excluir rota'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modalNovaRotaAberto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => setModalNovaRotaAberto(false)}
          >
            <div
              className="surface surface-strong w-full max-w-lg p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Nova Rota</h3>
                  <p className="text-sm text-slate-700">Preencha o nome para criar a rota.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalNovaRotaAberto(false)}
                  className="nav-icon-link h-9 w-9"
                  aria-label="Fechar modal de nova rota"
                  title="Fechar"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293a1 1 0 1 0-1.414-1.414L12 10.586 6.707 5.293Z" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nome da rota"
                  value={nomeRota}
                  onChange={(event) => setNomeRota(event.target.value)}
                  className="ui-input"
                />
                <input
                  type="text"
                  placeholder="URL da imagem (opcional)"
                  value={imagemUrlRota}
                  onChange={(event) => setImagemUrlRota(event.target.value)}
                  className="ui-input"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovaRotaAberto(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={criarRota}
                  disabled={saving || !nomeRota.trim()}
                  className="btn-primary"
                  title={nomeRota.trim() ? 'Criar Rota' : 'Informe o nome da rota'}
                >
                  {saving ? 'Criando...' : 'Criar Rota'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
