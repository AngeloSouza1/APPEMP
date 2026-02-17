'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cliente, Pedido, clientesApi, pedidosApi } from '@/lib/api';
import FeedbackModal from '@/components/FeedbackModal';

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor || 0));

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  return new Date(valor).toLocaleDateString('pt-BR');
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'EM_ESPERA':
      return 'border-yellow-300 bg-yellow-100 text-yellow-800';
    case 'CONFERIR':
      return 'border-blue-300 bg-blue-100 text-blue-800';
    case 'EFETIVADO':
      return 'border-emerald-300 bg-emerald-100 text-emerald-800';
    case 'CANCELADO':
      return 'border-rose-300 bg-rose-100 text-rose-800';
    default:
      return 'border-slate-300 bg-slate-100 text-slate-800';
  }
};

export default function HistoricoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [status, setStatus] = useState('EFETIVADO');
  const [filtroAplicado, setFiltroAplicado] = useState<{
    dataInicio?: string;
    dataFim?: string;
    clienteId?: number;
    status?: string;
  }>({});

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [pedidosResp, clientesResp] = await Promise.all([
        pedidosApi.listarPaginado({ page: 1, limit: 500 }),
        clientesApi.listar(),
      ]);
      setPedidos(pedidosResp.data.data);
      setClientes(clientesResp.data);
    } catch {
      setErro('Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const aplicarFiltro = () => {
    setErro(null);
    if (!dataInicio || !dataFim) {
      setErro('Informe a data inicial e a data final para visualizar o histórico.');
      return;
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      setErro('A data inicial não pode ser maior que a data final.');
      return;
    }
    setFiltroAplicado({
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      clienteId: clienteId ? Number(clienteId) : undefined,
      status: status || undefined,
    });
  };

  const limparFiltro = () => {
    setDataInicio('');
    setDataFim('');
    setClienteId('');
    setStatus('EFETIVADO');
    setFiltroAplicado({});
  };

  const extrato = useMemo(() => {
    const filtrados = pedidos.filter((pedido) => {
      if (filtroAplicado.dataInicio && pedido.data < filtroAplicado.dataInicio) return false;
      if (filtroAplicado.dataFim && pedido.data > filtroAplicado.dataFim) return false;
      if (filtroAplicado.clienteId && pedido.cliente_id !== filtroAplicado.clienteId) return false;
      if (filtroAplicado.status && pedido.status !== filtroAplicado.status) return false;
      return true;
    });

    const ordenados = [...filtrados].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
    );

    let saldo = 0;
    return ordenados.map((pedido) => {
      const valorMovimento =
        pedido.status === 'CANCELADO'
          ? 0
          : Number(pedido.valor_efetivado ?? pedido.valor_total ?? 0);
      saldo += valorMovimento;
      return {
        ...pedido,
        valor_movimento: valorMovimento,
        saldo_acumulado: saldo,
        data_baixa: pedido.status === 'EFETIVADO' ? pedido.data : null,
      };
    });
  }, [filtroAplicado.clienteId, filtroAplicado.dataFim, filtroAplicado.dataInicio, filtroAplicado.status, pedidos]);

  const resumo = useMemo(() => {
    const totalVendas = extrato.reduce((acc, item) => acc + Number(item.valor_total || 0), 0);
    const totalEfetivado = extrato
      .filter((item) => item.status === 'EFETIVADO')
      .reduce((acc, item) => acc + Number(item.valor_efetivado ?? item.valor_total ?? 0), 0);
    const saldoPeriodo = extrato.length > 0 ? Number(extrato[extrato.length - 1].saldo_acumulado) : 0;
    return { totalVendas, totalEfetivado, saldoPeriodo };
  }, [extrato]);

  const periodoAplicadoCompleto = Boolean(
    filtroAplicado.dataInicio && filtroAplicado.dataFim
  );

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <nav className="surface p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700">
                <Image src="/modulos/historico1.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              </span>
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Histórico
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Extrato de transações, baixas e saldo do período.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

        <section className="surface p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Data inicial</label>
              <input
                type="date"
                className="ui-input"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Data final</label>
              <input
                type="date"
                className="ui-input"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Cliente</label>
              <select
                className="ui-select"
                value={clienteId}
                onChange={(event) => setClienteId(event.target.value)}
              >
                <option value="">Todos os clientes</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.codigo_cliente} - {cliente.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Status</label>
              <select
                className="ui-select"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="EFETIVADO">Efetivado</option>
                <option value="EM_ESPERA">Em Espera</option>
                <option value="CONFERIR">Conferir</option>
                <option value="CANCELADO">Cancelado</option>
                <option value="">Todos os status</option>
              </select>
            </div>
            <button type="button" className="btn-primary h-11" onClick={aplicarFiltro}>
              Aplicar período
            </button>
            <button type="button" className="btn-secondary h-11" onClick={limparFiltro}>
              Limpar
            </button>
          </div>
        </section>

        <section className="surface p-4 space-y-3">
          {!periodoAplicadoCompleto ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
              Informe <strong>data inicial</strong> e <strong>data final</strong> e clique em
              {' '}<strong>Aplicar período</strong> para visualizar o extrato.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total de vendas</p>
                  <p className="text-xl font-extrabold text-slate-900">{formatarMoeda(resumo.totalVendas)}</p>
                </div>
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total efetivado</p>
                  <p className="text-xl font-extrabold text-emerald-800">{formatarMoeda(resumo.totalEfetivado)}</p>
                </div>
                <div className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Saldo do período</p>
                  <p className="text-xl font-extrabold text-blue-800">{formatarMoeda(resumo.saldoPeriodo)}</p>
                </div>
              </div>

              {loading ? (
                <div className="text-slate-600">Carregando extrato...</div>
              ) : extrato.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                  Nenhuma transação encontrada para o período selecionado.
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[26rem] rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-left text-slate-700">
                        <th className="py-2 pr-3 pl-3">Data</th>
                        <th className="py-2 pr-3">Pedido</th>
                        <th className="py-2 pr-3">Cliente</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3 text-right">Venda</th>
                        <th className="py-2 pr-3 text-right">Baixa</th>
                        <th className="py-2 pr-3 text-right">Saldo acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extrato.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-b border-slate-100 text-slate-800 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                          }`}
                        >
                          <td className="py-2 pr-3 pl-3">{formatarData(item.data)}</td>
                          <td className="py-2 pr-3">#{item.id}</td>
                          <td className="py-2 pr-3">{item.cliente_nome}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(item.status)}`}
                            >
                              {item.status.replaceAll('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right">{formatarMoeda(Number(item.valor_total || 0))}</td>
                          <td className="py-2 pr-3 text-right">
                            {item.data_baixa ? formatarData(item.data_baixa) : '-'}
                          </td>
                          <td className="py-2 pr-3 text-right font-bold">
                            {formatarMoeda(Number(item.saldo_acumulado || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
