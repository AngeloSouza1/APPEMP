 'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, Pedido, pedidosApi } from '@/lib/api';
import { auth } from '@/lib/auth';

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

export default function Home() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<ReturnType<typeof auth.getUser>>(null);
  const [pedidosMotorista, setPedidosMotorista] = useState<Pedido[]>([]);
  const [carregandoDashboardMotorista, setCarregandoDashboardMotorista] = useState(false);

  useEffect(() => {
    const usuarioLocal = auth.getUser();
    setUsuario(usuarioLocal);

    const carregarUsuarioAtual = async () => {
      try {
        const token = auth.getToken();
        if (!token) return;
        const response = await authApi.me();
        setUsuario(response.data.user);
        auth.setSession(token, response.data.user);
      } catch (error) {
        console.error('Erro ao atualizar usuário autenticado:', error);
      }
    };

    void carregarUsuarioAtual();
  }, []);

  const carregarDashboardMotorista = useCallback(async () => {
    if (usuario?.perfil !== 'motorista') return;
    setCarregandoDashboardMotorista(true);
    try {
      const response = await pedidosApi.listarPaginado({
        page: 1,
        limit: 200,
        status: 'CONFERIR',
      });
      setPedidosMotorista(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar dashboard do motorista:', error);
    } finally {
      setCarregandoDashboardMotorista(false);
    }
  }, [usuario?.perfil]);

  useEffect(() => {
    if (usuario?.perfil !== 'motorista') return;
    void carregarDashboardMotorista();
    const timer = setInterval(() => {
      void carregarDashboardMotorista();
    }, 15000);
    return () => clearInterval(timer);
  }, [carregarDashboardMotorista, usuario?.perfil]);

  const sair = () => {
    auth.clearToken();
    router.replace('/login');
  };

  const atalhos = [
    {
      href: '/pedidos',
      titulo: 'Pedidos',
      descricao: 'Visualize e gerencie todos os pedidos',
      imagem: '/modulos/pedidos.png',
      tema: {
        topo: 'from-blue-500/80 via-cyan-500/70 to-indigo-500/80',
        icone: 'border-blue-300 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 group-hover:from-blue-200 group-hover:to-indigo-200',
        seta: 'border-blue-200 bg-blue-50 text-blue-700 group-hover:border-blue-300 group-hover:bg-blue-100',
        linha: 'from-blue-200 via-blue-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M3 4.75A1.75 1.75 0 0 1 4.75 3h14.5A1.75 1.75 0 0 1 21 4.75v3.5A1.75 1.75 0 0 1 19.25 10H4.75A1.75 1.75 0 0 1 3 8.25v-3.5Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h14.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25H4.75Zm-1.75 9A1.75 1.75 0 0 1 4.75 11h14.5A1.75 1.75 0 0 1 21 12.75v6.5A1.75 1.75 0 0 1 19.25 21H4.75A1.75 1.75 0 0 1 3 19.25v-6.5Zm1.75-.25a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25h14.5a.25.25 0 0 0 .25-.25v-6.5a.25.25 0 0 0-.25-.25H4.75Z" />
        </svg>
      ),
    },
    {
      href: '/clientes',
      titulo: 'Clientes',
      descricao: 'Gerencie o cadastro de clientes',
      imagem: '/modulos/clientes.png',
      tema: {
        topo: 'from-emerald-500/80 via-teal-500/70 to-cyan-500/80',
        icone: 'border-emerald-300 bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 group-hover:from-emerald-200 group-hover:to-teal-200',
        seta: 'border-emerald-200 bg-emerald-50 text-emerald-700 group-hover:border-emerald-300 group-hover:bg-emerald-100',
        linha: 'from-emerald-200 via-emerald-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M12 12a5 5 0 1 0-4.999-5A5 5 0 0 0 12 12Zm0 2c-4.337 0-8 2.027-8 4.425V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.575C20 16.027 16.337 14 12 14Z" />
        </svg>
      ),
    },
    {
      href: '/cliente-produtos',
      titulo: 'Preços por Cliente',
      descricao: 'Defina produtos e valores personalizados por cliente',
      imagem: '/modulos/precos-cliente.png',
      tema: {
        topo: 'from-violet-500/80 via-fuchsia-500/70 to-purple-500/80',
        icone: 'border-violet-300 bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-700 group-hover:from-violet-200 group-hover:to-fuchsia-200',
        seta: 'border-violet-200 bg-violet-50 text-violet-700 group-hover:border-violet-300 group-hover:bg-violet-100',
        linha: 'from-violet-200 via-violet-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M12 1.75a1 1 0 0 1 1 1V4h2.25A2.75 2.75 0 0 1 18 6.75V9h1.25A2.75 2.75 0 0 1 22 11.75v5.5A2.75 2.75 0 0 1 19.25 20h-2.5a1 1 0 1 1 0-2h2.5a.75.75 0 0 0 .75-.75v-5.5a.75.75 0 0 0-.75-.75h-2.5a1 1 0 0 1-1-1V6.75a.75.75 0 0 0-.75-.75H13v1.25a1 1 0 1 1-2 0V6H8.75A2.75 2.75 0 0 0 6 8.75V11H4.75A2.75 2.75 0 0 0 2 13.75v5.5A2.75 2.75 0 0 0 4.75 22h6.5A2.75 2.75 0 0 0 14 19.25v-5.5A2.75 2.75 0 0 0 11.25 11H8V8.75c0-.414.336-.75.75-.75H11V2.75a1 1 0 0 1 1-1Zm-.75 11.25h-6.5a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h6.5a.75.75 0 0 0 .75-.75v-5.5a.75.75 0 0 0-.75-.75Zm-3.25 2a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1h-1a1 1 0 1 1 0-2h1v-1a1 1 0 0 1 1-1Z" />
        </svg>
      ),
    },
    {
      href: '/produtos',
      titulo: 'Produtos',
      descricao: 'Gerencie o cadastro de produtos',
      imagem: '/modulos/produtos.png',
      tema: {
        topo: 'from-orange-500/80 via-amber-500/70 to-yellow-500/80',
        icone: 'border-orange-300 bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 group-hover:from-orange-200 group-hover:to-amber-200',
        seta: 'border-orange-200 bg-orange-50 text-orange-700 group-hover:border-orange-300 group-hover:bg-orange-100',
        linha: 'from-orange-200 via-orange-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M12 2 3 6.5V17.5L12 22l9-4.5V6.5L12 2Zm0 2.236 6.762 3.381L12 11 5.238 7.617 12 4.236Zm-7 5.145 6 3v6.727l-6-3V9.38Zm14 6.728-6 3V12.38l6-3v6.729Z" />
        </svg>
      ),
    },
    {
      href: '/rotas',
      titulo: 'Rotas',
      descricao: 'Gerencie as rotas de entrega',
      imagem: '/modulos/rotas.png',
      tema: {
        topo: 'from-sky-500/80 via-cyan-500/70 to-blue-500/80',
        icone: 'border-sky-300 bg-gradient-to-br from-sky-100 to-cyan-100 text-sky-700 group-hover:from-sky-200 group-hover:to-cyan-200',
        seta: 'border-sky-200 bg-sky-50 text-sky-700 group-hover:border-sky-300 group-hover:bg-sky-100',
        linha: 'from-sky-200 via-sky-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0-6 6c0 4.2 6 11 6 11s6-6.8 6-11a6 6 0 0 0-6-6Zm0 8.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
        </svg>
      ),
    },
    {
      href: '/remaneio',
      titulo: 'Remaneio',
      descricao: 'Selecione pedidos para entrega',
      imagem: '/modulos/remaneio1.png',
      tema: {
        topo: 'from-teal-500/80 via-cyan-500/70 to-blue-500/80',
        icone: 'border-teal-300 bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-700 group-hover:from-teal-200 group-hover:to-cyan-200',
        seta: 'border-teal-200 bg-teal-50 text-teal-700 group-hover:border-teal-300 group-hover:bg-teal-100',
        linha: 'from-teal-200 via-teal-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2h1.5A2.5 2.5 0 0 1 21 9.5v6A2.5 2.5 0 0 1 18.5 18H18v.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 2 18.5v-11A2.5 2.5 0 0 1 4.5 5H5Zm2 2h10V5H5v2Zm-.5 2A.5.5 0 0 0 4 9.5v9c0 .276.224.5.5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11Zm14 1h-1v6h1a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5ZM7 12a1 1 0 1 1 0-2h6a1 1 0 1 1 0 2H7Zm0 4a1 1 0 1 1 0-2h4a1 1 0 1 1 0 2H7Z" />
        </svg>
      ),
    },
    {
      href: '/relatorios',
      titulo: 'Relatórios',
      descricao: 'Acompanhe produção, rotas e produtos por rota',
      imagem: '/modulos/relatorios.png',
      tema: {
        topo: 'from-indigo-500/80 via-blue-500/70 to-cyan-500/80',
        icone: 'border-indigo-300 bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 group-hover:from-indigo-200 group-hover:to-blue-200',
        seta: 'border-indigo-200 bg-indigo-50 text-indigo-700 group-hover:border-indigo-300 group-hover:bg-indigo-100',
        linha: 'from-indigo-200 via-indigo-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M4 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 1 0 0-2H5V4a1 1 0 0 0-1-1Zm4 10a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Zm5-4a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm5-3a1 1 0 0 1 1 1v9a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1Z" />
        </svg>
      ),
    },
    {
      href: '/historico',
      titulo: 'Histórico',
      descricao: 'Extrato de vendas, baixas e saldo por período',
      imagem: '/modulos/historico1.png',
      tema: {
        topo: 'from-slate-500/80 via-blue-500/70 to-indigo-500/80',
        icone: 'border-slate-300 bg-gradient-to-br from-slate-100 to-blue-100 text-slate-700 group-hover:from-slate-200 group-hover:to-blue-200',
        seta: 'border-slate-200 bg-slate-50 text-slate-700 group-hover:border-slate-300 group-hover:bg-slate-100',
        linha: 'from-slate-200 via-slate-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M6 2a1 1 0 0 0-1 1v18a1 1 0 0 0 1.6.8l3.4-2.55 3.4 2.55a1 1 0 0 0 1.2 0L18 19.25l3.4 2.55A1 1 0 0 0 23 21V7a3 3 0 0 0-3-3h-4.05A4 4 0 0 0 12 1a4 4 0 0 0-3.95 3H6Zm6-1a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM7 9a1 1 0 1 1 0-2h10a1 1 0 1 1 0 2H7Zm0 4a1 1 0 1 1 0-2h6a1 1 0 1 1 0 2H7Zm0 4a1 1 0 1 1 0-2h8a1 1 0 1 1 0 2H7Z" />
        </svg>
      ),
    },
    {
      href: '/usuarios',
      titulo: 'Usuários',
      descricao: 'Gerencie acessos e perfis de usuários',
      imagem: '/modulos/usuarios.png',
      tema: {
        topo: 'from-rose-500/80 via-pink-500/70 to-red-500/80',
        icone: 'border-rose-300 bg-gradient-to-br from-rose-100 to-pink-100 text-rose-700 group-hover:from-rose-200 group-hover:to-pink-200',
        seta: 'border-rose-200 bg-rose-50 text-rose-700 group-hover:border-rose-300 group-hover:bg-rose-100',
        linha: 'from-rose-200 via-rose-100 to-transparent',
      },
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M7.5 11a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 7.5 11Zm9 0A3.5 3.5 0 1 0 13 7.5a3.5 3.5 0 0 0 3.5 3.5ZM2 18.2V20a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1.8C13 16.43 10.54 15 7.5 15S2 16.43 2 18.2Zm10 0V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5c0-2.4-2.24-4.5-5.5-4.5a7.44 7.44 0 0 0-2.6.45A5.62 5.62 0 0 1 16 18.2Z" />
        </svg>
      ),
    },
  ];

  const atalhosVisiveis = !usuario
    ? []
    : usuario.perfil === 'vendedor'
      ? atalhos.filter((atalho) => atalho.href === '/pedidos')
      : usuario.perfil === 'motorista'
        ? []
      : usuario.perfil === 'backoffice'
        ? atalhos.filter((atalho) => atalho.href !== '/usuarios')
        : atalhos;

  const resumoMotorista = useMemo(() => {
    const totalPedidos = pedidosMotorista.length;
    const valorTotal = pedidosMotorista.reduce((acc, pedido) => acc + Number(pedido.valor_total || 0), 0);
    const pedidosComTroca = pedidosMotorista.filter(
      (pedido) => Boolean(pedido.tem_trocas) || Number(pedido.qtd_trocas || 0) > 0
    ).length;
    const pedidosOrdenados = [...pedidosMotorista];
    return { totalPedidos, valorTotal, pedidosComTroca, pedidosOrdenados };
  }, [pedidosMotorista]);

  return (
    <div className="app-shell">
      <div className="app-container space-y-7">
        <section className="surface p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-[4.8rem] w-[4.8rem] items-center justify-center rounded-2xl border border-blue-200 bg-blue-50">
                <Image
                  src="/processado1.png"
                  alt=""
                  width={58}
                  height={58}
                  className="h-[3.65rem] w-[3.65rem] object-contain"
                />
              </span>
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.55rem]">
                  APPEMP
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Central de operações do sistema de pedidos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
                {usuario?.imagem_url ? (
                  <img
                    src={usuario.imagem_url}
                    alt={usuario.nome}
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
                    {usuario?.nome?.trim()?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                )}
                {usuario ? `${usuario.nome} (${usuario.perfil})` : 'Carregando usuário...'}
              </span>
              <button
                type="button"
                onClick={sair}
                className="nav-icon-link nav-icon-link-danger h-10 w-10"
                aria-label="Sair"
                title="Sair"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M14 3a1 1 0 1 0 0 2h4v14h-4a1 1 0 1 0 0 2h5a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-5ZM10.707 7.293a1 1 0 0 0-1.414 1.414L11.586 11H4a1 1 0 1 0 0 2h7.586l-2.293 2.293a1 1 0 1 0 1.414 1.414l4-4a1 1 0 0 0 0-1.414l-4-4Z" />
                </svg>
                <span className="sr-only">Sair</span>
              </button>
            </div>
          </div>
        </section>

        {usuario?.perfil === 'motorista' ? (
          <section className="surface p-4 space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/55 p-3 text-sm text-blue-900">
              Dashboard do motorista com atualização automática dos pedidos para entrega (status <strong>Conferir</strong>).
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Pedidos para entrega</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{resumoMotorista.totalPedidos}</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Pedidos com troca</p>
                <p className="mt-1 text-2xl font-black text-violet-900">{resumoMotorista.pedidosComTroca}</p>
              </div>
            </div>

            {carregandoDashboardMotorista ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                Carregando pedidos...
              </div>
            ) : resumoMotorista.pedidosOrdenados.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                Nenhum pedido no remaneio para entrega no momento.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h2 className="text-sm font-bold text-slate-900">Relação de clientes e itens para entrega</h2>
                <div className="mt-3 max-h-[26rem] overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-left text-slate-700">
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Itens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumoMotorista.pedidosOrdenados.map((pedido) => (
                        <tr
                          key={`pedido-${pedido.id}`}
                          className="border-b border-slate-200 odd:bg-white even:bg-slate-100"
                        >
                          <td className="px-4 py-4 align-top">
                            <p className="font-semibold text-slate-900">{pedido.cliente_nome}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                              <span>Pedido #{pedido.id}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {pedido.itens && pedido.itens.length > 0 ? (
                              <div className="space-y-2">
                                <ul className="space-y-2">
                                  {pedido.itens.map((item, index) => (
                                    <li
                                      key={`${pedido.id}-${item.id ?? item.produto_id}-${index}`}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5 text-xs text-slate-700"
                                    >
                                      <span className="font-semibold text-slate-800">
                                        {item.produto_nome || item.codigo_produto || `Produto #${item.produto_id}`}
                                      </span>
                                      <span>
                                        {Number(item.quantidade || 0).toLocaleString('pt-BR')} {item.embalagem || ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {Boolean(pedido.tem_trocas) || Number(pedido.qtd_trocas || 0) > 0 ? (
                                  <div className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-xs text-violet-900">
                                    <p className="font-semibold">
                                      Trocas do pedido ({Number(pedido.qtd_trocas || 0)})
                                    </p>
                                    <p className="mt-0.5 text-violet-800">
                                      {pedido.nomes_trocas
                                        ? pedido.nomes_trocas
                                            .split(',')
                                            .map((nome) => nome.trim())
                                            .filter(Boolean)
                                            .join(', ')
                                        : 'Produtos de troca cadastrados neste pedido.'}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-600">Sem itens detalhados para este pedido.</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Acessos Rápidos</h2>
              <span className="text-sm text-slate-600">{atalhosVisiveis.length} módulos</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {atalhosVisiveis.map((atalho) => (
                <Link
                  key={atalho.titulo}
                  href={atalho.href}
                  className="surface group relative block overflow-hidden p-5 transition duration-200 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <span className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${atalho.tema.topo} opacity-90`} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm ring-1 ring-white/80 transition group-hover:scale-105 ${atalho.tema.icone}`}>
                        <Image
                          src={atalho.imagem}
                          alt={atalho.titulo}
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                        />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[1.85rem] font-bold leading-tight text-slate-900">{atalho.titulo}</h3>
                        <p className="mt-1 text-sm text-slate-700">{atalho.descricao}</p>
                      </div>
                    </div>
                    <span className={`mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${atalho.tema.seta}`}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                        <path d="M7.25 4a1 1 0 0 0 0 2h8.336L4.293 17.293a1 1 0 1 0 1.414 1.414L17 7.414V15.75a1 1 0 1 0 2 0V5a1 1 0 0 0-1-1H7.25Z" />
                      </svg>
                    </span>
                  </div>
                  <div className={`mt-4 h-px w-full bg-gradient-to-r ${atalho.tema.linha}`} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
