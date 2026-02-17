'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cliente, clienteProdutosApi, ClienteProduto, clientesApi, Produto, produtosApi } from '@/lib/api';
import { auth } from '@/lib/auth';
import FeedbackModal from '@/components/FeedbackModal';

const LIMITE_POR_PAGINA = 8;

const formatarMoeda = (valor?: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor || 0));

export default function ClienteProdutosPage() {
  const [mounted, setMounted] = useState(false);
  const [usuario, setUsuario] = useState<ReturnType<typeof auth.getUser>>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [relacoes, setRelacoes] = useState<ClienteProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [modalNovoVinculoAberto, setModalNovoVinculoAberto] = useState(false);

  const [clienteId, setClienteId] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');

  const [busca, setBusca] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [pagina, setPagina] = useState(1);

  const [relacaoEditando, setRelacaoEditando] = useState<ClienteProduto | null>(null);
  const [editValorUnitario, setEditValorUnitario] = useState('');
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  useEffect(() => {
    setUsuario(auth.getUser());
    setMounted(true);
  }, []);

  const canManageCadastros =
    mounted && (usuario?.perfil === 'admin' || usuario?.perfil === 'backoffice');

  const carregarDados = useCallback(async () => {
    if (mounted && !canManageCadastros) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [clientesResp, produtosResp, relacoesResp] = await Promise.all([
        clientesApi.listar(),
        produtosApi.listar(),
        clienteProdutosApi.listar(),
      ]);
      setClientes(clientesResp.data);
      setProdutos(produtosResp.data);
      setRelacoes(relacoesResp.data);
      setErro(null);
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível carregar os vínculos de cliente/produto.');
    } finally {
      setLoading(false);
    }
  }, [canManageCadastros, mounted]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const relacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return relacoes.filter((relacao) => {
      const matchCliente = !filtroCliente || String(relacao.cliente_id) === filtroCliente;
      const matchBusca = !termo
        || `${relacao.codigo_cliente || ''} ${relacao.cliente_nome || ''} ${relacao.codigo_produto || ''} ${relacao.produto_nome || ''}`
          .toLowerCase()
          .includes(termo);
      return matchCliente && matchBusca;
    });
  }, [busca, filtroCliente, relacoes]);

  const totalPaginas = Math.max(1, Math.ceil(relacoesFiltradas.length / LIMITE_POR_PAGINA));
  const valorUnitarioNumero = Number(valorUnitario);
  const podeCriarVinculo =
    Boolean(clienteId) &&
    Boolean(produtoId) &&
    valorUnitario.trim() !== '' &&
    Number.isFinite(valorUnitarioNumero) &&
    valorUnitarioNumero > 0;

  const relacoesPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * LIMITE_POR_PAGINA;
    const fim = inicio + LIMITE_POR_PAGINA;
    return relacoesFiltradas.slice(inicio, fim);
  }, [pagina, relacoesFiltradas]);

  useEffect(() => {
    setPagina(1);
  }, [busca, filtroCliente]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const criarRelacao = async () => {
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para cadastrar vínculos.');
      return;
    }
    if (!podeCriarVinculo) {
      setErro('Selecione cliente, produto e informe um valor unitário positivo.');
      return;
    }

    setSaving(true);
    try {
      await clienteProdutosApi.criar({
        cliente_id: Number(clienteId),
        produto_id: Number(produtoId),
        valor_unitario: valorUnitarioNumero,
      });
      setClienteId('');
      setProdutoId('');
      setValorUnitario('');
      setModalNovoVinculoAberto(false);
      setSucesso('Vínculo cliente/produto criado com sucesso.');
      await carregarDados();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível criar o vínculo.');
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicao = (relacao: ClienteProduto) => {
    setErro(null);
    setSucesso(null);
    setRelacaoEditando(relacao);
    setEditValorUnitario(String(relacao.valor_unitario ?? ''));
    setConfirmandoExclusao(false);
  };

  const salvarEdicao = async () => {
    if (!relacaoEditando) return;
    setErro(null);
    setSucesso(null);
    if (!editValorUnitario.trim()) {
      setErro('Informe o valor unitário.');
      return;
    }

    setProcessandoAcao(true);
    try {
      await clienteProdutosApi.atualizar(relacaoEditando.id, {
        valor_unitario: Number(editValorUnitario),
      });
      setSucesso('Valor atualizado com sucesso.');
      setRelacaoEditando(null);
      await carregarDados();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível atualizar o vínculo.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const excluirRelacao = async () => {
    if (!relacaoEditando) return;
    setErro(null);
    setSucesso(null);

    setProcessandoAcao(true);
    try {
      await clienteProdutosApi.excluir(relacaoEditando.id);
      setSucesso('Vínculo removido com sucesso.');
      setRelacaoEditando(null);
      setConfirmandoExclusao(false);
      await carregarDados();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível excluir o vínculo.');
      setConfirmandoExclusao(false);
      setRelacaoEditando(null);
    } finally {
      setProcessandoAcao(false);
    }
  };

  if (mounted && !canManageCadastros) {
    return (
      <div className="app-shell flex items-center justify-center px-4">
        <div className="surface p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Acesso restrito</h1>
          <p className="text-sm text-slate-600 mb-4">
            Apenas usuários com perfil admin ou backoffice podem acessar este módulo.
          </p>
          <Link href="/pedidos" className="btn-secondary">
            Voltar para pedidos
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
                className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700"
                aria-hidden="true"
              >
                <Image src="/modulos/precos-cliente.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              </span>
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Preços por Cliente
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Relacione cliente e produto com valor unitário personalizado.
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
              <h2 className="text-xl font-bold text-slate-900">Novo Vínculo</h2>
              <p className="text-sm text-slate-600">Abra o modal para relacionar cliente e produto.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalNovoVinculoAberto(true)}
              className="btn-primary"
            >
              Novo Vínculo
            </button>
          </section>
        )}

        <section className="surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_18rem_18rem_1fr] md:items-center">
            <h2 className="text-xl font-bold text-slate-900">Relações Cadastradas</h2>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente/produto"
              className="ui-input"
            />
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="ui-select"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.codigo_cliente} - {cliente.nome}
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-600 font-medium md:text-right">
              {relacoesFiltradas.length} vínculo(s)
            </span>
          </div>

          {loading ? (
            <div className="py-6 text-slate-600">Carregando...</div>
          ) : relacoesFiltradas.length === 0 ? (
            <div className="py-6 text-slate-600">Nenhum vínculo encontrado.</div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
              {relacoesPaginadas.map((relacao) => (
                <div
                  key={relacao.id}
                  className="surface surface-strong h-44 p-3 flex flex-col justify-between border-blue-400/70 bg-blue-50/35"
                >
                  <div>
                    <h3 className="truncate text-base font-extrabold text-slate-900">
                      {relacao.codigo_cliente} - {relacao.cliente_nome}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-700">
                      {relacao.codigo_produto} - {relacao.produto_nome}
                    </p>
                  </div>

                  <div className="rounded-md border border-blue-400/70 bg-blue-100/70 px-2.5 py-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-700">Valor unitário</p>
                    <p className="text-lg font-extrabold leading-tight text-slate-900">
                      {formatarMoeda(relacao.valor_unitario)}
                    </p>
                  </div>

                  {canManageCadastros && (
                    <div className="flex items-end justify-end gap-3 border-t border-slate-200 pt-2">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(relacao)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRelacaoEditando(relacao);
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

        {relacaoEditando && !confirmandoExclusao && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => setRelacaoEditando(null)}
          >
            <div
              className="surface surface-strong w-full max-w-md p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Editar valor</h3>
                  <p className="text-sm text-slate-700">
                    {relacaoEditando.codigo_cliente} - {relacaoEditando.cliente_nome}
                  </p>
                  <p className="text-sm text-slate-700">
                    {relacaoEditando.codigo_produto} - {relacaoEditando.produto_nome}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRelacaoEditando(null)}
                  className="nav-icon-link h-9 w-9"
                  aria-label="Fechar modal de edição"
                  title="Fechar"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293a1 1 0 1 0-1.414-1.414L12 10.586 6.707 5.293Z" />
                  </svg>
                </button>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800">Valor unitário</label>
                <input
                  type="number"
                  step="0.01"
                  value={editValorUnitario}
                  onChange={(e) => setEditValorUnitario(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setRelacaoEditando(null)} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarEdicao}
                  className="btn-primary"
                  disabled={processandoAcao}
                >
                  {processandoAcao ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modalNovoVinculoAberto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => setModalNovoVinculoAberto(false)}
          >
            <div
              className="surface surface-strong w-full max-w-lg p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Novo Vínculo</h3>
                  <p className="text-sm text-slate-700">Selecione cliente, produto e valor unitário.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalNovoVinculoAberto(false)}
                  className="nav-icon-link h-9 w-9"
                  aria-label="Fechar modal de novo vínculo"
                  title="Fechar"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293a1 1 0 1 0-1.414-1.414L12 10.586 6.707 5.293Z" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="ui-select">
                  <option value="">Selecione o cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.codigo_cliente} - {cliente.nome}
                    </option>
                  ))}
                </select>
                <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="ui-select">
                  <option value="">Selecione o produto</option>
                  {produtos.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.codigo_produto} - {produto.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valorUnitario}
                  onChange={(e) => {
                    const valor = e.target.value;
                    if (valor === '') {
                      setValorUnitario('');
                      return;
                    }
                    const numero = Number(valor);
                    if (Number.isFinite(numero) && numero >= 0) {
                      setValorUnitario(valor);
                    }
                  }}
                  placeholder="Valor unitário"
                  className="ui-input"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoVinculoAberto(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={criarRelacao}
                  disabled={saving || !podeCriarVinculo}
                  className="btn-primary"
                  title={
                    podeCriarVinculo
                      ? 'Criar Vínculo'
                      : 'Preencha cliente, produto e valor unitário positivo'
                  }
                >
                  {saving ? 'Salvando...' : 'Criar Vínculo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {relacaoEditando && confirmandoExclusao && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
            onClick={() => {
              setConfirmandoExclusao(false);
              setRelacaoEditando(null);
            }}
          >
            <div
              className="surface surface-strong w-full max-w-md p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900">Confirmar exclusão</h3>
              <p className="mt-2 text-sm text-slate-700">
                Remover o vínculo de <strong>{relacaoEditando.cliente_nome}</strong> com{' '}
                <strong>{relacaoEditando.produto_nome}</strong>?
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setConfirmandoExclusao(false);
                    setRelacaoEditando(null);
                  }}
                  disabled={processandoAcao}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary !bg-red-600 hover:!bg-red-700"
                  onClick={excluirRelacao}
                  disabled={processandoAcao}
                >
                  {processandoAcao ? 'Excluindo...' : 'Excluir vínculo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
