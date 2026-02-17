'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Usuario, usuariosApi } from '@/lib/api';
import { auth } from '@/lib/auth';
import FeedbackModal from '@/components/FeedbackModal';

const PERFIS = ['admin', 'backoffice', 'vendedor', 'motorista'] as const;

type Perfil = (typeof PERFIS)[number];
type SortBy = 'id' | 'nome' | 'login' | 'perfil' | 'ativo' | 'criado_em';
type SortDir = 'asc' | 'desc';

export default function UsuariosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [usuarioLogado, setUsuarioLogado] = useState<ReturnType<typeof auth.getUser>>(null);
  const isAdmin = usuarioLogado?.perfil === 'admin';

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState<string>('');
  const [filtroAtivo, setFiltroAtivo] = useState<string>('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>('id');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const LIMITE_POR_PAGINA = 10;
  const [queryLoaded, setQueryLoaded] = useState(false);

  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('vendedor');
  const [modalNovoUsuarioAberto, setModalNovoUsuarioAberto] = useState(false);
  const [criandoUsuario, setCriandoUsuario] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editLogin, setEditLogin] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editPerfil, setEditPerfil] = useState<Perfil>('vendedor');
  const [editAtivo, setEditAtivo] = useState(true);
  const [editSenha, setEditSenha] = useState('');
  const [editImagemUrl, setEditImagemUrl] = useState('');
  const [processandoAcaoUsuario, setProcessandoAcaoUsuario] = useState(false);
  const [confirmandoExclusaoUsuario, setConfirmandoExclusaoUsuario] = useState(false);

  useEffect(() => {
    setUsuarioLogado(auth.getUser());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') ?? '';
    const perfil = params.get('perfil');
    const ativo = params.get('ativo');
    const page = Number(params.get('page'));
    const sortByParam = params.get('sort_by');
    const sortDirParam = params.get('sort_dir');
    const allowedSortBy: SortBy[] = ['id', 'nome', 'login', 'perfil', 'ativo', 'criado_em'];

    setBusca(q);
    setFiltroPerfil(PERFIS.includes((perfil ?? '') as Perfil) ? (perfil as Perfil) : '');
    setFiltroAtivo(ativo === 'true' || ativo === 'false' ? ativo : '');
    setPagina(Number.isFinite(page) && page > 0 ? page : 1);
    setSortBy(allowedSortBy.includes(sortByParam as SortBy) ? (sortByParam as SortBy) : 'id');
    setSortDir(sortDirParam === 'asc' || sortDirParam === 'desc' ? sortDirParam : 'desc');
    setQueryLoaded(true);
  }, []);

  const carregarUsuarios = useCallback(async () => {
    if (!queryLoaded) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await usuariosApi.listar({
        q: busca.trim() || undefined,
        perfil: (filtroPerfil || undefined) as Perfil | undefined,
        ativo:
          filtroAtivo === ''
            ? undefined
            : filtroAtivo === 'true'
              ? true
              : false,
        page: pagina,
        limit: LIMITE_POR_PAGINA,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setUsuarios(response.data.data);
      setTotalPaginas(response.data.totalPages);
      setTotalRegistros(response.data.total);
      setErro(null);
    } catch (error: unknown) {
      const maybeError = error as { response?: { status?: number; data?: { error?: string } } };
      if (maybeError?.response?.status === 403) {
        setErro('Você não tem permissão para acessar esta área.');
      } else {
        setErro(maybeError?.response?.data?.error || 'Erro ao carregar usuários.');
      }
    } finally {
      setLoading(false);
    }
  }, [busca, filtroAtivo, filtroPerfil, isAdmin, pagina, queryLoaded, sortBy, sortDir]);

  useEffect(() => {
    carregarUsuarios();
  }, [carregarUsuarios]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (busca.trim()) params.set('q', busca.trim());
    if (filtroPerfil) params.set('perfil', filtroPerfil);
    if (filtroAtivo) params.set('ativo', filtroAtivo);
    if (pagina > 1) params.set('page', String(pagina));
    if (sortBy !== 'id') params.set('sort_by', sortBy);
    if (sortDir !== 'desc') params.set('sort_dir', sortDir);

    const nextQuery = params.toString();
    const currentQuery =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).toString()
        : '';
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    }
  }, [busca, filtroAtivo, filtroPerfil, pagina, pathname, router, sortBy, sortDir]);

  const limparFormNovo = () => {
    setNome('');
    setLogin('');
    setSenha('');
    setImagemUrl('');
    setPerfil('vendedor');
  };

  const fecharModalNovoUsuario = () => {
    setModalNovoUsuarioAberto(false);
    limparFormNovo();
  };

  const criarUsuario = async () => {
    setErro(null);
    setSucesso(null);

    if (!nome || !login || !senha) {
      setErro('Preencha nome, login e senha.');
      return;
    }

    setCriandoUsuario(true);
    try {
      await usuariosApi.criar({
        nome,
        login,
        senha,
        perfil,
        ativo: true,
        imagem_url: imagemUrl.trim() || null,
      });
      setSucesso('Usuário criado com sucesso.');
      limparFormNovo();
      setModalNovoUsuarioAberto(false);
      await carregarUsuarios();
    } catch (error: unknown) {
      const maybeError = error as { response?: { data?: { error?: string } } };
      setErro(maybeError?.response?.data?.error || 'Erro ao criar usuário.');
    } finally {
      setCriandoUsuario(false);
    }
  };

  const iniciarEdicao = (usuario: Usuario) => {
    setEditandoId(usuario.id);
    setEditLogin(usuario.login);
    setEditNome(usuario.nome);
    setEditPerfil(usuario.perfil);
    setEditAtivo(Boolean(usuario.ativo));
    setEditSenha('');
    setEditImagemUrl(usuario.imagem_url || '');
    setConfirmandoExclusaoUsuario(false);
    setErro(null);
    setSucesso(null);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditLogin('');
    setEditNome('');
    setEditPerfil('vendedor');
    setEditAtivo(true);
    setEditSenha('');
    setEditImagemUrl('');
    setConfirmandoExclusaoUsuario(false);
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;

    try {
      await usuariosApi.atualizar(editandoId, {
        nome: editNome,
        perfil: editPerfil,
        ativo: editAtivo,
        senha: editSenha || undefined,
        imagem_url: editImagemUrl.trim() || null,
      });

      setSucesso('Usuário atualizado com sucesso.');
      cancelarEdicao();
      await carregarUsuarios();
    } catch (error: unknown) {
      const maybeError = error as { response?: { data?: { error?: string } } };
      setErro(maybeError?.response?.data?.error || 'Erro ao atualizar usuário.');
    }
  };

  const excluirUsuario = async () => {
    if (!editandoId) return;
    setErro(null);
    setSucesso(null);
    setProcessandoAcaoUsuario(true);
    try {
      await usuariosApi.excluir(editandoId);
      setSucesso('Usuário excluído com sucesso.');
      cancelarEdicao();
      await carregarUsuarios();
    } catch (error: unknown) {
      const maybeError = error as { response?: { data?: { error?: string } } };
      setErro(maybeError?.response?.data?.error || 'Erro ao excluir usuário.');
      setConfirmandoExclusaoUsuario(false);
    } finally {
      setProcessandoAcaoUsuario(false);
    }
  };

  const alternarBloqueioUsuario = async () => {
    if (!editandoId) return;
    setErro(null);
    setSucesso(null);
    setProcessandoAcaoUsuario(true);
    try {
      const ativoAtual = Boolean(editAtivo);
      await usuariosApi.atualizar(editandoId, { ativo: !ativoAtual });
      setEditAtivo(!ativoAtual);
      setSucesso(ativoAtual ? 'Usuário bloqueado com sucesso.' : 'Usuário desbloqueado com sucesso.');
      await carregarUsuarios();
    } catch (error: unknown) {
      const maybeError = error as { response?: { data?: { error?: string } } };
      setErro(maybeError?.response?.data?.error || 'Erro ao atualizar bloqueio do usuário.');
    } finally {
      setProcessandoAcaoUsuario(false);
    }
  };

  const trocarOrdenacao = (coluna: SortBy) => {
    if (sortBy === coluna) {
      setSortDir((valorAtual) => (valorAtual === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(coluna);
      setSortDir('asc');
    }
    setPagina(1);
  };

  const indicadorOrdenacao = (coluna: SortBy) => {
    if (sortBy !== coluna) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  if (!isAdmin) {
    if (!mounted) {
      return (
        <div className="app-shell flex items-center justify-center px-4">
          <p className="text-slate-600">Carregando...</p>
        </div>
      );
    }

    return (
      <div className="app-shell flex items-center justify-center px-4">
        <div className="surface p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Acesso restrito</h1>
          <p className="text-sm text-slate-600 mb-4">
            Apenas usuários com perfil admin podem acessar a gestão de usuários.
          </p>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Voltar para a tela principal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <nav className="surface p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span
                className="inline-flex h-16 w-16 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700"
                aria-hidden="true"
              >
                <Image src="/modulos/usuarios.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              </span>
              <div>
                <h1 className="top-title">Usuários</h1>
                <p className="text-sm text-slate-600">
                  Gestão de acesso e perfis do sistema.
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

        <div className="surface p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Buscar por nome/login"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              className="ui-input"
            />
            <select
              value={filtroPerfil}
              onChange={(e) => {
                setFiltroPerfil(e.target.value);
                setPagina(1);
              }}
              className="ui-select"
            >
              <option value="">Todos os perfis</option>
              {PERFIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={filtroAtivo}
              onChange={(e) => {
                setFiltroAtivo(e.target.value);
                setPagina(1);
              }}
              className="ui-select"
            >
              <option value="">Ativo/Inativo</option>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
            <div className="flex items-center text-sm text-slate-600 font-medium">
              {totalRegistros} usuário(s)
            </div>
          </div>
        </div>

        <div className="surface p-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Novo Usuário</h2>
            <p className="text-sm text-slate-600">Crie usuários em modal para manter a tela mais organizada.</p>
          </div>
          <button
            type="button"
            onClick={() => setModalNovoUsuarioAberto(true)}
            className="btn-primary"
          >
            Novo Usuário
          </button>
        </div>

        <div className="surface overflow-hidden">
          {loading ? (
            <div className="p-6 text-slate-600">Carregando...</div>
          ) : usuarios.length === 0 ? (
            <div className="p-6 text-slate-600">Nenhum usuário encontrado.</div>
          ) : (
            <div
              className={`overflow-x-auto ${usuarios.length >= 4 ? 'max-h-[380px] overflow-y-auto' : ''}`}
            >
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3">
                      <button type="button" onClick={() => trocarOrdenacao('id')}>
                        ID{indicadorOrdenacao('id')}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">
                      <button type="button" onClick={() => trocarOrdenacao('nome')}>
                        Nome{indicadorOrdenacao('nome')}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">
                      <button type="button" onClick={() => trocarOrdenacao('login')}>
                        Login{indicadorOrdenacao('login')}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">
                      <button type="button" onClick={() => trocarOrdenacao('perfil')}>
                        Perfil{indicadorOrdenacao('perfil')}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">
                      <button type="button" onClick={() => trocarOrdenacao('ativo')}>
                        Ativo{indicadorOrdenacao('ativo')}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{usuario.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {usuario.imagem_url ? (
                            <img
                              src={usuario.imagem_url}
                              alt={usuario.nome}
                              className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
                              {usuario.nome?.trim()?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          )}
                          <span>{usuario.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{usuario.login}</td>
                      <td className="px-4 py-3">{usuario.perfil}</td>
                      <td className="px-4 py-3">{usuario.ativo ? 'Sim' : 'Não'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(usuario)}
                          className="btn-primary"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editandoId !== null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={cancelarEdicao}
          >
            <div
              className="surface surface-strong w-full max-w-lg p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Editar Usuário #{editandoId}</h3>
                  <p className="text-sm text-slate-700">{editLogin}</p>
                </div>
                <button
                  type="button"
                  onClick={cancelarEdicao}
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
                  <label className="mb-1 block text-sm font-semibold text-slate-800">Nome</label>
                  <input
                    type="text"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="ui-input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">Perfil</label>
                  <select
                    value={editPerfil}
                    onChange={(e) => setEditPerfil(e.target.value as Perfil)}
                    className="ui-select"
                  >
                    {PERFIS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">URL da imagem (opcional)</label>
                  <input
                    type="text"
                    value={editImagemUrl}
                    onChange={(e) => setEditImagemUrl(e.target.value)}
                    className="ui-input"
                    placeholder="https://..."
                  />
                </div>
                <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Status</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {editAtivo ? 'Ativo' : 'Bloqueado'}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">Nova senha (opcional)</label>
                  <input
                    type="password"
                    value={editSenha}
                    onChange={(e) => setEditSenha(e.target.value)}
                    className="ui-input"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={alternarBloqueioUsuario}
                    className="nav-icon-link h-10 w-10"
                    disabled={processandoAcaoUsuario}
                    aria-label={editAtivo ? 'Bloquear usuário' : 'Desbloquear usuário'}
                    title={editAtivo ? 'Bloquear usuário' : 'Desbloquear usuário'}
                  >
                    {editAtivo ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 1 1 6 0v3Zm-3 3a2 2 0 0 1 1 3.73V17a1 1 0 1 1-2 0v-1.27A2 2 0 0 1 12 12Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-9V6a3 3 0 0 1 5.83-.99 1 1 0 1 0 1.94-.49A5 5 0 0 0 12 1Zm0 11a2 2 0 0 1 1 3.73V17a1 1 0 1 1-2 0v-1.27A2 2 0 0 1 12 12Z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusaoUsuario(true)}
                    className="nav-icon-link h-10 w-10 !text-red-600 hover:!text-red-700"
                    disabled={processandoAcaoUsuario}
                    aria-label="Excluir usuário"
                    title="Excluir usuário"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                      <path d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h.69l.81 12.15A2 2 0 0 0 8.49 21h7.02a2 2 0 0 0 1.99-1.85L18.31 7H19a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm2 2h2V5h-2V5Zm-2.5 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm7 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm-3.5 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={cancelarEdicao}
                    className="btn-secondary"
                    disabled={processandoAcaoUsuario}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarEdicao}
                    className="btn-primary"
                    disabled={processandoAcaoUsuario}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {modalNovoUsuarioAberto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={fecharModalNovoUsuario}
          >
            <div
              className="surface surface-strong w-full max-w-lg p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Novo Usuário</h3>
                  <p className="text-sm text-slate-700">Preencha os dados para criar um novo acesso.</p>
                </div>
                <button
                  type="button"
                  onClick={fecharModalNovoUsuario}
                  className="nav-icon-link h-9 w-9"
                  aria-label="Fechar modal de novo usuário"
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
                  placeholder="Nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="ui-input"
                />
                <input
                  type="text"
                  placeholder="Login"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="ui-input"
                />
                <input
                  type="password"
                  placeholder="Senha (mín. 6)"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="ui-input"
                />
                <input
                  type="text"
                  placeholder="URL da imagem (opcional)"
                  value={imagemUrl}
                  onChange={(e) => setImagemUrl(e.target.value)}
                  className="ui-input"
                />
                <select
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value as Perfil)}
                  className="ui-select"
                >
                  {PERFIS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={fecharModalNovoUsuario}
                  className="btn-secondary"
                  disabled={criandoUsuario}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={criarUsuario}
                  className="btn-primary"
                  disabled={criandoUsuario}
                >
                  {criandoUsuario ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </div>
          </div>
        )}

        {editandoId !== null && confirmandoExclusaoUsuario && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
            onClick={() => setConfirmandoExclusaoUsuario(false)}
          >
            <div
              className="surface surface-strong w-full max-w-md p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900">Confirmar exclusão</h3>
              <p className="mt-2 text-sm text-slate-700">
                Excluir o usuário <strong>{editNome}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setConfirmandoExclusaoUsuario(false)}
                  disabled={processandoAcaoUsuario}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary !bg-red-600 hover:!bg-red-700"
                  onClick={excluirUsuario}
                  disabled={processandoAcaoUsuario}
                >
                  {processandoAcaoUsuario ? 'Excluindo...' : 'Excluir usuário'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && totalPaginas > 1 && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => setPagina((valorAtual) => Math.max(valorAtual - 1, 1))}
              className="btn-pagination"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-600 font-medium">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={pagina >= totalPaginas}
              onClick={() =>
                setPagina((valorAtual) => Math.min(valorAtual + 1, totalPaginas))
              }
              className="btn-pagination"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
