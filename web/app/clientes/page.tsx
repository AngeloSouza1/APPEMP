'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cliente, clientesApi, Rota, rotasApi } from '@/lib/api';
import { auth } from '@/lib/auth';
import FeedbackModal from '@/components/FeedbackModal';

export default function ClientesPage() {
  const [mounted, setMounted] = useState(false);
  const [usuario, setUsuario] = useState<ReturnType<typeof auth.getUser>>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [editNomeCliente, setEditNomeCliente] = useState('');
  const [editRotaId, setEditRotaId] = useState('');
  const [editImagemUrlCliente, setEditImagemUrlCliente] = useState('');
  const [editLinkCliente, setEditLinkCliente] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [processandoAcaoCliente, setProcessandoAcaoCliente] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'bloqueados'>('todos');
  const [nomeCliente, setNomeCliente] = useState('');
  const [rotaId, setRotaId] = useState('');
  const [imagemUrlCliente, setImagemUrlCliente] = useState('');
  const [linkCliente, setLinkCliente] = useState('');
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
  const LIMITE_POR_PAGINA = 6;
  const podeCriarCliente = Boolean(nomeCliente.trim() && rotaId);

  useEffect(() => {
    setUsuario(auth.getUser());
    setMounted(true);
  }, []);

  const canManageCadastros =
    mounted && (usuario?.perfil === 'admin' || usuario?.perfil === 'backoffice');

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [clientesResp, rotasResp] = await Promise.all([
        clientesApi.listar(),
        rotasApi.listar(),
      ]);
      setClientes(clientesResp.data);
      setRotas(rotasResp.data);
      setErro(null);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setErro('Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter((cliente) => {
      const matchBusca = !termo
        || `${cliente.codigo_cliente} ${cliente.nome}`.toLowerCase().includes(termo);
      const ativo = cliente.ativo !== false;
      const matchStatus =
        filtroStatus === 'todos'
          ? true
          : filtroStatus === 'ativos'
            ? ativo
            : !ativo;
      return matchBusca && matchStatus;
    });
  }, [busca, clientes, filtroStatus]);

  const mapaRotas = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const rota of rotas) {
      mapa.set(rota.id, rota.nome);
    }
    return mapa;
  }, [rotas]);

  const totalPaginas = Math.max(1, Math.ceil(clientesFiltrados.length / LIMITE_POR_PAGINA));
  const clientesPaginados = useMemo(() => {
    const inicio = (pagina - 1) * LIMITE_POR_PAGINA;
    const fim = inicio + LIMITE_POR_PAGINA;
    return clientesFiltrados.slice(inicio, fim);
  }, [clientesFiltrados, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [busca, filtroStatus]);

  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [pagina, totalPaginas]);

  const criarCliente = async () => {
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para cadastrar clientes.');
      return;
    }
    if (!nomeCliente.trim() || !rotaId) {
      setErro('Preencha nome do cliente e rota.');
      return;
    }

    setSaving(true);
    try {
      const codigoGerado = `CL${Date.now().toString().slice(-8)}`;
      await clientesApi.criar({
        codigo_cliente: codigoGerado,
        nome: nomeCliente.trim(),
        rota_id: Number(rotaId),
        imagem_url: imagemUrlCliente.trim() || null,
        link: linkCliente.trim() || null,
      });
      setNomeCliente('');
      setRotaId('');
      setImagemUrlCliente('');
      setLinkCliente('');
      setModalNovoClienteAberto(false);
      setSucesso('Cliente criado com sucesso.');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      setErro('Não foi possível criar o cliente.');
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicaoCliente = (cliente: Cliente) => {
    setErro(null);
    setSucesso(null);
    setClienteEditando(cliente);
    setEditNomeCliente(cliente.nome);
    setEditRotaId(cliente.rota_id ? String(cliente.rota_id) : '');
    setEditImagemUrlCliente(cliente.imagem_url || '');
    setEditLinkCliente(cliente.link || '');
  };

  const salvarEdicaoCliente = async () => {
    if (!clienteEditando) return;
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para editar clientes.');
      return;
    }
    if (!editNomeCliente.trim()) {
      setErro('Informe o nome do cliente.');
      return;
    }

    setSalvandoEdicao(true);
    try {
      await clientesApi.atualizar(clienteEditando.id, {
        nome: editNomeCliente.trim(),
        rota_id: editRotaId ? Number(editRotaId) : null,
        imagem_url: editImagemUrlCliente.trim() || null,
        link: editLinkCliente.trim() || null,
      });
      setSucesso('Cliente atualizado com sucesso.');
      setClienteEditando(null);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      setErro('Não foi possível atualizar o cliente.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const alternarBloqueioCliente = async () => {
    if (!clienteEditando) return;
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para bloquear clientes.');
      return;
    }

    setProcessandoAcaoCliente(true);
    try {
      const ativoAtual = clienteEditando.ativo !== false;
      await clientesApi.atualizar(clienteEditando.id, { ativo: !ativoAtual });
      setSucesso(ativoAtual ? 'Cliente bloqueado com sucesso.' : 'Cliente desbloqueado com sucesso.');
      setClienteEditando((anterior) =>
        anterior ? { ...anterior, ativo: !ativoAtual } : anterior
      );
      await carregarDados();
    } catch (error) {
      console.error('Erro ao bloquear/desbloquear cliente:', error);
      setErro('Não foi possível atualizar o bloqueio do cliente.');
    } finally {
      setProcessandoAcaoCliente(false);
    }
  };

  const excluirCliente = async () => {
    if (!clienteEditando) return;
    setErro(null);
    setSucesso(null);

    if (!canManageCadastros) {
      setErro('Você não tem permissão para excluir clientes.');
      return;
    }

    setProcessandoAcaoCliente(true);
    try {
      await clientesApi.excluir(clienteEditando.id);
      setSucesso('Cliente excluído com sucesso.');
      setClienteEditando(null);
      setConfirmandoExclusao(false);
      setClienteSelecionado((atual) => (atual?.id === clienteEditando.id ? null : atual));
      await carregarDados();
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error);
      const mensagemApi = error?.response?.data?.error as string | undefined;
      setErro(mensagemApi || 'Não foi possível excluir o cliente.');
    } finally {
      setProcessandoAcaoCliente(false);
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
                <Image src="/modulos/clientes.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              </span>
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Clientes
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Cadastro e consulta de clientes.
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
              <h2 className="text-xl font-bold text-slate-900">Novo Cliente</h2>
              <p className="text-sm text-slate-600">Abra o modal para cadastrar cliente e rota.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalNovoClienteAberto(true)}
              className="btn-primary"
            >
              Novo Cliente
            </button>
          </section>
        )}

        <section className="surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_28rem_1fr] md:items-center">
            <h2 className="text-xl font-bold text-slate-900">Lista de Clientes</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_10rem]">
              <input
                type="text"
                placeholder="Buscar por código ou nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="ui-input"
              />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'ativos' | 'bloqueados')}
                className="ui-select"
              >
                <option value="todos">Todos</option>
                <option value="ativos">Ativos</option>
                <option value="bloqueados">Bloqueados</option>
              </select>
            </div>
            <span className="text-sm text-slate-600 font-medium md:text-right">
              {clientesFiltrados.length} cliente(s)
            </span>
          </div>

          {loading ? (
            <div className="py-6 text-slate-600">Carregando...</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="py-6 text-slate-600">Nenhum cliente encontrado.</div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
              {clientesPaginados.map((cliente) => {
                const rotaNome = cliente.rota_id
                  ? mapaRotas.get(cliente.rota_id) || `#${cliente.rota_id}`
                  : 'Sem rota';
                const cardTone = cliente.ativo === false
                  ? 'border-slate-400/80 bg-slate-100/80'
                  : cliente.rota_id
                    ? 'border-blue-400/70 bg-blue-50/35'
                    : 'border-amber-400/70 bg-amber-50/35';
                const codeTone = cliente.rota_id
                  ? 'border-blue-400/70 bg-blue-100/70'
                  : 'border-amber-400/70 bg-amber-100/70';

                return (
                  <div
                    key={cliente.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setClienteSelecionado(cliente)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setClienteSelecionado(cliente);
                      }
                    }}
                    className={`surface surface-strong h-40 p-3 flex flex-col justify-between cursor-pointer transition hover:-translate-y-0.5 hover:shadow-xl ${cardTone}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {cliente.imagem_url ? (
                          <img
                            src={cliente.imagem_url}
                            alt={cliente.nome}
                            className="h-10 w-10 rounded-lg border border-blue-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-100 text-sm font-extrabold text-blue-800">
                            {cliente.nome.trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                        <h3 className="truncate text-xl font-extrabold text-slate-900">
                          {cliente.nome}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          cliente.ativo === false
                            ? 'border-slate-500 bg-slate-200 text-slate-800'
                            : 'border-emerald-300 bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {cliente.ativo === false ? 'Bloqueado' : 'Ativo'}
                      </span>
                    </div>

                    <div className={`rounded-md px-2.5 py-1.5 ${codeTone}`}>
                      <p className="text-[11px] uppercase tracking-wide text-slate-700">Código</p>
                      <p className="text-base font-bold leading-tight text-slate-900">
                        {cliente.codigo_cliente}
                      </p>
                    </div>

                    <div className="flex items-end justify-between gap-2 border-t border-slate-200 pt-2">
                      <div className="flex min-w-0 flex-col">
                        <p className="truncate text-xs text-slate-700">
                          <span className="font-semibold">Rota:</span> {rotaNome}
                        </p>
                        {cliente.link ? (
                          <a
                            href={cliente.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-xs font-semibold text-blue-700 hover:text-blue-900"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Link localização
                          </a>
                        ) : (
                          <p className="truncate text-xs text-slate-500">Link não informado</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          abrirEdicaoCliente(cliente);
                        }}
                        className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {clienteSelecionado && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
              onClick={() => setClienteSelecionado(null)}
            >
              <div
                className="surface surface-strong w-full max-w-lg p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Cliente #{clienteSelecionado.id}</h3>
                    <p className="text-sm text-slate-700">{clienteSelecionado.nome}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClienteSelecionado(null)}
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
                    <p className="text-xs uppercase tracking-wide text-slate-600">Código</p>
                    <p className="mt-1 font-semibold">{clienteSelecionado.codigo_cliente}</p>
                  </div>
                  <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600">Rota</p>
                    <p className="mt-1 font-semibold">
                      {clienteSelecionado.rota_id
                        ? mapaRotas.get(clienteSelecionado.rota_id) || `#${clienteSelecionado.rota_id}`
                        : 'Sem rota'}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-300 bg-slate-50 p-3 md:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-slate-600">Nome completo</p>
                    <p className="mt-1 font-semibold">{clienteSelecionado.nome}</p>
                  </div>
                  <div className="rounded-md border border-slate-300 bg-slate-50 p-3 md:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-slate-600">Link de localização</p>
                    {clienteSelecionado.link ? (
                      <a
                        href={clienteSelecionado.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block truncate font-semibold text-blue-700 hover:text-blue-900"
                      >
                        {clienteSelecionado.link}
                      </a>
                    ) : (
                      <p className="mt-1 font-semibold text-slate-500">Não informado</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {modalNovoClienteAberto && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
              onClick={() => setModalNovoClienteAberto(false)}
            >
              <div
                className="surface surface-strong w-full max-w-lg p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Novo Cliente</h3>
                    <p className="text-sm text-slate-700">Preencha os dados para criar um cliente.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalNovoClienteAberto(false)}
                    className="nav-icon-link h-9 w-9"
                    aria-label="Fechar modal de novo cliente"
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
                    placeholder="Nome do cliente"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    className="ui-input"
                  />
                  <select
                    value={rotaId}
                    onChange={(e) => setRotaId(e.target.value)}
                    className="ui-select"
                  >
                    <option value="">Selecione a rota</option>
                    {rotas.map((rota) => (
                      <option key={rota.id} value={rota.id}>
                        {rota.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="URL da imagem (opcional)"
                    value={imagemUrlCliente}
                    onChange={(e) => setImagemUrlCliente(e.target.value)}
                    className="ui-input"
                  />
                  <input
                    type="text"
                    placeholder="Link da localização (opcional)"
                    value={linkCliente}
                    onChange={(e) => setLinkCliente(e.target.value)}
                    className="ui-input"
                  />
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalNovoClienteAberto(false)}
                    className="btn-secondary"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={criarCliente}
                    disabled={saving || !podeCriarCliente}
                    className="btn-primary"
                    title={
                      podeCriarCliente
                        ? 'Criar Cliente'
                        : 'Preencha nome do cliente e rota'
                    }
                  >
                    {saving ? 'Criando...' : 'Criar Cliente'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {clienteEditando && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
              onClick={() => setClienteEditando(null)}
            >
              <div
                className="surface surface-strong w-full max-w-lg p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Editar Cliente #{clienteEditando.id}</h3>
                    <p className="text-sm text-slate-700">{clienteEditando.codigo_cliente}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClienteEditando(null)}
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
                    <label className="mb-1 block text-sm font-semibold text-slate-800">Nome do cliente</label>
                    <input
                      type="text"
                      value={editNomeCliente}
                      onChange={(event) => setEditNomeCliente(event.target.value)}
                      className="ui-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-800">Rota</label>
                    <select
                      value={editRotaId}
                      onChange={(event) => setEditRotaId(event.target.value)}
                      className="ui-select"
                    >
                      <option value="">Sem rota</option>
                      {rotas.map((rota) => (
                        <option key={rota.id} value={rota.id}>
                          {rota.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-800">URL da imagem (opcional)</label>
                    <input
                      type="text"
                      value={editImagemUrlCliente}
                      onChange={(event) => setEditImagemUrlCliente(event.target.value)}
                      className="ui-input"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-800">
                      Link da localização (opcional)
                    </label>
                    <input
                      type="text"
                      value={editLinkCliente}
                      onChange={(event) => setEditLinkCliente(event.target.value)}
                      className="ui-input"
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                  <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600">Status</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {clienteEditando.ativo === false ? 'Bloqueado' : 'Ativo'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={alternarBloqueioCliente}
                      className="nav-icon-link h-10 w-10"
                      disabled={salvandoEdicao || processandoAcaoCliente}
                      aria-label={clienteEditando.ativo === false ? 'Desbloquear cliente' : 'Bloquear cliente'}
                      title={clienteEditando.ativo === false ? 'Desbloquear cliente' : 'Bloquear cliente'}
                    >
                      {clienteEditando.ativo === false ? (
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
                      disabled={salvandoEdicao || processandoAcaoCliente}
                      aria-label="Excluir cliente"
                      title="Excluir cliente"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h.69l.81 12.15A2 2 0 0 0 8.49 21h7.02a2 2 0 0 0 1.99-1.85L18.31 7H19a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm2 2h2V5h-2V5Zm-2.5 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm7 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm-3.5 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setClienteEditando(null)}
                    className="btn-secondary"
                    disabled={salvandoEdicao || processandoAcaoCliente}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarEdicaoCliente}
                    className="btn-primary"
                    disabled={salvandoEdicao || processandoAcaoCliente}
                  >
                    {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {clienteEditando && confirmandoExclusao && (
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
                  Excluir o cliente &quot;{clienteEditando.nome}&quot;? Esta ação não pode ser desfeita.
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(false)}
                    className="btn-secondary"
                    disabled={processandoAcaoCliente}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={excluirCliente}
                    className="nav-icon-link-danger h-10 px-3"
                    disabled={processandoAcaoCliente}
                  >
                    {processandoAcaoCliente ? 'Excluindo...' : 'Excluir cliente'}
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
      </div>
    </div>
  );
}
