'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cliente, Pedido, Rota, clientesApi, pedidosApi, rotasApi } from '@/lib/api';
import { auth } from '@/lib/auth';
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

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'EM_ESPERA':
      return 'Em Espera';
    case 'CONFERIR':
      return 'Conferir';
    case 'EFETIVADO':
      return 'Efetivado';
    case 'CANCELADO':
      return 'Cancelado';
    default:
      return status;
  }
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

export default function RemaneioPage() {
  const [step, setStep] = useState<'selecao' | 'remaneio' | 'dashboard'>('selecao');
  const [mounted, setMounted] = useState(false);
  const [usuario, setUsuario] = useState<ReturnType<typeof auth.getUser>>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [pedidosSelecao, setPedidosSelecao] = useState<Pedido[]>([]);
  const [pedidosRemaneio, setPedidosRemaneio] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [rotaId, setRotaId] = useState('');
  const [data, setData] = useState('');
  const [filtrosAplicados, setFiltrosAplicados] = useState<{
    q?: string;
    cliente_id?: number;
    rota_id?: number;
    data?: string;
  }>({});

  const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);
  const [ordemSelecaoRemaneio, setOrdemSelecaoRemaneio] = useState<number[]>([]);

  useEffect(() => {
    setUsuario(auth.getUser());
    setMounted(true);
  }, []);

  const podeAcessarRemaneio =
    mounted &&
    (usuario?.perfil === 'admin' || usuario?.perfil === 'backoffice' || usuario?.perfil === 'motorista');

  const carregarDados = useCallback(async () => {
    if (!podeAcessarRemaneio) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro(null);
    try {
      const [clientesResp, rotasResp, pedidosSelecaoResp, pedidosRemaneioResp] = await Promise.all([
        clientesApi.listar(),
        rotasApi.listar(),
        pedidosApi.listarPaginado({
          page: 1,
          limit: 200,
          status: 'EM_ESPERA',
          ...filtrosAplicados,
        }),
        pedidosApi.listarPaginado({
          page: 1,
          limit: 200,
          status: 'CONFERIR',
          ...filtrosAplicados,
        }),
      ]);
      setClientes(clientesResp.data);
      setRotas(rotasResp.data);
      setPedidosSelecao(pedidosSelecaoResp.data.data);
      setPedidosRemaneio(pedidosRemaneioResp.data.data);
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível carregar os pedidos para remaneio.');
    } finally {
      setLoading(false);
    }
  }, [filtrosAplicados, podeAcessarRemaneio]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    setIdsSelecionados((prev) =>
      prev.filter((id) => pedidosSelecao.some((pedido) => pedido.id === id))
    );
  }, [pedidosSelecao]);

  const idsSelecionaveis = useMemo(
    () => pedidosSelecao.map((pedido) => pedido.id),
    [pedidosSelecao]
  );
  const hasPedidosNoRemaneio = pedidosRemaneio.length > 0;

  const totalSelecionado = useMemo(
    () =>
      pedidosSelecao
        .filter((pedido) => idsSelecionados.includes(pedido.id))
        .reduce((acc, pedido) => acc + Number(pedido.valor_total || 0), 0),
    [idsSelecionados, pedidosSelecao]
  );
  const pedidosDashboard = useMemo(() => {
    const pedidosPorData = [...pedidosRemaneio].sort((a, b) => {
      const diffData = new Date(b.data).getTime() - new Date(a.data).getTime();
      if (diffData !== 0) return diffData;
      return b.id - a.id;
    });

    if (ordemSelecaoRemaneio.length === 0) return pedidosPorData;

    const porId = new Map(pedidosRemaneio.map((pedido) => [pedido.id, pedido]));
    const idsOrdenados = new Set<number>();
    const pedidosOrdenadosPorSelecao = ordemSelecaoRemaneio
      .map((id) => porId.get(id))
      .filter((pedido): pedido is Pedido => {
        if (!pedido) return false;
        idsOrdenados.add(pedido.id);
        return true;
      });

    const pedidosRestantes = pedidosPorData.filter((pedido) => !idsOrdenados.has(pedido.id));
    return [...pedidosOrdenadosPorSelecao, ...pedidosRestantes];
  }, [ordemSelecaoRemaneio, pedidosRemaneio]);

  const resumoDashboard = useMemo(() => {
    const pedidos = pedidosDashboard;
    const totalPedidos = pedidos.length;
    const valorTotal = pedidos.reduce((acc, pedido) => acc + Number(pedido.valor_total || 0), 0);
    const ticketMedio = totalPedidos > 0 ? valorTotal / totalPedidos : 0;
    const clientesUnicos = new Set(pedidos.map((pedido) => pedido.cliente_id)).size;
    const rotasUnicas = new Set(pedidos.map((pedido) => pedido.rota_nome || 'Sem rota')).size;
    const pedidosComTroca = pedidos.filter(
      (pedido) => Boolean(pedido.tem_trocas) || Number(pedido.qtd_trocas || 0) > 0
    ).length;
    const qtdTrocas = pedidos.reduce((acc, pedido) => acc + Number(pedido.qtd_trocas || 0), 0);

    const porRotaMap = new Map<string, { rota: string; pedidos: number; valor: number }>();
    for (const pedido of pedidos) {
      const rota = pedido.rota_nome || 'Sem rota';
      const atual = porRotaMap.get(rota) || { rota, pedidos: 0, valor: 0 };
      atual.pedidos += 1;
      atual.valor += Number(pedido.valor_total || 0);
      porRotaMap.set(rota, atual);
    }
    const porRota = Array.from(porRotaMap.values()).sort((a, b) => b.valor - a.valor);

    const porClienteMap = new Map<string, { cliente: string; codigo: string; pedidos: number; valor: number }>();
    for (const pedido of pedidos) {
      const chave = String(pedido.cliente_id);
      const atual = porClienteMap.get(chave) || {
        cliente: pedido.cliente_nome,
        codigo: pedido.codigo_cliente,
        pedidos: 0,
        valor: 0,
      };
      atual.pedidos += 1;
      atual.valor += Number(pedido.valor_total || 0);
      porClienteMap.set(chave, atual);
    }
    const porCliente = Array.from(porClienteMap.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    const pedidosRecentes = [...pedidos]
      .sort((a, b) => {
        const diff = new Date(b.data).getTime() - new Date(a.data).getTime();
        if (diff !== 0) return diff;
        return b.id - a.id;
      })
      .slice(0, 12);

    return {
      totalPedidos,
      valorTotal,
      ticketMedio,
      clientesUnicos,
      rotasUnicas,
      pedidosComTroca,
      qtdTrocas,
      porRota,
      porCliente,
      pedidosRecentes,
    };
  }, [pedidosDashboard]);

  const aplicarFiltros = () => {
    setFiltrosAplicados({
      q: busca.trim() || undefined,
      cliente_id: clienteId ? Number(clienteId) : undefined,
      rota_id: rotaId ? Number(rotaId) : undefined,
      data: data || undefined,
    });
    setSucesso(null);
  };

  const limparFiltros = () => {
    setBusca('');
    setClienteId('');
    setRotaId('');
    setData('');
    setFiltrosAplicados({});
    setSucesso(null);
  };

  const alternarSelecao = (id: number) => {
    setIdsSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selecionarTodos = () => {
    setIdsSelecionados(idsSelecionaveis);
  };

  const limparSelecao = () => {
    setIdsSelecionados([]);
  };

  const enviarParaEntrega = async () => {
    setErro(null);
    setSucesso(null);

    const pedidosAlvo = pedidosSelecao.filter((pedido) => idsSelecionados.includes(pedido.id));

    if (pedidosAlvo.length === 0) {
      setErro('Selecione pelo menos um pedido em espera para enviar para entrega.');
      return;
    }

    setProcessando(true);
    try {
      await Promise.all(
        pedidosAlvo.map((pedido) =>
          pedidosApi.atualizarStatus(pedido.id, {
            status: 'CONFERIR',
          })
        )
      );
      setOrdemSelecaoRemaneio(idsSelecionados);
      setSucesso(`${pedidosAlvo.length} pedido(s) enviado(s) para entrega (status: Conferir).`);
      setIdsSelecionados([]);
      await carregarDados();
      setStep('remaneio');
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível enviar os pedidos selecionados para entrega.');
    } finally {
      setProcessando(false);
    }
  };

  const retirarDoRemaneio = async (pedidoId: number) => {
    setErro(null);
    setSucesso(null);
    setProcessando(true);
    try {
      await pedidosApi.atualizarStatus(pedidoId, {
        status: 'EM_ESPERA',
      });
      setOrdemSelecaoRemaneio((prev) => prev.filter((id) => id !== pedidoId));
      setSucesso(`Pedido #${pedidoId} retirado do remaneio com sucesso.`);
      await carregarDados();
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível retirar o pedido do remaneio.');
    } finally {
      setProcessando(false);
    }
  };

  useEffect(() => {
    if ((step === 'remaneio' || step === 'dashboard') && !hasPedidosNoRemaneio) {
      setStep('selecao');
    }
  }, [hasPedidosNoRemaneio, step]);

  if (!mounted) return null;

  if (!podeAcessarRemaneio) {
    return (
      <div className="app-shell">
        <div className="app-container">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            Apenas usuários com perfil admin, backoffice ou motorista podem acessar o remaneio.
          </div>
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
              <span className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700">
                <Image src="/modulos/remaneio1.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              </span>
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Remaneio
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Selecione pedidos para enviar para entrega.
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
        <FeedbackModal
          open={Boolean(sucesso)}
          variant="success"
          message={sucesso || ''}
          onClose={() => setSucesso(null)}
        />

        <section className="surface p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={step === 'selecao' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setStep('selecao')}
            >
              Step 1: Seleção
            </button>
            <button
              type="button"
              className={`${step === 'remaneio' ? 'btn-primary' : 'btn-secondary'} ${
                !hasPedidosNoRemaneio ? 'cursor-not-allowed opacity-45 grayscale' : ''
              }`}
              onClick={() => {
                if (hasPedidosNoRemaneio) setStep('remaneio');
              }}
              disabled={!hasPedidosNoRemaneio}
            >
              Step 2: Pedidos no Remaneio
            </button>
            <button
              type="button"
              className={`${step === 'dashboard' ? 'btn-primary' : 'btn-secondary'} ${
                !hasPedidosNoRemaneio ? 'cursor-not-allowed opacity-45 grayscale' : ''
              }`}
              onClick={() => {
                if (hasPedidosNoRemaneio) setStep('dashboard');
              }}
              disabled={!hasPedidosNoRemaneio}
            >
              Step 3: Dashboard
            </button>
          </div>

          {step !== 'dashboard' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr_1fr_0.9fr_auto_auto] md:items-end">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Buscar</label>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="Cliente, chave ou ID"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Cliente</label>
                <select className="ui-select" value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
                  <option value="">Todos</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.codigo_cliente} - {cliente.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Rota</label>
                <select className="ui-select" value={rotaId} onChange={(event) => setRotaId(event.target.value)}>
                  <option value="">Todas</option>
                  {rotas.map((rota) => (
                    <option key={rota.id} value={rota.id}>
                      {rota.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Data</label>
                <input
                  type="date"
                  className="ui-input"
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                />
              </div>
              <button type="button" className="btn-primary h-11" onClick={aplicarFiltros}>
                Aplicar
              </button>
              <button type="button" className="btn-secondary h-11" onClick={limparFiltros}>
                Limpar
              </button>
            </div>
          ) : null}
        </section>

        {step === 'selecao' ? (
          <section className="surface p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm text-slate-700">
                <p>
                  <strong>{idsSelecionados.length}</strong> pedido(s) selecionado(s)
                </p>
                <p>
                  Total selecionado: <strong>{formatarMoeda(totalSelecionado)}</strong>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-secondary" onClick={selecionarTodos}>
                  Selecionar todos
                </button>
                <button type="button" className="btn-secondary" onClick={limparSelecao}>
                  Limpar seleção
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={enviarParaEntrega}
                  disabled={processando || idsSelecionados.length === 0}
                >
                  {processando ? 'Enviando...' : 'Avançar para entrega'}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-6 text-slate-600">Carregando pedidos...</div>
            ) : pedidosSelecao.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                Nenhum pedido em espera encontrado para os filtros aplicados.
              </div>
            ) : (
              <div className="max-h-[22rem] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-left text-slate-700">
                      <th className="px-3 py-2">Sel.</th>
                      <th className="px-3 py-2">Pedido</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Rota</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosSelecao.map((pedido) => {
                      const selecionado = idsSelecionados.includes(pedido.id);
                      return (
                        <tr
                          key={pedido.id}
                          className={`border-b border-slate-100 ${selecionado ? 'bg-blue-50/70' : 'bg-white'}`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selecionado}
                              onChange={() => alternarSelecao(pedido.id)}
                              className="h-4 w-4 accent-blue-600"
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">#{pedido.id}</td>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-900">{pedido.cliente_nome}</p>
                            <p className="text-xs text-slate-600">{pedido.codigo_cliente}</p>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{pedido.rota_nome || 'Sem rota'}</td>
                          <td className="px-3 py-2 text-slate-700">{formatarData(pedido.data)}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">
                            {formatarMoeda(Number(pedido.valor_total || 0))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : step === 'remaneio' ? (
          <section className="surface p-4 space-y-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50/55 p-3 text-sm text-blue-900">
              Aqui ficam os pedidos que já foram remanejados para entrega (status <strong>Conferir</strong>).
            </div>
            {loading ? (
              <div className="py-6 text-slate-600">Carregando pedidos remanejados...</div>
            ) : pedidosRemaneio.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                Nenhum pedido no remaneio para os filtros aplicados.
              </div>
            ) : (
              <div className="max-h-[22rem] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-left text-slate-700">
                      <th className="px-3 py-2">Pedido</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Rota</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosRemaneio.map((pedido) => (
                      <tr key={pedido.id} className="border-b border-slate-100 bg-white">
                        <td className="px-3 py-2 font-semibold text-slate-900">#{pedido.id}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900">{pedido.cliente_nome}</p>
                          <p className="text-xs text-slate-600">{pedido.codigo_cliente}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{pedido.rota_nome || 'Sem rota'}</td>
                        <td className="px-3 py-2 text-slate-700">{formatarData(pedido.data)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(pedido.status)}`}
                          >
                            {getStatusLabel(pedido.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {formatarMoeda(Number(pedido.valor_total || 0))}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="btn-secondary px-3 py-1.5 text-xs"
                            onClick={() => retirarDoRemaneio(pedido.id)}
                            disabled={processando}
                          >
                            Retirar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="surface p-4 space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/55 p-3 text-sm text-blue-900">
              Dashboard detalhado dos pedidos enviados para entrega (status <strong>Conferir</strong>).
            </div>

            {!hasPedidosNoRemaneio ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                Nenhum pedido no remaneio para consolidar o dashboard.
              </div>
            ) : pedidosDashboard.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                Selecione pedidos no Step 1 para montar o dashboard em ordem de seleção.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Pedidos no remaneio</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{resumoDashboard.totalPedidos}</p>
                  </div>
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Pedidos com troca</p>
                    <p className="mt-1 text-xl font-extrabold text-violet-900">{resumoDashboard.pedidosComTroca}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-bold text-slate-900">Pedidos recentes no remaneio</h3>
                  <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-left text-slate-700">
                          <th className="px-3 py-2">Pedido</th>
                          <th className="px-3 py-2">Cliente</th>
                          <th className="px-3 py-2">Rota</th>
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Trocas</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumoDashboard.pedidosRecentes.map((pedido) => (
                          <tr key={pedido.id} className="border-b border-slate-100 bg-white">
                            <td className="px-3 py-2 font-semibold text-slate-900">#{pedido.id}</td>
                            <td className="px-3 py-2">
                              <p className="font-semibold text-slate-900">{pedido.cliente_nome}</p>
                              <p className="text-xs text-slate-600">{pedido.codigo_cliente}</p>
                            </td>
                            <td className="px-3 py-2 text-slate-700">{pedido.rota_nome || 'Sem rota'}</td>
                            <td className="px-3 py-2 text-slate-700">{formatarData(pedido.data)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(pedido.status)}`}
                              >
                                {getStatusLabel(pedido.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {Boolean(pedido.tem_trocas) || Number(pedido.qtd_trocas || 0) > 0 ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                                    {Number(pedido.qtd_trocas || 0)} troca(s)
                                  </span>
                                  {pedido.nomes_trocas ? (
                                    <p className="max-w-[18rem] truncate text-xs text-violet-900" title={pedido.nomes_trocas}>
                                      {pedido.nomes_trocas}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">Sem troca</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">
                              {formatarMoeda(Number(pedido.valor_total || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
