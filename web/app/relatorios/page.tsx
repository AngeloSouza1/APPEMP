'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RelatorioProducaoItem,
  RelatorioTopClienteItem,
  RelatorioTrocaItem,
  RelatorioRotaDetalhadoItem,
  RelatorioProdutosPorRotaItem,
  relatoriosApi,
  Rota,
  rotasApi,
} from '@/lib/api';
import FeedbackModal from '@/components/FeedbackModal';

type SubRelatorio = 'producao' | 'rotas' | 'produtos-rota' | 'top-clientes' | 'trocas';

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor || 0));

const formatarNumero = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(valor || 0));

export default function RelatoriosPage() {
  const [subRelatorio, setSubRelatorio] = useState<SubRelatorio>('producao');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState('');
  const [producao, setProducao] = useState<RelatorioProducaoItem[]>([]);
  const [relatorioRotas, setRelatorioRotas] = useState<RelatorioRotaDetalhadoItem[]>([]);
  const [produtosPorRota, setProdutosPorRota] = useState<RelatorioProdutosPorRotaItem[]>([]);
  const [topClientes, setTopClientes] = useState<RelatorioTopClienteItem[]>([]);
  const [trocas, setTrocas] = useState<RelatorioTrocaItem[]>([]);
  const [loadingProdutosRota, setLoadingProdutosRota] = useState(false);
  const [rotasExpandidas, setRotasExpandidas] = useState<Record<string, boolean>>({});
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'EM_ESPERA' | 'CONFERIR' | 'EFETIVADO' | 'CANCELADO'>('EM_ESPERA');
  const [filtroPeriodoAplicado, setFiltroPeriodoAplicado] = useState<{
    dataInicio?: string;
    dataFim?: string;
    status?: string;
  }>({});

  const carregarBase = useCallback(async (periodo?: { dataInicio?: string; dataFim?: string; status?: string }) => {
    setLoading(true);
    setErro(null);
    try {
      const filtros = {
        data_inicio: periodo?.dataInicio,
        data_fim: periodo?.dataFim,
        status: periodo?.status || 'EM_ESPERA',
      };
      const [rotasResp, producaoResp, relatorioRotasResp, produtosPorRotaResp] = await Promise.all([
        rotasApi.listar(),
        relatoriosApi.producao(filtros),
        relatoriosApi.rotasDetalhado(filtros),
        relatoriosApi.produtosPorRota({
          rota_id: rotaSelecionada ? Number(rotaSelecionada) : undefined,
          ...filtros,
        }),
      ]);
      const [topClientesResp, trocasResp] = await Promise.all([
        relatoriosApi.topClientes(filtros),
        relatoriosApi.trocas(filtros),
      ]);

      setRotas(rotasResp.data);
      setProducao(producaoResp.data);
      setRelatorioRotas(relatorioRotasResp.data);
      setProdutosPorRota(produtosPorRotaResp.data);
      setTopClientes(topClientesResp.data);
      setTrocas(trocasResp.data);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      setErro('Não foi possível carregar os relatórios.');
    } finally {
      setLoading(false);
    }
  }, [rotaSelecionada]);

  useEffect(() => {
    if (!filtroPeriodoAplicado.dataInicio || !filtroPeriodoAplicado.dataFim) {
      setProdutosPorRota([]);
      return;
    }

    const carregarProdutosPorRota = async () => {
      setLoadingProdutosRota(true);
      try {
        const response = await relatoriosApi.produtosPorRota({
          rota_id: rotaSelecionada ? Number(rotaSelecionada) : undefined,
          data_inicio: filtroPeriodoAplicado.dataInicio,
          data_fim: filtroPeriodoAplicado.dataFim,
          status: filtroPeriodoAplicado.status || 'EM_ESPERA',
        });
        setProdutosPorRota(response.data);
      } catch (error) {
        console.error('Erro ao carregar produtos por rota:', error);
        setErro('Não foi possível carregar o relatório de produtos por rota.');
      } finally {
        setLoadingProdutosRota(false);
      }
    };

    carregarProdutosPorRota();
  }, [filtroPeriodoAplicado.dataFim, filtroPeriodoAplicado.dataInicio, filtroPeriodoAplicado.status, rotaSelecionada]);

  const aplicarFiltroPeriodo = async () => {
    setErro(null);
    if (!dataInicio || !dataFim) {
      setErro('Informe a data inicial e a data final para visualizar os relatórios.');
      return;
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      setErro('A data inicial não pode ser maior que a data final.');
      return;
    }
    const periodo = {
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      status: statusFiltro,
    };
    setFiltroPeriodoAplicado(periodo);
    await carregarBase(periodo);
  };

  const limparFiltroPeriodo = async () => {
    setDataInicio('');
    setDataFim('');
    setStatusFiltro('EM_ESPERA');
    setFiltroPeriodoAplicado({});
    setErro(null);
    setProducao([]);
    setRelatorioRotas([]);
    setProdutosPorRota([]);
    setTopClientes([]);
    setTrocas([]);
  };

  const tituloRotaSelecionada = useMemo(() => {
    if (!rotaSelecionada) return 'Todas as rotas';
    const rota = rotas.find((item) => String(item.id) === rotaSelecionada);
    return rota?.nome || 'Rota selecionada';
  }, [rotaSelecionada, rotas]);

  const rotasAgrupadas = useMemo(() => {
    const mapaRotas = new Map<
      string,
      {
        rota_id: number;
        rota_nome: string;
        clientesMap: Map<
          number,
          {
            cliente_id: number;
            cliente_nome: string;
            codigo_cliente: string;
            pedidosMap: Map<
              number,
              {
                pedido_id: number;
                chave_pedido: string | null;
                pedido_data: string;
                pedido_status: string;
                pedido_valor_total: number;
                tem_trocas: boolean;
                qtd_trocas: number;
                nomes_trocas: string | null;
                itens: Array<{
                  produto_id: number;
                  produto_nome: string;
                  embalagem: string | null;
                  quantidade: number;
                  valor_total_item: number;
                }>;
              }
            >;
          }
        >;
      }
    >();

    for (const row of relatorioRotas) {
      const rotaKey = `${row.rota_id}-${row.rota_nome}`;
      let rota = mapaRotas.get(rotaKey);
      if (!rota) {
        rota = {
          rota_id: row.rota_id,
          rota_nome: row.rota_nome,
          clientesMap: new Map(),
        };
        mapaRotas.set(rotaKey, rota);
      }

      let cliente = rota.clientesMap.get(row.cliente_id);
      if (!cliente) {
        cliente = {
          cliente_id: row.cliente_id,
          cliente_nome: row.cliente_nome,
          codigo_cliente: row.codigo_cliente,
          pedidosMap: new Map(),
        };
        rota.clientesMap.set(row.cliente_id, cliente);
      }

      let pedido = cliente.pedidosMap.get(row.pedido_id);
      if (!pedido) {
        pedido = {
          pedido_id: row.pedido_id,
          chave_pedido: row.chave_pedido || null,
          pedido_data: row.pedido_data,
          pedido_status: row.pedido_status,
          pedido_valor_total: Number(row.pedido_valor_total || 0),
          tem_trocas: Boolean(row.tem_trocas),
          qtd_trocas: Number(row.qtd_trocas || 0),
          nomes_trocas: row.nomes_trocas || null,
          itens: [],
        };
        cliente.pedidosMap.set(row.pedido_id, pedido);
      }

      if (row.produto_id && row.produto_nome) {
        pedido.itens.push({
          produto_id: row.produto_id,
          produto_nome: row.produto_nome,
          embalagem: row.embalagem || null,
          quantidade: Number(row.quantidade || 0),
          valor_total_item: Number(row.valor_total_item || 0),
        });
      }
    }

    return [...mapaRotas.values()].map((rota) => ({
      rota_id: rota.rota_id,
      rota_nome: rota.rota_nome,
      clientes: [...rota.clientesMap.values()]
        .map((cliente) => ({
          ...cliente,
          pedidos: [...cliente.pedidosMap.values()].sort(
            (a, b) => new Date(b.pedido_data).getTime() - new Date(a.pedido_data).getTime()
          ),
        }))
        .sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome)),
    }));
  }, [relatorioRotas]);

  const dashboardRotas = useMemo(() => {
    const clientes = new Set<number>();
    const pedidos = new Map<number, number>();
    for (const row of relatorioRotas) {
      clientes.add(row.cliente_id);
      if (!pedidos.has(row.pedido_id)) {
        pedidos.set(row.pedido_id, Number(row.pedido_valor_total || 0));
      }
    }
    const totalPedidos = pedidos.size;
    const valorTotal = [...pedidos.values()].reduce((acc, value) => acc + value, 0);
    return {
      totalClientes: clientes.size,
      totalPedidos,
      valorTotal,
    };
  }, [relatorioRotas]);

  const produtosPorRotaAgrupado = useMemo(() => {
    const mapa = new Map<
      string,
      {
        rota_id?: number | null;
        rota_nome: string;
        total_quantidade: number;
        produtos: Array<{
          produto_id: number;
          produto_nome: string;
          embalagem?: string | null;
          quantidade_total: number;
        }>;
      }
    >();

    for (const item of produtosPorRota) {
      const rotaNome = item.rota_nome || 'Sem rota';
      const key = `${item.rota_id || 'sem-rota'}-${rotaNome}`;
      const quantidade = Number(item.quantidade_total || 0);

      if (!mapa.has(key)) {
        mapa.set(key, {
          rota_id: item.rota_id,
          rota_nome: rotaNome,
          total_quantidade: 0,
          produtos: [],
        });
      }

      const grupo = mapa.get(key)!;
      grupo.total_quantidade += quantidade;
      grupo.produtos.push({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        embalagem: item.embalagem,
        quantidade_total: quantidade,
      });
    }

    return [...mapa.values()];
  }, [produtosPorRota]);

  const producaoFiltradaOrdenada = useMemo(() => {
    return [...producao]
      .sort((a, b) => Number(b.quantidade_total || 0) - Number(a.quantidade_total || 0));
  }, [producao]);

  const trocasPorRotaAgrupado = useMemo(() => {
    const mapa = new Map<
      string,
      {
        rota_id?: number | null;
        rota_nome: string;
        trocas: RelatorioTrocaItem[];
      }
    >();

    for (const troca of trocas) {
      const rotaNome = troca.rota_nome || 'Sem rota';
      const key = `${troca.rota_id || 'sem-rota'}-${rotaNome}`;

      if (!mapa.has(key)) {
        mapa.set(key, {
          rota_id: troca.rota_id,
          rota_nome: rotaNome,
          trocas: [],
        });
      }

      mapa.get(key)!.trocas.push(troca);
    }

    return [...mapa.values()];
  }, [trocas]);

  const periodoAplicadoCompleto = Boolean(
    filtroPeriodoAplicado.dataInicio && filtroPeriodoAplicado.dataFim
  );


  const classeSubRelatorio = (chave: SubRelatorio) =>
    `rounded-xl border px-4 py-2 text-sm font-semibold transition ${
      subRelatorio === chave
        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
        : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
    }`;

  const alternarExpansaoRota = (rotaKey: string) => {
    setRotasExpandidas((anterior) => ({
      ...anterior,
      [rotaKey]: !(anterior[rotaKey] ?? true),
    }));
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
                <Image src="/modulos/relatorios.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              </span>
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Relatórios
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Produção, rotas, produtos por rota, top clientes e trocas.
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

        {loading ? (
          <section className="surface p-5 text-slate-600">Carregando relatórios...</section>
        ) : (
          <>
            <section className="surface p-4">
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_16rem_auto_auto] md:items-end">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">Data inicial</label>
                  <input
                    type="date"
                    className="ui-input"
                    value={dataInicio}
                    onChange={(event) => setDataInicio(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">Data final</label>
                  <input
                    type="date"
                    className="ui-input"
                    value={dataFim}
                    onChange={(event) => setDataFim(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">Status</label>
                  <select
                    className="ui-select"
                    value={statusFiltro}
                    onChange={(event) =>
                      setStatusFiltro(event.target.value as 'EM_ESPERA' | 'CONFERIR' | 'EFETIVADO' | 'CANCELADO')
                    }
                  >
                    <option value="EM_ESPERA">Em Espera</option>
                    <option value="CONFERIR">Conferir</option>
                    <option value="EFETIVADO">Efetivado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>
                <button type="button" className="btn-primary h-11" onClick={aplicarFiltroPeriodo}>
                  Aplicar período
                </button>
                <button type="button" className="btn-secondary h-11" onClick={limparFiltroPeriodo}>
                  Limpar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={classeSubRelatorio('producao')}
                  onClick={() => setSubRelatorio('producao')}
                >
                  Produção
                </button>
                <button
                  type="button"
                  className={classeSubRelatorio('rotas')}
                  onClick={() => setSubRelatorio('rotas')}
                >
                  Relatório de Rotas
                </button>
                <button
                  type="button"
                  className={classeSubRelatorio('produtos-rota')}
                  onClick={() => setSubRelatorio('produtos-rota')}
                >
                  Produtos por Rota
                </button>
                <button
                  type="button"
                  className={classeSubRelatorio('top-clientes')}
                  onClick={() => setSubRelatorio('top-clientes')}
                >
                  Top Clientes
                </button>
                <button
                  type="button"
                  className={classeSubRelatorio('trocas')}
                  onClick={() => setSubRelatorio('trocas')}
                >
                  Trocas
                </button>
              </div>
            </section>

            {subRelatorio === 'producao' && (
            <section className="surface p-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Produção</h2>
                  <p className="text-sm text-slate-600">Ordenado por maior quantidade</p>
                </div>
                <span className="text-sm text-slate-600 md:text-right">{producaoFiltradaOrdenada.length} produto(s)</span>
              </div>
              {!periodoAplicadoCompleto ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Informe data inicial e final e clique em <strong>Aplicar período</strong>.
                </div>
              ) : producaoFiltradaOrdenada.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhum produto encontrado para o período selecionado.
                </div>
              ) : (
                <div
                  className={`overflow-x-auto ${
                    producaoFiltradaOrdenada.length > 6
                      ? 'max-h-[22rem] overflow-y-auto [scrollbar-gutter:stable]'
                      : ''
                  }`}
                >
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 z-10 border-b border-slate-200 bg-white text-left text-slate-700">
                        <th className="py-2 pr-3">Produto</th>
                        <th className="py-2 pr-3">Embalagem</th>
                        <th className="py-2 pr-5 text-right">Quantidade Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {producaoFiltradaOrdenada.map((item, index) => {
                        return (
                        <tr
                          key={item.produto_id}
                          className={`border-b border-slate-100 text-slate-800 ${
                            index % 2 === 0 ? 'bg-white/50' : 'bg-slate-50/70'
                          }`}
                        >
                          <td className="py-2 pr-3 text-base font-bold">{item.produto_nome}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                              {item.embalagem || '-'}
                            </span>
                          </td>
                          <td className="py-2 pr-5 text-right text-lg font-extrabold">
                            {formatarNumero(item.quantidade_total)}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            )}

            {subRelatorio === 'rotas' && (
            <section className="surface p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">Relatório de Rotas</h2>
                <div className="text-right">
                  <p className="text-sm text-slate-600">{dashboardRotas.totalClientes} cliente(s)</p>
                  <p className="text-sm font-semibold text-slate-800">
                    Vendas das rotas: {dashboardRotas.valorTotal > 0 ? formatarMoeda(dashboardRotas.valorTotal) : '-'}
                  </p>
                </div>
              </div>
              <div
                className={`space-y-3 ${
                  periodoAplicadoCompleto && rotasAgrupadas.length > 2
                    ? 'max-h-[24rem] overflow-y-auto pr-1 [scrollbar-gutter:stable]'
                    : ''
                }`}
              >
                {!periodoAplicadoCompleto ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    Informe data inicial e final e clique em <strong>Aplicar período</strong>.
                  </div>
                ) : rotasAgrupadas.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Nenhum pedido encontrado para o período selecionado.
                  </div>
                ) : rotasAgrupadas.map((rota) => (
                  (() => {
                    const rotaKey = `${rota.rota_id}-${rota.rota_nome}`;
                    const expandida = rotasExpandidas[rotaKey] ?? false;
                    return (
                  <div key={rotaKey} className="rounded-lg border border-slate-300 bg-slate-50/50 p-2.5">
                    <div className="mb-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:items-center">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Rota</p>
                          <h3 className="text-base font-extrabold text-slate-900">{rota.rota_nome}</h3>
                        </div>
                        <div className="text-left md:text-center">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Valor total rota</p>
                          <p className="text-base font-extrabold text-slate-900">
                            {formatarMoeda(
                              rota.clientes.reduce(
                                (acc, cliente) =>
                                  acc
                                  + cliente.pedidos.reduce(
                                    (accPedido, pedido) => accPedido + Number(pedido.pedido_valor_total || 0),
                                    0
                                  ),
                                0
                              )
                            )}
                          </p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Clientes</p>
                          <p className="text-base font-extrabold text-slate-900">
                            {rota.clientes.length}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => alternarExpansaoRota(rotaKey)}
                          className="btn-secondary px-3 py-1 text-sm"
                        >
                          {expandida ? 'Minimizar' : 'Expandir'}
                        </button>
                      </div>
                    </div>

                    {expandida && (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {rota.clientes.map((cliente) => (
                        <div
                          key={cliente.cliente_id}
                          className="rounded-lg border border-blue-300 bg-gradient-to-b from-blue-50 to-blue-100/60 p-3 shadow-sm"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2 rounded-md border border-blue-200 bg-white/70 px-2.5 py-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Cliente</p>
                              <p className="text-base font-bold text-slate-900">{cliente.cliente_nome}</p>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                {cliente.codigo_cliente}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-600">{cliente.pedidos.length} pedido(s)</p>
                              <p className="text-base font-extrabold text-slate-900">
                                {formatarMoeda(
                                  cliente.pedidos.reduce(
                                    (acc, pedido) => acc + Number(pedido.pedido_valor_total || 0),
                                    0
                                  )
                                )}
                              </p>
                            </div>
                          </div>

                          {cliente.pedidos.length === 0 ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              Sem pedidos no período selecionado.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {cliente.pedidos.map((pedido) => (
                                <div
                                  key={pedido.pedido_id}
                                  className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5"
                                >
                                  <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-white/80 px-2 py-1.5">
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Pedido</p>
                                      <p className="text-sm font-bold text-slate-900">
                                        Pedido #{pedido.pedido_id}
                                        {pedido.chave_pedido ? ` • ${pedido.chave_pedido}` : ''}
                                      </p>
                                      <p className="text-xs text-slate-600">
                                        {new Date(pedido.pedido_data).toLocaleDateString('pt-BR')} • {pedido.pedido_status}
                                      </p>
                                      {pedido.tem_trocas && (
                                        <div className="mt-1 space-y-1">
                                          <span className="inline-flex rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                                            {pedido.qtd_trocas} troca(s)
                                          </span>
                                          {pedido.nomes_trocas && (
                                            <p
                                              className="max-w-[22rem] truncate text-[11px] font-medium text-violet-800"
                                              title={`Trocas: ${pedido.nomes_trocas}`}
                                            >
                                              Trocas: {pedido.nomes_trocas}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-sm font-extrabold text-slate-900">
                                      {formatarMoeda(pedido.pedido_valor_total)}
                                    </p>
                                  </div>
                                  {pedido.itens.length > 0 && (
                                    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white/85 px-2 py-1">
                                      <table className="min-w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-slate-200 text-left text-slate-700">
                                            <th className="py-1 pr-2">Produto</th>
                                            <th className="py-1 pr-2">Emb.</th>
                                            <th className="py-1 pr-2 text-right">Qtd.</th>
                                            <th className="py-1 text-right">Valor</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {pedido.itens.map((item) => (
                                            <tr key={`${pedido.pedido_id}-${item.produto_id}`} className="border-b border-slate-100 text-slate-800">
                                              <td className="py-1 pr-2">{item.produto_nome}</td>
                                              <td className="py-1 pr-2">{item.embalagem || '-'}</td>
                                              <td className="py-1 pr-2 text-right font-semibold">
                                                {formatarNumero(item.quantidade)}
                                              </td>
                                              <td className="py-1 text-right font-semibold">
                                                {formatarMoeda(item.valor_total_item)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                    );
                  })()
                ))}
              </div>
            </section>
            )}

            {subRelatorio === 'produtos-rota' && (
            <section className="surface p-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_18rem] md:items-end">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Produtos por Rota</h2>
                  <p className="text-sm text-slate-600">{tituloRotaSelecionada}</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">Filtrar rota</label>
                  <select
                    className="ui-select"
                    value={rotaSelecionada}
                    onChange={(event) => setRotaSelecionada(event.target.value)}
                  >
                    <option value="">Todas as rotas</option>
                    {rotas.map((rota) => (
                      <option key={rota.id} value={rota.id}>
                        {rota.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {!periodoAplicadoCompleto ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Informe data inicial e final e clique em <strong>Aplicar período</strong>.
                </div>
              ) : loadingProdutosRota ? (
                <div className="py-4 text-slate-600">Atualizando dados...</div>
              ) : produtosPorRota.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhum produto encontrado para o período selecionado.
                </div>
              ) : (
                <>
                  <div
                    className={`space-y-4 ${
                      produtosPorRotaAgrupado.length > 1
                        ? 'max-h-[24rem] overflow-y-auto pr-1 [scrollbar-gutter:stable]'
                        : ''
                    }`}
                  >
                    {produtosPorRotaAgrupado.map((rota) => (
                      <div
                        key={`${rota.rota_id || 'sem-rota'}-${rota.rota_nome}`}
                        className="rounded-lg border border-slate-300 bg-slate-50/60 p-2.5"
                      >
                        <div className="mb-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-center">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Rota</p>
                              <p className="text-base font-extrabold text-slate-900">{rota.rota_nome}</p>
                            </div>
                            <div className="text-left md:text-center">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Produtos</p>
                              <p className="text-base font-extrabold text-slate-900">{rota.produtos.length}</p>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-left text-slate-700">
                                <th className="py-1 pr-3">Produto</th>
                                <th className="py-1 pr-3">Embalagem</th>
                                <th className="py-1 pr-5 text-right">Quantidade Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rota.produtos.map((produto) => (
                                <tr
                                  key={`${rota.rota_id || 'sem-rota'}-${produto.produto_id}`}
                                  className="border-b border-slate-100 text-slate-800"
                                >
                                  <td className="py-1 pr-3 font-semibold">{produto.produto_nome}</td>
                                  <td className="py-1 pr-3">{produto.embalagem || '-'}</td>
                                  <td className="py-1 pr-5 text-right font-extrabold">
                                    {formatarNumero(produto.quantidade_total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
            )}

            {subRelatorio === 'top-clientes' && (
            <section className="surface p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">Top 10 Clientes</h2>
                <span className="text-sm text-slate-600">{topClientes.length} cliente(s)</span>
              </div>

              {!periodoAplicadoCompleto ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Informe data inicial e final e clique em <strong>Aplicar período</strong>.
                </div>
              ) : topClientes.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhuma venda encontrada para o período selecionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-700">
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Cliente</th>
                        <th className="py-2 pr-3">Código</th>
                        <th className="py-2 pr-3 text-right">Pedidos</th>
                        <th className="py-2 pr-3 text-right">Valor vendido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClientes.map((cliente, index) => (
                        <tr key={cliente.cliente_id} className="border-b border-slate-100 text-slate-800">
                          <td className="py-2 pr-3 font-semibold">{index + 1}</td>
                          <td className="py-2 pr-3 font-semibold">{cliente.cliente_nome}</td>
                          <td className="py-2 pr-3">{cliente.codigo_cliente}</td>
                          <td className="py-2 pr-3 text-right">{cliente.total_pedidos}</td>
                          <td className="py-2 pr-3 text-right font-extrabold">
                            {formatarMoeda(Number(cliente.valor_total_vendas || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            )}

            {subRelatorio === 'trocas' && (
            <section className="surface p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">Relatório de Trocas</h2>
                <span className="text-sm text-slate-600">{trocas.length} troca(s)</span>
              </div>

              {!periodoAplicadoCompleto ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Informe data inicial e final e clique em <strong>Aplicar período</strong>.
                </div>
              ) : trocas.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhuma troca encontrada para o período selecionado.
                </div>
              ) : (
                <div
                  className={`space-y-4 ${
                    trocasPorRotaAgrupado.length > 1
                      ? 'max-h-[24rem] overflow-y-auto pr-1 [scrollbar-gutter:stable]'
                      : ''
                  }`}
                >
                  {trocasPorRotaAgrupado.map((grupo) => (
                    <div
                      key={`${grupo.rota_id || 'sem-rota'}-${grupo.rota_nome}`}
                      className="rounded-lg border border-slate-300 bg-slate-50/60 p-2.5"
                    >
                      <div className="mb-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-center">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Rota</p>
                            <p className="text-base font-extrabold text-slate-900">{grupo.rota_nome}</p>
                          </div>
                          <div className="text-left md:text-center">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Trocas</p>
                            <p className="text-base font-extrabold text-slate-900">{grupo.trocas.length}</p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-700">
                              <th className="py-1 pr-3">Data</th>
                              <th className="py-1 pr-3">Pedido</th>
                              <th className="py-1 pr-3">Cliente</th>
                              <th className="py-1 pr-3">Produto da troca</th>
                              <th className="py-1 pr-3 text-right">Qtd.</th>
                              <th className="py-1 pr-3 text-right">Valor troca</th>
                              <th className="py-1 pr-3">Motivo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.trocas.map((troca, index) => (
                              <tr
                                key={troca.troca_id}
                                className={`border-b border-slate-100 text-slate-800 ${
                                  index % 2 === 0 ? 'bg-white/50' : 'bg-slate-50/70'
                                }`}
                              >
                                <td className="py-1.5 pr-3">
                                  {new Date(troca.pedido_data).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-1.5 pr-3 font-semibold">
                                  #{troca.pedido_id}
                                  {troca.chave_pedido ? ` • ${troca.chave_pedido}` : ''}
                                </td>
                                <td className="py-1.5 pr-3">
                                  <p className="font-semibold">{troca.cliente_nome}</p>
                                  <p className="text-[11px] text-slate-600">{troca.codigo_cliente}</p>
                                </td>
                                <td className="py-1.5 pr-3">
                                  <p className="font-semibold">{troca.produto_nome}</p>
                                  <p className="text-[11px] text-slate-600">{troca.codigo_produto}</p>
                                </td>
                                <td className="py-1.5 pr-3 text-right font-semibold">
                                  {formatarNumero(troca.quantidade)}
                                </td>
                                <td className="py-1.5 pr-3 text-right font-semibold">
                                  {formatarMoeda(Number(troca.valor_troca || 0))}
                                </td>
                                <td className="py-1.5 pr-3 text-[11px] text-slate-700">
                                  {troca.motivo?.trim() ? troca.motivo : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
