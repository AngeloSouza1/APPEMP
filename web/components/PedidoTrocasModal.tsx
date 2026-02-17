'use client';

import { Produto, TrocaPedido } from '@/lib/api';

interface ItemPedidoOpcao {
  id: number;
  label: string;
  produtoId?: number;
}

interface TrocaFormState {
  item_pedido_id: string;
  produto_id: string;
  quantidade: string;
  valor_troca: string;
  motivo: string;
}

interface PedidoTrocasModalProps {
  open: boolean;
  onClose: () => void;
  trocas: TrocaPedido[];
  produtos: Produto[];
  trocaForm: TrocaFormState;
  onTrocaFormChange: (campo: keyof TrocaFormState, valor: string) => void;
  onAdicionarTroca: () => void;
  onExcluirTroca: (trocaId: number) => void;
  criandoTroca?: boolean;
  removendoTrocaId?: number | null;
  itemPedidoOpcoes?: ItemPedidoOpcao[];
  titulo?: string;
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);

const formatarDataHora = (value: string) => {
  if (!value) return '-';
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
};

export default function PedidoTrocasModal({
  open,
  onClose,
  trocas,
  produtos,
  trocaForm,
  onTrocaFormChange,
  onAdicionarTroca,
  onExcluirTroca,
  criandoTroca = false,
  removendoTrocaId = null,
  itemPedidoOpcoes = [],
  titulo = 'Trocas de Produtos',
}: PedidoTrocasModalProps) {
  if (!open) return null;

  const quantidadeNumero = Number(trocaForm.quantidade);
  const valorTrocaNumero = Number(trocaForm.valor_troca);
  const podeAdicionarTroca =
    Boolean(trocaForm.produto_id) &&
    trocaForm.quantidade.trim() !== '' &&
    trocaForm.valor_troca.trim() !== '' &&
    Number.isFinite(quantidadeNumero) &&
    quantidadeNumero > 0 &&
    Number.isFinite(valorTrocaNumero) &&
    valorTrocaNumero >= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      onClick={onClose}
    >
      <div
        className="surface surface-strong w-full max-w-5xl p-5 md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-12 md:items-end">
          {itemPedidoOpcoes.length > 0 && (
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">Item do pedido</label>
              <select
                value={trocaForm.item_pedido_id}
                onChange={(e) => onTrocaFormChange('item_pedido_id', e.target.value)}
                className="ui-select"
              >
                <option value="">Sem vínculo</option>
                {itemPedidoOpcoes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={itemPedidoOpcoes.length > 0 ? 'md:col-span-3' : 'md:col-span-4'}>
            <label className="mb-1 block text-xs font-medium text-gray-600">Produto da troca</label>
            <select
              value={trocaForm.produto_id}
              onChange={(e) => onTrocaFormChange('produto_id', e.target.value)}
              className="ui-select"
            >
              <option value="">Selecione</option>
              {produtos.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.codigo_produto} - {produto.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Quantidade</label>
            <input
              type="number"
              step="0.001"
              value={trocaForm.quantidade}
              onChange={(e) => onTrocaFormChange('quantidade', e.target.value)}
              className="ui-input"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Valor troca</label>
            <input
              type="number"
              step="0.01"
              value={trocaForm.valor_troca}
              onChange={(e) => onTrocaFormChange('valor_troca', e.target.value)}
              className="ui-input"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={onAdicionarTroca}
              disabled={criandoTroca || !podeAdicionarTroca}
              className="btn-primary w-full"
              title={
                podeAdicionarTroca
                  ? 'Adicionar troca'
                  : 'Preencha produto, quantidade e valor da troca'
              }
            >
              {criandoTroca ? 'Adicionando...' : 'Adicionar troca'}
            </button>
          </div>

          <div className="md:col-span-12">
            <label className="mb-1 block text-xs font-medium text-gray-600">Motivo</label>
            <input
              type="text"
              value={trocaForm.motivo}
              onChange={(e) => onTrocaFormChange('motivo', e.target.value)}
              className="ui-input"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Produto</th>
                  <th className="px-3 py-2 text-right font-semibold">Qtd.</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                  <th className="px-3 py-2 text-left font-semibold">Motivo</th>
                  <th className="px-3 py-2 text-left font-semibold">Criado em</th>
                  <th className="px-3 py-2 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {trocas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-slate-600">
                      Nenhuma troca registrada.
                    </td>
                  </tr>
                ) : (
                  trocas.map((troca) => (
                    <tr key={troca.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        {troca.codigo_produto} - {troca.produto_nome}
                      </td>
                      <td className="px-3 py-2 text-right">{troca.quantidade}</td>
                      <td className="px-3 py-2 text-right">{formatarMoeda(troca.valor_troca)}</td>
                      <td className="px-3 py-2">{troca.motivo || '-'}</td>
                      <td className="px-3 py-2">{formatarDataHora(troca.criado_em)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onExcluirTroca(troca.id)}
                          disabled={removendoTrocaId === troca.id}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          {removendoTrocaId === troca.id ? 'Removendo...' : 'Remover'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
