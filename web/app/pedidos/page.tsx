'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Cliente, clientesApi, pedidosApi, Pedido, rotasApi, Rota } from '@/lib/api';
import { auth } from '@/lib/auth';
import FeedbackModal from '@/components/FeedbackModal';

interface FiltroPedidos {
  data?: string;
  rota_id?: number;
  cliente_id?: number;
  status?: string;
}

export default function PedidosPage() {
  const [mounted, setMounted] = useState(false);
  const [usuario, setUsuario] = useState<ReturnType<typeof auth.getUser>>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [cancelandoPedidoId, setCancelandoPedidoId] = useState<number | null>(null);
  const [pedidoParaCancelar, setPedidoParaCancelar] = useState<Pedido | null>(null);
  const [filtros, setFiltros] = useState({
    data: '',
    rota_id: '',
    cliente_id: '',
    status: 'EM_ESPERA',
  });
  const LIMITE_POR_PAGINA = 8;
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);

  useEffect(() => {
    setUsuario(auth.getUser());
    setMounted(true);
  }, []);

  const isNetworkError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as { code?: string; message?: string };
    return (
      maybeError.code === 'ECONNREFUSED' ||
      maybeError.message?.includes('Network Error') === true
    );
  };

  const carregarRotas = useCallback(async () => {
    try {
      const response = await rotasApi.listar();
      setRotas(response.data);
      setErro(null);
    } catch (error: unknown) {
      console.error('Erro ao carregar rotas:', error);
      if (isNetworkError(error)) {
        setErro('Não foi possível conectar ao backend. Verifique se o servidor está rodando em http://localhost:3000');
      }
    }
  }, []);

  const carregarClientes = useCallback(async () => {
    try {
      const response = await clientesApi.listar();
      setClientes(response.data);
      setErro(null);
    } catch (error: unknown) {
      console.error('Erro ao carregar clientes:', error);
      if (isNetworkError(error)) {
        setErro('Não foi possível conectar ao backend. Verifique se o servidor está rodando em http://localhost:3000');
      }
    }
  }, []);

  const carregarPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const params: FiltroPedidos = {};
      if (filtros.data) params.data = filtros.data;
      if (filtros.rota_id) params.rota_id = parseInt(filtros.rota_id);
      if (filtros.cliente_id) params.cliente_id = parseInt(filtros.cliente_id);
      if (filtros.status) params.status = filtros.status;
      const textoBusca = busca.trim();

      const response = await pedidosApi.listarPaginado({
        ...params,
        q: textoBusca || undefined,
        page: pagina,
        limit: LIMITE_POR_PAGINA,
      });

      setPedidos(response.data.data);
      setTotalPaginas(response.data.totalPages);
      setTotalRegistros(response.data.total);
      setErro(null);
    } catch (error: unknown) {
      console.error('Erro ao carregar pedidos:', error);
      if (isNetworkError(error)) {
        setErro('Não foi possível conectar ao backend. Verifique se o servidor está rodando em http://localhost:3000');
      }
    } finally {
      setLoading(false);
    }
  }, [busca, filtros.data, filtros.rota_id, filtros.cliente_id, filtros.status, pagina]);

  useEffect(() => {
    carregarRotas();
  }, [carregarRotas]);

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  useEffect(() => {
    carregarPedidos();
  }, [carregarPedidos]);

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarMoeda = (valor: number | string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(valor));
  };

  const cancelarPedidoRapido = async () => {
    if (!pedidoParaCancelar) return;
    setErro(null);
    setSucesso(null);
    setCancelandoPedidoId(pedidoParaCancelar.id);
    try {
      await pedidosApi.atualizarStatus(pedidoParaCancelar.id, { status: 'CANCELADO' });
      setSucesso('Pedido cancelado com sucesso.');
      setPedidoParaCancelar(null);
      await carregarPedidos();
    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      setErro('Não foi possível cancelar o pedido.');
    } finally {
      setCancelandoPedidoId(null);
    }
  };

  const getStatusMeta = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; color: string; cardTone: string; valueTone: string }
    > = {
      EM_ESPERA: {
        label: 'Em Espera',
        color: 'border border-yellow-300 bg-yellow-100 text-yellow-800',
        cardTone: 'border-yellow-400/75 bg-yellow-50/40',
        valueTone: 'border-yellow-400/70 bg-yellow-100/70',
      },
      CONFERIR: {
        label: 'Conferir',
        color: 'border border-blue-300 bg-blue-100 text-blue-800',
        cardTone: 'border-blue-400/75 bg-blue-50/40',
        valueTone: 'border-blue-400/70 bg-blue-100/70',
      },
      EFETIVADO: {
        label: 'Efetivado',
        color: 'border border-green-300 bg-green-100 text-green-800',
        cardTone: 'border-emerald-400/75 bg-emerald-50/40',
        valueTone: 'border-emerald-400/70 bg-emerald-100/70',
      },
      CANCELADO: {
        label: 'Cancelado',
        color: 'border border-red-300 bg-red-100 text-red-800',
        cardTone: 'border-rose-400/80 bg-rose-50/45',
        valueTone: 'border-rose-400/70 bg-rose-100/75',
      },
    };

    return (
      statusMap[status] || {
        label: status.replaceAll('_', ' '),
        color: 'border border-gray-300 bg-gray-100 text-gray-800',
        cardTone: 'border-slate-400/60 bg-slate-50/45',
        valueTone: 'border-slate-400/70 bg-slate-100/80',
      }
    );
  };

  return (
    <div className="app-shell">
      <div className="app-container">
        <nav className="surface mt-4 mb-6 p-4 md:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-16 w-16 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700"
                  aria-hidden="true"
                >
                  <Image
                    src="/modulos/pedidos.png"
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 object-contain"
                  />
                </span>
                <div>
                  <h1 className="top-title">Pedidos</h1>
                  <p className="text-sm text-slate-600">
                    Painel de acompanhamento e processamento de pedidos.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Link
                    href="/pedidos/novo"
                    className="btn-primary"
                    aria-label="Adicionar pedido"
                    title="Adicionar pedido"
                  >
                    Adicionar
                  </Link>
                  <Link
                    href="/"
                    className="btn-secondary"
                    aria-label="Voltar"
                    title="Voltar"
                  >
                    Voltar
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <FeedbackModal
          open={Boolean(erro)}
          variant="error"
          title="Erro"
          message={erro || ''}
          onClose={() => setErro(null)}
        />
        <FeedbackModal
          open={Boolean(sucesso)}
          variant="success"
          message={sucesso || ''}
          onClose={() => setSucesso(null)}
        />

        {/* Filtros */}
        <div className="surface p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label htmlFor="filtro-busca" className="block text-sm font-semibold text-slate-700 mb-1">
                Buscar
              </label>
              <input
                id="filtro-busca"
                type="text"
                placeholder="Cliente, código ou chave"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                className="ui-input"
              />
            </div>
            <div>
              <label htmlFor="filtro-cliente" className="block text-sm font-semibold text-slate-700 mb-1">
                Cliente
              </label>
              <select
                id="filtro-cliente"
                value={filtros.cliente_id}
                onChange={(e) => {
                  setFiltros({ ...filtros, cliente_id: e.target.value });
                  setPagina(1);
                }}
                className="ui-select"
              >
                <option value="">Todos</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.codigo_cliente} - {cliente.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filtro-data" className="block text-sm font-semibold text-slate-700 mb-1">
                Data
              </label>
              <input
                id="filtro-data"
                type="date"
                value={filtros.data}
                onChange={(e) => {
                  setFiltros({ ...filtros, data: e.target.value });
                  setPagina(1);
                }}
                className="ui-input"
              />
            </div>
            <div>
              <label htmlFor="filtro-rota" className="block text-sm font-semibold text-slate-700 mb-1">
                Rota
              </label>
              <select
                id="filtro-rota"
                value={filtros.rota_id}
                onChange={(e) => {
                  setFiltros({ ...filtros, rota_id: e.target.value });
                  setPagina(1);
                }}
                className="ui-select"
              >
                <option value="">Todas</option>
                {rotas.map((rota) => (
                  <option key={rota.id} value={rota.id}>
                    {rota.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filtro-status" className="block text-sm font-semibold text-slate-700 mb-1">
                Status
              </label>
              <select
                id="filtro-status"
                value={filtros.status}
                onChange={(e) => {
                  setFiltros({ ...filtros, status: e.target.value });
                  setPagina(1);
                }}
                className="ui-select"
              >
                <option value="">Todos</option>
                <option value="EM_ESPERA">Em Espera</option>
                <option value="CONFERIR">Conferir</option>
                <option value="EFETIVADO">Efetivado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-3 text-sm text-slate-600 font-medium text-right">
          {totalRegistros} pedido(s) encontrado(s)
        </div>

        {/* Lista de Pedidos */}
        {loading ? (
          <div className="surface text-center py-8">
            <p className="text-slate-600">Carregando...</p>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="surface text-center py-8">
            <p className="text-slate-600">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
              {pedidos.map((pedido) => {
                const statusMeta = getStatusMeta(pedido.status);

                return (
                  <div
                    key={pedido.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPedidoSelecionado(pedido)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setPedidoSelecionado(pedido);
                      }
                    }}
                    className={`surface surface-strong min-h-44 cursor-pointer p-3 pb-4 transition hover:-translate-y-0.5 hover:shadow-xl flex flex-col justify-between ${statusMeta.cardTone}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          {pedido.cliente_nome}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-slate-700">
                          {pedido.codigo_cliente} - {pedido.chave_pedido}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusMeta.color}`}
                          >
                            {statusMeta.label}
                          </span>
                          {pedido.tem_trocas && (
                            <span className="rounded-full border border-violet-300 bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                              {Number(pedido.qtd_trocas || 0)} troca(s)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`mt-2 rounded-md px-2.5 py-1.5 ${statusMeta.valueTone}`}>
                      <p className="text-[11px] uppercase tracking-wide text-slate-700">Valor total</p>
                      <p className="text-lg font-extrabold leading-tight text-slate-900">
                        {formatarMoeda(pedido.valor_total)}
                      </p>
                    </div>

                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-slate-700">
                          {formatarData(pedido.data)} • {pedido.rota_nome || 'Sem rota'}
                        </p>
                        <p
                          className="mt-0.5 truncate text-xs text-slate-600"
                          title={
                            pedido.tem_trocas && pedido.nomes_trocas
                              ? `${pedido.itens.length} item(ns) • Trocas: ${pedido.nomes_trocas}`
                              : `${pedido.itens.length} item(ns)`
                          }
                        >
                          {pedido.itens.length} item(ns)
                          {pedido.tem_trocas && pedido.nomes_trocas
                            ? ` • Trocas: ${pedido.nomes_trocas}`
                            : ''}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-3">
                        <Link
                          href={`/pedidos/${pedido.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Editar
                        </Link>
                        <Link
                          href={`/pedidos/${pedido.id}#trocas`}
                          onClick={(event) => event.stopPropagation()}
                          className="shrink-0 text-xs font-semibold text-violet-700 hover:text-violet-800"
                        >
                          Trocas
                        </Link>
                        {pedido.status !== 'CANCELADO' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPedidoParaCancelar(pedido);
                            }}
                            disabled={cancelandoPedidoId === pedido.id}
                            className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {cancelandoPedidoId === pedido.id ? 'Cancelando...' : 'Cancelar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pedidoSelecionado && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => setPedidoSelecionado(null)}
          >
            <div
              className="surface surface-strong w-full max-w-lg p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Pedido #{pedidoSelecionado.id}
                  </h2>
                  <p className="text-sm text-slate-700">
                    {pedidoSelecionado.cliente_nome}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPedidoSelecionado(null)}
                  className="nav-icon-link h-9 w-9"
                  aria-label="Fechar modal"
                  title="Fechar"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293a1 1 0 1 0-1.414-1.414L12 10.586 6.707 5.293Z" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm text-slate-800 md:grid-cols-2">
                <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Status</p>
                  <p className="mt-1 font-semibold">{getStatusMeta(pedidoSelecionado.status).label}</p>
                </div>
                <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Valor total</p>
                  <p className="mt-1 font-extrabold text-slate-900">
                    {formatarMoeda(pedidoSelecionado.valor_total)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Data</p>
                  <p className="mt-1 font-semibold">{formatarData(pedidoSelecionado.data)}</p>
                </div>
                <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Rota</p>
                  <p className="mt-1 font-semibold">{pedidoSelecionado.rota_nome || 'Sem rota'}</p>
                </div>
                <div className="rounded-md border border-slate-300 bg-slate-50 p-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Código / Chave</p>
                  <p className="mt-1 font-semibold">
                    {pedidoSelecionado.codigo_cliente} - {pedidoSelecionado.chave_pedido}
                  </p>
                </div>
                <div className="rounded-md border border-slate-300 bg-slate-50 p-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Itens</p>
                  <p className="mt-1 font-semibold">{pedidoSelecionado.itens.length} item(ns)</p>
                </div>
                <div className="rounded-md border border-slate-300 bg-slate-50 p-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Detalhes dos itens</p>
                  {pedidoSelecionado.itens.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">Sem itens neste pedido.</p>
                  ) : (
                    <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                      {pedidoSelecionado.itens.map((item, index) => (
                        <div
                          key={item.id ?? `${item.produto_id}-${index}`}
                          className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-white px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.produto_nome || `Produto ${item.produto_id}`}
                            </p>
                            <p className="truncate text-xs text-slate-600">
                              Qtd: {item.quantidade} {item.embalagem || 'un'}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-slate-900">
                            {formatarMoeda(item.valor_total_item || 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {pedidoParaCancelar && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
            onClick={() => (cancelandoPedidoId ? null : setPedidoParaCancelar(null))}
          >
            <div
              className="surface surface-strong w-full max-w-md p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900">Cancelar pedido</h3>
              <p className="mt-2 text-sm text-slate-700">
                Confirmar cancelamento do pedido #{pedidoParaCancelar.id} de{' '}
                <strong>{pedidoParaCancelar.cliente_nome}</strong>?
              </p>
              <p className="mt-1 text-xs text-slate-600">Esta ação altera o status para Cancelado.</p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPedidoParaCancelar(null)}
                  className="btn-secondary"
                  disabled={Boolean(cancelandoPedidoId)}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void cancelarPedidoRapido();
                  }}
                  className="nav-icon-link-danger h-10 px-3"
                  disabled={Boolean(cancelandoPedidoId)}
                >
                  {cancelandoPedidoId ? 'Cancelando...' : 'Confirmar cancelamento'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && totalPaginas > 1 && (
          <div className="mt-6 flex items-center justify-between">
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
