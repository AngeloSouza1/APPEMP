'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clienteProdutosApi,
  clientesApi,
  Pedido,
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
import { montarItensPayload, STATUS_OPTIONS, validarPedidoForm } from '@/lib/pedidos';
import { usePedidoItens } from '@/hooks/usePedidoItens';

const toDateInput = (value: string) => {
  if (!value) return '';
  return value.slice(0, 10);
};

export default function EditarPedidoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pedidoId = Number(params.id);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStatusAutomatico, setSavingStatusAutomatico] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [destacarCamposInvalidosItens, setDestacarCamposInvalidosItens] = useState(false);
  const [modalPedidoAtualizadoAberto, setModalPedidoAtualizadoAberto] = useState(false);
  const [modalSucessoTrocaAberto, setModalSucessoTrocaAberto] = useState(false);
  const [trocas, setTrocas] = useState<TrocaPedido[]>([]);
  const [criandoTroca, setCriandoTroca] = useState(false);
  const [removendoTrocaId, setRemovendoTrocaId] = useState<number | null>(null);
  const [modalTrocasAberto, setModalTrocasAberto] = useState(false);
  const [precoPersonalizadoPorProduto, setPrecoPersonalizadoPorProduto] = useState<Record<number, number>>({});
  const [trocaForm, setTrocaForm] = useState({
    item_pedido_id: '',
    produto_id: '',
    quantidade: '1',
    valor_troca: '0',
    motivo: '',
  });

  const [data, setData] = useState('');
  const [rotaId, setRotaId] = useState('');
  const [statusPedido, setStatusPedido] = useState('EM_ESPERA');
  const {
    itens,
    buscaProdutoPorItem,
    setBuscaProdutoPorItem,
    carregarItens,
    atualizarItem,
    handleProdutoChange,
    adicionarItem,
    removerItem,
  } = usePedidoItens({ produtos, initialItens: [] });

  const carregarDados = useCallback(async () => {
    if (!Number.isFinite(pedidoId)) {
      setErro('ID de pedido inválido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [pedidoResp, rotasResp, produtosResp, clientesResp, trocasResp] = await Promise.all([
        pedidosApi.buscarPorId(pedidoId),
        rotasApi.listar(),
        produtosApi.listar(),
        clientesApi.listar(),
        trocasApi.listarPorPedido(pedidoId),
      ]);

      const pedidoData = pedidoResp.data;
      const clienteDoPedido = clientesResp.data.find(
        (cliente) => Number(cliente.id) === Number(pedidoData.cliente_id)
      );
      const rotaDoCadastroCliente = clienteDoPedido?.rota_id;
      const statusDoPedido = STATUS_OPTIONS.includes(
        pedidoData.status as (typeof STATUS_OPTIONS)[number]
      )
        ? pedidoData.status
        : 'EM_ESPERA';

      setPedido(pedidoData);
      setRotas(rotasResp.data);
      setProdutos(produtosResp.data);
      setTrocas(trocasResp.data);

      try {
        const clienteProdutosResp = await clienteProdutosApi.listarPorCliente(
          Number(pedidoData.cliente_id)
        );
        const mapaPrecos = clienteProdutosResp.data.reduce<Record<number, number>>((acc, item) => {
          const produtoIdNum = Number(item.produto_id);
          const valor = Number(item.valor_unitario);
          if (Number.isFinite(produtoIdNum) && Number.isFinite(valor)) {
            acc[produtoIdNum] = valor;
          }
          return acc;
        }, {});
        setPrecoPersonalizadoPorProduto(mapaPrecos);
      } catch {
        setPrecoPersonalizadoPorProduto({});
      }

      setData(toDateInput(pedidoData.data));
      setRotaId(
        rotaDoCadastroCliente !== undefined && rotaDoCadastroCliente !== null
          ? String(rotaDoCadastroCliente)
          : pedidoData.rota_id
            ? String(pedidoData.rota_id)
            : ''
      );
      setStatusPedido(statusDoPedido);

      carregarItens(
        pedidoData.itens.map((item) => ({
          produto_id: String(item.produto_id),
          quantidade: String(item.quantidade),
          embalagem: item.embalagem || '',
          valor_unitario: String(item.valor_unitario),
          comissao: String(item.comissao || 0),
        }))
      );

      setErro(null);
      setSucesso(null);
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      setErro('Não foi possível carregar os dados do pedido.');
    } finally {
      setLoading(false);
    }
  }, [pedidoId, carregarItens]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#trocas') {
      setModalTrocasAberto(true);
    }
  }, []);

  const podeSalvarPedido = useMemo(() => {
    const itensPayload = montarItensPayload(itens);
    const erroValidacao = validarPedidoForm({
      data,
      itens: itensPayload,
    });
    return !erroValidacao;
  }, [data, itens]);

  const salvarPedido = async () => {
    if (!pedido) return;
    const itensPayload = montarItensPayload(itens);
    const erroValidacao = validarPedidoForm({
      data,
      itens: itensPayload,
    });
    if (erroValidacao) {
      setErro(erroValidacao);
      setDestacarCamposInvalidosItens(
        erroValidacao.includes('Preencha os itens com produto, quantidade, valor unitário e comissão válidos.')
      );
      return;
    }

    setSaving(true);
    try {
      await pedidosApi.atualizar(pedido.id, {
        rota_id: rotaId ? Number(rotaId) : undefined,
        data,
        status: statusPedido,
        itens: itensPayload,
      });

      setErro(null);
      setSucesso(null);
      setDestacarCamposInvalidosItens(false);
      setModalPedidoAtualizadoAberto(true);
      setTimeout(() => {
        router.replace('/pedidos');
      }, 1200);
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      setErro('Não foi possível atualizar o pedido.');
    } finally {
      setSaving(false);
    }
  };

  const atualizarStatusAutomatico = async (novoStatus: string) => {
    if (!pedido) return;
    const statusAnterior = statusPedido;
    setStatusPedido(novoStatus);
    setErro(null);
    setSucesso(null);

    setSavingStatusAutomatico(true);
    try {
      await pedidosApi.atualizarStatus(pedido.id, {
        status: novoStatus,
      });

      setSucesso('Status atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setStatusPedido(statusAnterior);
      setErro('Não foi possível atualizar o status.');
    } finally {
      setSavingStatusAutomatico(false);
    }
  };

  const adicionarTroca = async () => {
    if (!pedido) return;
    if (!trocaForm.produto_id) {
      setErro('Selecione o produto da troca.');
      return;
    }
    const quantidadeTroca = Number(trocaForm.quantidade);
    if (!quantidadeTroca || quantidadeTroca <= 0) {
      setErro('Informe uma quantidade válida para a troca.');
      return;
    }

    setCriandoTroca(true);
    setErro(null);
    setSucesso(null);
    try {
      await trocasApi.criar({
        pedido_id: pedido.id,
        item_pedido_id: trocaForm.item_pedido_id ? Number(trocaForm.item_pedido_id) : undefined,
        produto_id: Number(trocaForm.produto_id),
        quantidade: quantidadeTroca,
        valor_troca: Number(trocaForm.valor_troca) || 0,
        motivo: trocaForm.motivo.trim() || undefined,
      });

      const trocasResp = await trocasApi.listarPorPedido(pedido.id);
      setTrocas(trocasResp.data);
      setTrocaForm((estadoAtual) => ({
        ...estadoAtual,
        item_pedido_id: '',
        produto_id: '',
        quantidade: '1',
        valor_troca: '0',
        motivo: '',
      }));
      setSucesso(null);
      setModalSucessoTrocaAberto(true);
    } catch (error) {
      console.error('Erro ao adicionar troca:', error);
      setErro('Não foi possível adicionar a troca.');
    } finally {
      setCriandoTroca(false);
    }
  };

  const excluirTroca = async (trocaId: number) => {
    if (!pedido) return;

    setRemovendoTrocaId(trocaId);
    setErro(null);
    setSucesso(null);
    try {
      await trocasApi.excluir(trocaId);
      const trocasResp = await trocasApi.listarPorPedido(pedido.id);
      setTrocas(trocasResp.data);
      setSucesso('Troca removida com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir troca:', error);
      setErro('Não foi possível excluir a troca.');
    } finally {
      setRemovendoTrocaId(null);
    }
  };

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p className="text-slate-600">Carregando pedido...</p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p className="text-red-600">Pedido não encontrado.</p>
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
                  src="/modulos/editar-pedido.png"
                  alt=""
                  width={52}
                  height={52}
                  className="h-[3.25rem] w-[3.25rem] object-contain"
                />
              </span>
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.4rem]">
                  Editar Pedido #{pedido.id}
                </h1>
                <p className="mt-1 text-base text-slate-700">
                  {pedido.codigo_cliente} - {pedido.cliente_nome}
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
        <FeedbackModal
          open={Boolean(sucesso)}
          variant="success"
          message={sucesso || ''}
          onClose={() => setSucesso(null)}
        />

        <div className="surface p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Dados do Pedido</h2>

          <PedidoDadosForm
            data={data}
            onDataChange={setData}
            rotaId={rotaId}
            onRotaChange={setRotaId}
            disableRota
            rotas={rotas}
            status={statusPedido}
            onStatusChange={atualizarStatusAutomatico}
            statusOptions={STATUS_OPTIONS}
          />

          <PedidoItensEditor
            itens={itens}
            produtos={produtos}
            destacarInvalidos={destacarCamposInvalidosItens}
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
          />

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              id="trocas"
              type="button"
              onClick={() => setModalTrocasAberto(true)}
              className="btn-secondary"
            >
              Trocas
            </button>
            <button
              type="button"
              onClick={salvarPedido}
              disabled={saving || savingStatusAutomatico || !podeSalvarPedido}
              className="btn-primary"
              title={
                podeSalvarPedido
                  ? 'Salvar Pedido'
                  : 'Preencha data e itens obrigatórios para salvar'
              }
            >
              {saving ? 'Salvando...' : 'Salvar Pedido'}
            </button>
          </div>
        </div>
      </div>

      <PedidoTrocasModal
        open={modalTrocasAberto}
        onClose={() => setModalTrocasAberto(false)}
        trocas={trocas}
        produtos={produtos}
        trocaForm={trocaForm}
        onTrocaFormChange={(campo, valor) =>
          setTrocaForm((estadoAtual) => {
            if (campo === 'item_pedido_id') {
              const itemSelecionado = pedido.itens.find(
                (item) => Number(item.id) === Number(valor)
              );
              if (!itemSelecionado?.produto_id) {
                return {
                  ...estadoAtual,
                  item_pedido_id: valor,
                  produto_id: '',
                  valor_troca: '0',
                };
              }
              const produtoId = Number(itemSelecionado.produto_id);
              const valorPersonalizado = precoPersonalizadoPorProduto[produtoId];
              return {
                ...estadoAtual,
                item_pedido_id: valor,
                produto_id: String(produtoId),
                valor_troca:
                  valorPersonalizado !== undefined && Number.isFinite(valorPersonalizado)
                    ? String(valorPersonalizado)
                    : '0',
              };
            }
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
        onAdicionarTroca={() => {
          void adicionarTroca();
        }}
        onExcluirTroca={(trocaId) => {
          void excluirTroca(trocaId);
        }}
        criandoTroca={criandoTroca}
        removendoTrocaId={removendoTrocaId}
        itemPedidoOpcoes={pedido.itens
          .filter((item) => typeof item.id === 'number')
          .map((item) => ({
            id: Number(item.id),
            label: `${item.codigo_produto} - ${item.produto_nome}`,
            produtoId: Number(item.produto_id),
          }))}
        titulo={`Trocas do Pedido #${pedido.id}`}
      />

      {modalPedidoAtualizadoAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="surface surface-strong w-full max-w-md p-5 text-center">
            <h3 className="text-lg font-bold text-slate-900">Pedido atualizado</h3>
            <p className="mt-2 text-sm text-slate-700">
              Pedido #{pedido.id} atualizado com sucesso.
            </p>
            <p className="mt-1 text-xs text-slate-500">Redirecionando para a lista...</p>
          </div>
        </div>
      )}

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
              A troca foi incluída com sucesso neste pedido.
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
