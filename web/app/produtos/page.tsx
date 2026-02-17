'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Produto, produtosApi } from '@/lib/api';
import { auth } from '@/lib/auth';
import FeedbackModal from '@/components/FeedbackModal';

const LIMITE_POR_PAGINA = 8;

const formatarMoeda = (valor?: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor || 0));

export default function ProdutosPage() {
  const [mounted, setMounted] = useState(false);
  const [usuario, setUsuario] = useState<ReturnType<typeof auth.getUser>>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [modalNovoProdutoAberto, setModalNovoProdutoAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'ATIVO' | 'BLOQUEADO'>('TODOS');
  const [pagina, setPagina] = useState(1);

  const [nomeProduto, setNomeProduto] = useState('');
  const [embalagemProduto, setEmbalagemProduto] = useState('');
  const [precoBaseProduto, setPrecoBaseProduto] = useState('');
  const [imagemUrlProduto, setImagemUrlProduto] = useState('');

  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [editCodigoProduto, setEditCodigoProduto] = useState('');
  const [editNomeProduto, setEditNomeProduto] = useState('');
  const [editEmbalagemProduto, setEditEmbalagemProduto] = useState('');
  const [editPrecoBaseProduto, setEditPrecoBaseProduto] = useState('');
  const [editImagemUrlProduto, setEditImagemUrlProduto] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [processandoAcaoProduto, setProcessandoAcaoProduto] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const precoBaseNumero = Number(precoBaseProduto);
  const podeCriarProduto = Boolean(
    nomeProduto.trim()
      && precoBaseProduto.trim()
      && Number.isFinite(precoBaseNumero)
      && precoBaseNumero > 0
  );

  useEffect(() => {
    setUsuario(auth.getUser());
    setMounted(true);
  }, []);

  const canManageCadastros =
    mounted && (usuario?.perfil === 'admin' || usuario?.perfil === 'backoffice');

  const carregarProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await produtosApi.listar();
      setProdutos(response.data);
      setErro(null);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setErro('Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((produto) => {
      const casaBusca = !termo
        || `${produto.codigo_produto} ${produto.nome} ${produto.embalagem || ''}`
          .toLowerCase()
          .includes(termo);

      const ativo = produto.ativo !== false;
      const casaStatus = filtroStatus === 'TODOS'
        || (filtroStatus === 'ATIVO' && ativo)
        || (filtroStatus === 'BLOQUEADO' && !ativo);

      return casaBusca && casaStatus;
    });
  }, [busca, filtroStatus, produtos]);

  const totalPaginas = Math.max(1, Math.ceil(produtosFiltrados.length / LIMITE_POR_PAGINA));
  const produtosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * LIMITE_POR_PAGINA;
    const fim = inicio + LIMITE_POR_PAGINA;
    return produtosFiltrados.slice(inicio, fim);
  }, [produtosFiltrados, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [busca, filtroStatus]);

  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [pagina, totalPaginas]);

  const criarProduto = async () => {
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para cadastrar produtos.');
      return;
    }
    if (!podeCriarProduto) {
      setErro('Preencha nome do produto e informe um preço base válido maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const codigoGerado = `PR${Date.now().toString().slice(-8)}`;
      await produtosApi.criar({
        codigo_produto: codigoGerado,
        nome: nomeProduto.trim(),
        embalagem: embalagemProduto.trim() || undefined,
        preco_base: precoBaseProduto ? Number(precoBaseProduto) : undefined,
        imagem_url: imagemUrlProduto.trim() || null,
      });
      setNomeProduto('');
      setEmbalagemProduto('');
      setPrecoBaseProduto('');
      setImagemUrlProduto('');
      setModalNovoProdutoAberto(false);
      setSucesso('Produto criado com sucesso.');
      await carregarProdutos();
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      setErro('Não foi possível criar o produto.');
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicaoProduto = (produto: Produto) => {
    setErro(null);
    setSucesso(null);
    setProdutoEditando(produto);
    setEditCodigoProduto(produto.codigo_produto);
    setEditNomeProduto(produto.nome);
    setEditEmbalagemProduto(produto.embalagem || '');
    setEditPrecoBaseProduto(
      produto.preco_base !== undefined && produto.preco_base !== null
        ? String(produto.preco_base)
        : ''
    );
    setEditImagemUrlProduto(produto.imagem_url || '');
  };

  const salvarEdicaoProduto = async () => {
    if (!produtoEditando) return;
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para editar produtos.');
      return;
    }
    if (!editCodigoProduto.trim() || !editNomeProduto.trim()) {
      setErro('Preencha código e nome do produto.');
      return;
    }

    setSalvandoEdicao(true);
    try {
      await produtosApi.atualizar(produtoEditando.id, {
        codigo_produto: editCodigoProduto.trim(),
        nome: editNomeProduto.trim(),
        embalagem: editEmbalagemProduto.trim() || null,
        preco_base: editPrecoBaseProduto ? Number(editPrecoBaseProduto) : null,
        imagem_url: editImagemUrlProduto.trim() || null,
      });
      setSucesso('Produto atualizado com sucesso.');
      setProdutoEditando(null);
      await carregarProdutos();
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      setErro('Não foi possível atualizar o produto.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const alternarBloqueioProduto = async () => {
    if (!produtoEditando) return;
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para bloquear produtos.');
      return;
    }

    setProcessandoAcaoProduto(true);
    try {
      const ativoAtual = produtoEditando.ativo !== false;
      await produtosApi.atualizar(produtoEditando.id, { ativo: !ativoAtual });
      setSucesso(ativoAtual ? 'Produto bloqueado com sucesso.' : 'Produto desbloqueado com sucesso.');
      setProdutoEditando((anterior) =>
        anterior ? { ...anterior, ativo: !ativoAtual } : anterior
      );
      await carregarProdutos();
    } catch (error: any) {
      console.error('Erro ao bloquear/desbloquear produto:', error);
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível atualizar o bloqueio do produto.');
    } finally {
      setProcessandoAcaoProduto(false);
    }
  };

  const excluirProduto = async () => {
    if (!produtoEditando) return;
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para excluir produtos.');
      return;
    }

    setProcessandoAcaoProduto(true);
    try {
      await produtosApi.excluir(produtoEditando.id);
      setSucesso('Produto excluído com sucesso.');
      setProdutoEditando(null);
      setConfirmandoExclusao(false);
      await carregarProdutos();
    } catch (error: any) {
      const status = Number(error?.response?.status ?? error?.status ?? 0);
      const mensagemApi = error?.response?.data?.error as string | undefined;
      if (
        status === 409
        || String(error?.code) === '409'
        || mensagemApi?.includes('vinculados em pedidos')
      ) {
        setErro(mensagemApi || 'Produto possui itens vinculados em pedidos e não pode ser excluído.');
        setConfirmandoExclusao(false);
        setProdutoEditando(null);
      } else {
        setErro(mensagemApi || 'Não foi possível excluir o produto.');
      }
    } finally {
      setProcessandoAcaoProduto(false);
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
                <Image src="/modulos/produtos.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              </span>
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Produtos
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Cadastro e consulta de produtos.
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
              <h2 className="text-xl font-bold text-slate-900">Novo Produto</h2>
              <p className="text-sm text-slate-600">Abra o modal para cadastrar um novo produto.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalNovoProdutoAberto(true)}
              className="btn-primary"
            >
              Novo Produto
            </button>
          </section>
        )}

        <section className="surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_22rem_12rem_1fr] md:items-center">
            <h2 className="text-xl font-bold text-slate-900">Lista de Produtos</h2>
            <input
              type="text"
              placeholder="Buscar por código, nome ou embalagem"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="ui-input"
            />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as 'TODOS' | 'ATIVO' | 'BLOQUEADO')}
              className="ui-input"
            >
              <option value="TODOS">Todos</option>
              <option value="ATIVO">Ativo</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
            <span className="text-sm text-slate-600 font-medium md:text-right">
              {produtosFiltrados.length} produto(s)
            </span>
          </div>

          {loading ? (
            <div className="py-6 text-slate-600">Carregando...</div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="py-6 text-slate-600">Nenhum produto encontrado.</div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
              {produtosPaginados.map((produto) => (
                <div
                  key={produto.id}
                  className="surface surface-strong h-44 p-3 flex flex-col justify-between border-blue-400/70 bg-blue-50/35"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-extrabold text-slate-900">{produto.nome}</h3>
                      <p className="mt-0.5 truncate text-xs text-slate-700">{produto.codigo_produto}</p>
                    </div>
                    <span
                      className={
                        produto.ativo === false
                          ? 'shrink-0 rounded-full border border-slate-400 bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700'
                          : 'shrink-0 rounded-full border border-green-300 bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800'
                      }
                    >
                      {produto.ativo === false ? 'Bloqueado' : 'Ativo'}
                    </span>
                  </div>

                  <div className="rounded-md border border-blue-400/70 bg-blue-100/70 px-2.5 py-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-700">Preço base</p>
                    <p className="text-lg font-extrabold leading-tight text-slate-900">
                      {formatarMoeda(produto.preco_base)}
                    </p>
                  </div>

                  <div className="flex items-end justify-between gap-2 border-t border-slate-200 pt-2">
                    <p className="truncate text-xs text-slate-700">
                      <span className="font-semibold">Emb.:</span> {produto.embalagem || 'N/A'}
                    </p>
                    {canManageCadastros && (
                      <div className="shrink-0 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => abrirEdicaoProduto(produto)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProdutoEditando(produto);
                            setConfirmandoExclusao(true);
                          }}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        {produtoEditando && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
              onClick={() => setProdutoEditando(null)}
            >
              <div
                className="surface surface-strong w-full max-w-lg p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Editar Produto #{produtoEditando.id}</h3>
                    <p className="text-sm text-slate-700">{produtoEditando.codigo_produto}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProdutoEditando(null)}
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
                    <label className="mb-1 block text-sm font-semibold text-slate-800">Código do produto</label>
                    <input
                      type="text"
                      value={editCodigoProduto}
                      onChange={(event) => setEditCodigoProduto(event.target.value)}
                      className="ui-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-800">Nome</label>
                    <input
                      type="text"
                      value={editNomeProduto}
                      onChange={(event) => setEditNomeProduto(event.target.value)}
                      className="ui-input"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-800">Embalagem</label>
                      <input
                        type="text"
                        value={editEmbalagemProduto}
                        onChange={(event) => setEditEmbalagemProduto(event.target.value)}
                        className="ui-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-800">Preço base</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editPrecoBaseProduto}
                        onChange={(event) => setEditPrecoBaseProduto(event.target.value)}
                        className="ui-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-800">URL da imagem (opcional)</label>
                    <input
                      type="text"
                      value={editImagemUrlProduto}
                      onChange={(event) => setEditImagemUrlProduto(event.target.value)}
                      className="ui-input"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600">Status</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {produtoEditando.ativo === false ? 'Bloqueado' : 'Ativo'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={alternarBloqueioProduto}
                      className="nav-icon-link h-10 w-10"
                      disabled={salvandoEdicao || processandoAcaoProduto}
                      aria-label={produtoEditando.ativo === false ? 'Desbloquear produto' : 'Bloquear produto'}
                      title={produtoEditando.ativo === false ? 'Desbloquear produto' : 'Bloquear produto'}
                    >
                      {produtoEditando.ativo === false ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                          <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-9V6a3 3 0 0 1 5.83-.99 1 1 0 1 0 1.94-.49A5 5 0 0 0 12 1Zm0 11a2 2 0 0 1 1 3.73V17a1 1 0 1 1-2 0v-1.27A2 2 0 0 1 12 12Z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                          <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 1 1 6 0v3Zm-3 3a2 2 0 0 1 1 3.73V17a1 1 0 1 1-2 0v-1.27A2 2 0 0 1 12 12Z" />
                        </svg>
        )}

                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoExclusao(true)}
                      className="nav-icon-link h-10 w-10 !text-red-600 hover:!text-red-700"
                      disabled={salvandoEdicao || processandoAcaoProduto}
                      aria-label="Excluir produto"
                      title="Excluir produto"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h.69l.81 12.15A2 2 0 0 0 8.49 21h7.02a2 2 0 0 0 1.99-1.85L18.31 7H19a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm2 2h2V5h-2V5Zm-2.5 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm7 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm-3.5 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProdutoEditando(null)}
                      className="btn-secondary"
                      disabled={salvandoEdicao || processandoAcaoProduto}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={salvarEdicaoProduto}
                      className="btn-primary"
                      disabled={salvandoEdicao || processandoAcaoProduto}
                    >
                      {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {produtoEditando && confirmandoExclusao && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
              onClick={() => setConfirmandoExclusao(false)}
            >
              <div
                className="surface surface-strong w-full max-w-md p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-slate-900">Confirmar exclusão</h3>
                <p className="mt-2 text-sm text-slate-700">
                  Excluir o produto &quot;{produtoEditando.nome}&quot;? Esta ação não pode ser desfeita.
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(false)}
                    className="btn-secondary"
                    disabled={processandoAcaoProduto}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={excluirProduto}
                    className="nav-icon-link-danger h-10 px-3"
                    disabled={processandoAcaoProduto}
                  >
                    {processandoAcaoProduto ? 'Excluindo...' : 'Excluir produto'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && totalPaginas > 1 && (
            <div className="mt-2 flex items-center justify-between">
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
        </section>

        {modalNovoProdutoAberto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => setModalNovoProdutoAberto(false)}
          >
            <div
              className="surface surface-strong w-full max-w-lg p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Novo Produto</h3>
                  <p className="text-sm text-slate-700">Preencha os dados para criar um novo produto.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalNovoProdutoAberto(false)}
                  className="nav-icon-link h-9 w-9"
                  aria-label="Fechar modal de novo produto"
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
                  placeholder="Nome do produto"
                  value={nomeProduto}
                  onChange={(e) => setNomeProduto(e.target.value)}
                  className="ui-input"
                />
                <input
                  type="text"
                  placeholder="Embalagem (opcional)"
                  value={embalagemProduto}
                  onChange={(e) => setEmbalagemProduto(e.target.value)}
                  className="ui-input"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Preço base"
                  value={precoBaseProduto}
                  onChange={(e) => setPrecoBaseProduto(e.target.value)}
                  className="ui-input"
                />
                <input
                  type="text"
                  placeholder="URL da imagem (opcional)"
                  value={imagemUrlProduto}
                  onChange={(e) => setImagemUrlProduto(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoProdutoAberto(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={criarProduto}
                  disabled={saving || !podeCriarProduto}
                  className="btn-primary"
                  title={
                    podeCriarProduto
                      ? 'Criar Produto'
                      : 'Preencha nome e preço base maior que zero'
                  }
                >
                  {saving ? 'Criando...' : 'Criar Produto'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
