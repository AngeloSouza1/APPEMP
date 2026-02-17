'use client';

import { useState } from 'react';
import { useCallback } from 'react';
import { Produto } from '@/lib/api';
import { ItemForm } from '@/lib/pedidos';

interface UsePedidoItensParams {
  produtos: Produto[];
  initialItens?: ItemForm[];
  precoPersonalizadoPorProduto?: Record<number, number>;
  startWithEmpty?: boolean;
}

const ITEM_VAZIO: ItemForm = {
  produto_id: '',
  quantidade: '1',
  embalagem: '',
  valor_unitario: '0',
  comissao: '0',
};

export const usePedidoItens = ({
  produtos,
  initialItens,
  precoPersonalizadoPorProduto = {},
  startWithEmpty = false,
}: UsePedidoItensParams) => {
  const itensIniciais =
    initialItens && initialItens.length > 0
      ? initialItens
      : startWithEmpty
        ? []
        : [{ ...ITEM_VAZIO }];
  const [itens, setItens] = useState<ItemForm[]>(itensIniciais);
  const [buscaProdutoPorItem, setBuscaProdutoPorItem] = useState<string[]>(
    new Array(itensIniciais.length).fill('')
  );

  const carregarItens = useCallback((novosItens: ItemForm[]) => {
    setItens(novosItens);
    setBuscaProdutoPorItem(new Array(novosItens.length).fill(''));
  }, []);

  const atualizarItem = useCallback((index: number, campo: keyof ItemForm, valor: string) => {
    setItens((estadoAtual) =>
      estadoAtual.map((item, i) => (i === index ? { ...item, [campo]: valor } : item))
    );
  }, []);

  const handleProdutoChange = useCallback((index: number, produtoId: string) => {
    const produtoSelecionado = produtos.find((p) => p.id === Number(produtoId));
    const precoPersonalizado = precoPersonalizadoPorProduto[Number(produtoId)];

    setItens((estadoAtual) =>
      estadoAtual.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          produto_id: produtoId,
          embalagem: produtoSelecionado?.embalagem || item.embalagem,
          valor_unitario:
            Number.isFinite(precoPersonalizado)
              ? String(precoPersonalizado)
              : produtoSelecionado?.preco_base !== undefined && produtoSelecionado?.preco_base !== null
              ? String(produtoSelecionado.preco_base)
              : item.valor_unitario,
        };
      })
    );
  }, [precoPersonalizadoPorProduto, produtos]);

  const adicionarItem = useCallback(() => {
    setItens((estadoAtual) => [{ ...ITEM_VAZIO }, ...estadoAtual]);
    setBuscaProdutoPorItem((estadoAtual) => ['', ...estadoAtual]);
  }, []);

  const removerItem = useCallback((index: number) => {
    setItens((estadoAtual) => estadoAtual.filter((_, i) => i !== index));
    setBuscaProdutoPorItem((estadoAtual) => estadoAtual.filter((_, i) => i !== index));
  }, []);

  return {
    itens,
    buscaProdutoPorItem,
    setBuscaProdutoPorItem,
    carregarItens,
    atualizarItem,
    handleProdutoChange,
    adicionarItem,
    removerItem,
  };
};
