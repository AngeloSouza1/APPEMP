'use client';

import { Produto } from '@/lib/api';
import { ItemForm } from '@/lib/pedidos';

interface PedidoItensEditorProps {
  itens: ItemForm[];
  produtos: Produto[];
  buscaProdutoPorItem: string[];
  onBuscaProdutoChange: (index: number, valor: string) => void;
  onProdutoChange: (index: number, produtoId: string) => void;
  onItemChange: (index: number, campo: keyof ItemForm, valor: string) => void;
  onAdicionarItem: () => void;
  onRemoverItem: (index: number) => void;
  disableRemoveWhenSingle?: boolean;
  produtosPermitidosIds?: number[];
  disabled?: boolean;
  destacarInvalidos?: boolean;
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

export default function PedidoItensEditor({
  itens,
  produtos,
  buscaProdutoPorItem,
  onBuscaProdutoChange,
  onProdutoChange,
  onItemChange,
  onAdicionarItem,
  onRemoverItem,
  disableRemoveWhenSingle = false,
  produtosPermitidosIds = [],
  disabled = false,
  destacarInvalidos = false,
}: PedidoItensEditorProps) {
  const itemMaisRecente = itens[0];
  const podeAdicionarItem = itens.length === 0 || Boolean(itemMaisRecente?.produto_id?.trim());
  const produtosSelecionados = itens.map((item) => item.produto_id).filter(Boolean);
  const limitarPorVinculo = produtosPermitidosIds.length > 0;

  const totalPrevisto = itens.reduce((acc, item) => {
    const quantidade = Number(item.quantidade) || 0;
    const valorUnitario = Number(item.valor_unitario) || 0;
    return acc + quantidade * valorUnitario;
  }, 0);

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-800">Itens</h3>
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            if (!podeAdicionarItem) return;
            onAdicionarItem();
          }}
          disabled={disabled || !podeAdicionarItem}
          className="btn-primary text-sm"
          title={
            disabled
              ? 'Selecione um cliente para liberar os itens'
              : podeAdicionarItem
              ? 'Adicionar Item'
              : 'Selecione um produto no item mais recente antes de adicionar outro'
          }
        >
          Adicionar Item
        </button>
      </div>

      <div
        className={`pr-1 space-y-3 ${
          itens.length >= 2 ? 'max-h-[15.5rem] overflow-y-auto' : ''
        }`}
      >
        {itens.map((item, index) => {
          const quantidadeNum = Number(item.quantidade);
          const valorUnitarioNum = Number(item.valor_unitario);
          const produtoInvalido = destacarInvalidos && !item.produto_id?.trim();
          const quantidadeInvalida =
            destacarInvalidos && (!Number.isFinite(quantidadeNum) || quantidadeNum <= 0);
          const valorUnitarioInvalido =
            destacarInvalidos && (!Number.isFinite(valorUnitarioNum) || valorUnitarioNum < 0);

          return (
          <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-12 md:items-start">
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Produto</label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Buscar produto"
                  value={buscaProdutoPorItem[index] || ''}
                  onChange={(e) => onBuscaProdutoChange(index, e.target.value)}
                  className="ui-input"
                  disabled={disabled}
                />
                <select
                  value={item.produto_id}
                  onChange={(e) => onProdutoChange(index, e.target.value)}
                  className={`ui-select ${produtoInvalido ? 'border-red-400 bg-red-50 text-red-900' : ''}`}
                  disabled={disabled}
                >
                  <option value="">Selecione</option>
                  {produtos
                    .filter((produto) => {
                      if (limitarPorVinculo && !produtosPermitidosIds.includes(produto.id)) {
                        return false;
                      }
                      const termo = (buscaProdutoPorItem[index] || '').trim().toLowerCase();
                      if (!termo) return true;
                      return `${produto.codigo_produto} ${produto.nome}`
                        .toLowerCase()
                        .includes(termo);
                    })
                    .map((produto) => (
                      <option
                        key={produto.id}
                        value={produto.id}
                        disabled={
                          produtosSelecionados.includes(String(produto.id))
                          && String(produto.id) !== item.produto_id
                        }
                      >
                        {produto.codigo_produto} - {produto.nome}
                      </option>
                    ))}
                </select>
              </div>
              {limitarPorVinculo && (
                <p className="mt-1 text-[11px] text-slate-600">
                  Mostrando apenas produtos vinculados ao cliente selecionado.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantidade</label>
              <input
                type="number"
                step="0.001"
                value={item.quantidade}
                onChange={(e) => onItemChange(index, 'quantidade', e.target.value)}
                className={`ui-input ${quantidadeInvalida ? 'border-red-400 bg-red-50 text-red-900' : ''}`}
                disabled={disabled}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Embalagem</label>
              <input
                type="text"
                value={item.embalagem}
                onChange={(e) => onItemChange(index, 'embalagem', e.target.value)}
                className="ui-input"
                disabled={disabled}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Vlr Unit.</label>
              <input
                type="number"
                step="0.01"
                value={item.valor_unitario}
                onChange={(e) => onItemChange(index, 'valor_unitario', e.target.value)}
                className={`ui-input ${valorUnitarioInvalido ? 'border-red-400 bg-red-50 text-red-900' : ''}`}
                disabled={disabled}
              />
            </div>

            <div className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium opacity-0 select-none">
                Ação
              </span>
              <button
                type="button"
                onClick={() => onRemoverItem(index)}
                disabled={disabled || (disableRemoveWhenSingle && itens.length === 1)}
                className="w-full px-2 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          </div>
        )})}
      </div>

      {disabled && (
        <p className="mt-3 text-xs text-amber-700">
          Selecione um cliente para liberar a edição dos itens.
        </p>
      )}

      <div className="mt-4 text-right">
        <p className="text-sm text-gray-600">Total previsto</p>
        <p className="text-2xl font-bold text-gray-900">{formatarMoeda(totalPrevisto)}</p>
      </div>
    </div>
  );
}
