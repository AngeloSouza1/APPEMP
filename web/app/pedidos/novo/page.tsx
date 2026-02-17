'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  clienteProdutosApi,
  Cliente,
  clientesApi,
  pedidosApi,
  Produto,
  produtosApi,
  Rota,
  rotasApi,
  TrocaPedido,
  trocasApi,
} from '@/lib/api';
import PedidoDadosForm from '@/components/PedidoDadosForm';
import PedidoItensEditor from '@/components/PedidoItensEditor';
import PedidoTrocasModal from '@/components/PedidoTrocasModal';
import FeedbackModal from '@/components/FeedbackModal';
import { montarItensPayload, validarPedidoForm } from '@/lib/pedidos';
import { usePedidoItens } from '@/hooks/usePedidoItens';

export default function NovoPedidoPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalTrocasAberto, setModalTrocasAberto] = useState(false);
  const [modalSucessoTrocaAberto, setModalSucessoTrocaAberto] = useState(false);
  const [criandoTroca, setCriandoTroca] = useState(false);
  const [removendoTrocaId, setRemovendoTrocaId] = useState<number | null>(null);
  const [trocasRascunho, setTrocasRascunho] = useState<TrocaPedido[]>([]);
  const [trocaForm, setTrocaForm] = useState({
    item_pedido_id: '',
    produto_id: '',
    quantidade: '1',
    valor_troca: '0',
    motivo: '',
  });
  const [precoPersonalizadoPorProduto, setPrecoPersonalizadoPorProduto] = useState<Record<number, number>>({});
  const [produtosPermitidosIds, setProdutosPermitidosIds] = useState<number[]>([]);

  const [clienteId, setClienteId] = useState('');
  const [clienteBusca, setClienteBusca] = useState('');
  const [rotaId, setRotaId] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const {
    itens,
    buscaProdutoPorItem,
    setBuscaProdutoPorItem,
    carregarItens,
    atualizarItem,
    handleProdutoChange,
    adicionarItem,
    removerItem,
  } = usePedidoItens({ produtos, precoPersonalizadoPorProduto, startWithEmpty: true });

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const [clientesResp, rotasResp, produtosResp] = await Promise.all([
          clientesApi.listar(),
          rotasApi.listar(),
          produtosApi.listar(),
        ]);
        setClientes(clientesResp.data);
        setRotas(rotasResp.data);
        setProdutos(produtosResp.data);
        setErro(null);
      } catch (error) {
        console.error('Erro ao carregar dados para novo pedido:', error);
        setErro('Não foi possível carregar clientes, rotas e produtos.');
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const clienteIdParam = params.get('cliente_id');

    if (clienteIdParam) {
      setClienteId(clienteIdParam);
    }
  }, []);

  useEffect(() => {
    if (!clienteId) {
      setRotaId('');
      setPrecoPersonalizadoPorProduto({});
      setProdutosPermitidosIds([]);
      return;
    }
    const clienteSelecionado = clientes.find((cliente) => String(cliente.id) === clienteId);
    if (!clienteSelecionado) return;
    setRotaId(clienteSelecionado.rota_id ? String(clienteSelecionado.rota_id) : '');
  }, [clienteId, clientes]);

  useEffect(() => {
    const carregarRelacaoClienteProduto = async () => {
      if (!clienteId) {
        return;
      }
      try {
        const response = await clienteProdutosApi.listarPorCliente(Number(clienteId));
        const ids = response.data.map((item) => Number(item.produto_id));
        const mapaPrecos = response.data.reduce<Record<number, number>>((acc, item) => {
          const produtoIdNum = Number(item.produto_id);
          const valor = Number(item.valor_unitario);
          if (Number.isFinite(produtoIdNum) && Number.isFinite(valor)) {
            acc[produtoIdNum] = valor;
          }
          return acc;
        }, {});
        setProdutosPermitidosIds(ids);
        setPrecoPersonalizadoPorProduto(mapaPrecos);
      } catch (error: any) {
        const mensagemApi = error?.response?.data?.error as string | undefined;
        setErro(mensagemApi || 'Não foi possível carregar os preços personalizados do cliente.');
        setProdutosPermitidosIds([]);
        setPrecoPersonalizadoPorProduto({});
      }
    };

    carregarRelacaoClienteProduto();
  }, [clienteId]);

  useEffect(() => {
    if (!clienteId) return;
    if (produtosPermitidosIds.length === 0) return;

    const possuiItemInvalido = itens.some(
      (item) => item.produto_id && !produtosPermitidosIds.includes(Number(item.produto_id))
    );
    if (!possuiItemInvalido) return;

    carregarItens([
      {
        produto_id: '',
        quantidade: '1',
        embalagem: '',
        valor_unitario: '0',
        comissao: '0',
      },
    ]);
  }, [carregarItens, clienteId, itens, produtosPermitidosIds]);

  const clientesFiltrados = useMemo(() => {
    const termo = clienteBusca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((cliente) =>
      `${cliente.codigo_cliente} ${cliente.nome}`.toLowerCase().includes(termo)
    );
  }, [clienteBusca, clientes]);

  const podeCriarPedido = useMemo(() => {
    const itensPayload = montarItensPayload(itens);
    const erroValidacao = validarPedidoForm({
      clienteObrigatorio: true,
      clienteId,
      data,
      itens: itensPayload,
    });
    return !erroValidacao;
  }, [clienteId, data, itens]);

  const salvarPedido = async () => {
    const itensPayload = montarItensPayload(itens);
    const erroValidacao = validarPedidoForm({
      clienteObrigatorio: true,
      clienteId,
      data,
      itens: itensPayload,
    });
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSaving(true);
    try {
      const response = await pedidosApi.criar({
        cliente_id: Number(clienteId),
        rota_id: rotaId ? Number(rotaId) : undefined,
        data,
        status: 'EM_ESPERA',
        itens: itensPayload,
      });

      let houveErroTroca = false;
      if (trocasRascunho.length > 0) {
        for (const troca of trocasRascunho) {
          try {
            await trocasApi.criar({
              pedido_id: response.data.id,
              produto_id: troca.produto_id,
              quantidade: troca.quantidade,
              valor_troca: troca.valor_troca,
              motivo: troca.motivo || undefined,
            });
          } catch (errorTroca) {
            houveErroTroca = true;
            console.error('Erro ao criar troca no novo pedido:', errorTroca);
          }
        }
      }

      setErro(null);
      if (houveErroTroca) {
        router.replace(`/pedidos/${response.data.id}#trocas`);
      } else {
        router.replace('/pedidos');
      }
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      setErro('Não foi possível criar o pedido. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const adicionarTrocaRascunho = () => {
    if (!trocaForm.produto_id) {
      setErro('Selecione o produto da troca.');
      return;
    }
    const quantidade = Number(trocaForm.quantidade);
    if (!quantidade || quantidade <= 0) {
      setErro('Informe uma quantidade válida para a troca.');
      return;
    }

    setCriandoTroca(true);
    const produtoSelecionado = produtos.find(
      (produto) => produto.id === Number(trocaForm.produto_id)
    );
    const novaTroca: TrocaPedido = {
      id: -Date.now(),
      pedido_id: 0,
      item_pedido_id: null,
      produto_id: Number(trocaForm.produto_id),
      quantidade,
      valor_troca: Number(trocaForm.valor_troca) || 0,
      motivo: trocaForm.motivo.trim() || null,
      criado_em: new Date().toISOString(),
      codigo_produto: produtoSelecionado?.codigo_produto,
      produto_nome: produtoSelecionado?.nome,
    };

    setTrocasRascunho((estadoAtual) => [novaTroca, ...estadoAtual]);
    setTrocaForm({
      item_pedido_id: '',
      produto_id: '',
      quantidade: '1',
      valor_troca: '0',
      motivo: '',
    });
    setErro(null);
    setModalSucessoTrocaAberto(true);
    setCriandoTroca(false);
  };

  const excluirTrocaRascunho = (trocaId: number) => {
    setRemovendoTrocaId(trocaId);
    setTrocasRascunho((estadoAtual) => estadoAtual.filter((troca) => troca.id !== trocaId));
    setRemovendoTrocaId(null);
  };

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p className="text-slate-600">Carregando formulário...</p>
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
                className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-blue-200 bg-blue-50"
                aria-hidden="true"
              >
                <Image
                  src="/modulos/adicionar-pedido.png"
                  alt=""
                  width={52}
                  height={52}
                  className="h-[3.25rem] w-[3.25rem] object-contain"
                />
              </span>
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Novo Pedido
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  Preencha os dados para criar um novo pedido.
                </p>
              </div>
            </div>
            <Link href="/pedidos" className="btn-secondary">
              Voltar para lista
            </Link>
          </div>
        </nav>

        <FeedbackModal
          open={Boolean(erro)}
          variant="error"
          message={erro || ''}
          onClose={() => setErro(null)}
        />

        <div className="surface p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Dados do Pedido</h2>

          <PedidoDadosForm
            data={data}
            onDataChange={setData}
            rotaId={rotaId}
            onRotaChange={setRotaId}
            rotas={rotas}
            status="EM_ESPERA"
            onStatusChange={() => {}}
            statusOptions={['EM_ESPERA']}
            disableRotaEStatus
            cliente={{
              clienteBusca,
              onClienteBuscaChange: setClienteBusca,
              clienteId,
              onClienteIdChange: setClienteId,
              clientesFiltrados,
            }}
          />

          <PedidoItensEditor
            itens={itens}
            produtos={produtos}
            produtosPermitidosIds={produtosPermitidosIds}
            disabled={!clienteId}
            buscaProdutoPorItem={buscaProdutoPorItem}
            onBuscaProdutoChange={(index, valor) =>
              setBuscaProdutoPorItem((estadoAtual) =>
                estadoAtual.map((valorAtual, i) => (i === index ? valor : valorAtual))
              )
            }
            onProdutoChange={handleProdutoChange}
            onItemChange={atualizarItem}
            onAdicionarItem={adicionarItem}
            onRemoverItem={removerItem}
            disableRemoveWhenSingle
          />

          <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
            <button
              id="trocas"
              type="button"
              onClick={() => setModalTrocasAberto(true)}
              className={
                clienteId
                  ? 'btn-secondary'
                  : 'btn-secondary opacity-50 cursor-not-allowed bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-100'
              }
              disabled={!clienteId}
              title={clienteId ? 'Trocas' : 'Selecione um cliente para liberar trocas'}
            >
              Trocas
            </button>
            <Link
              href="/pedidos"
              className="btn-secondary"
            >
              Cancelar
            </Link>
            <button
              type="button"
              onClick={salvarPedido}
              disabled={saving || !podeCriarPedido}
              className="btn-primary"
              title={
                podeCriarPedido
                  ? 'Criar Pedido'
                  : 'Selecione um cliente e ao menos um item com produto'
              }
            >
              {saving ? 'Salvando...' : 'Criar Pedido'}
            </button>
          </div>
        </div>
      </div>

      <PedidoTrocasModal
        open={modalTrocasAberto}
        onClose={() => setModalTrocasAberto(false)}
        trocas={trocasRascunho}
        produtos={produtos}
        trocaForm={trocaForm}
        onTrocaFormChange={(campo, valor) =>
          setTrocaForm((estadoAtual) => {
            if (campo !== 'produto_id') {
              return { ...estadoAtual, [campo]: valor };
            }
            const produtoId = Number(valor);
            const valorPersonalizado =
              Number.isFinite(produtoId) && produtoId > 0
                ? precoPersonalizadoPorProduto[produtoId]
                : undefined;
            return {
              ...estadoAtual,
              produto_id: valor,
              valor_troca:
                valorPersonalizado !== undefined && Number.isFinite(valorPersonalizado)
                  ? String(valorPersonalizado)
                  : '0',
            };
          })
        }
        onAdicionarTroca={adicionarTrocaRascunho}
        onExcluirTroca={excluirTrocaRascunho}
        criandoTroca={criandoTroca}
        removendoTrocaId={removendoTrocaId}
        titulo="Trocas do Novo Pedido"
      />

      {modalSucessoTrocaAberto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setModalSucessoTrocaAberto(false)}
        >
          <div
            className="surface surface-strong w-full max-w-md p-5 text-center"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">Troca adicionada</h3>
            <p className="mt-2 text-sm text-slate-700">
              A troca foi incluída com sucesso no pedido em criação.
            </p>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setModalSucessoTrocaAberto(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
