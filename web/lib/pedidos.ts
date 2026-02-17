export interface ItemForm {
  produto_id: string;
  quantidade: string;
  embalagem: string;
  valor_unitario: string;
  comissao: string;
}

export const STATUS_OPTIONS = ['EM_ESPERA', 'CONFERIR', 'EFETIVADO', 'CANCELADO'] as const;

export interface ItemPedidoPayload {
  produto_id: number;
  quantidade: number;
  embalagem?: string;
  valor_unitario: number;
  comissao: number;
}

interface ValidarPedidoFormParams {
  data: string;
  itens: ItemPedidoPayload[];
  clienteId?: string;
  clienteObrigatorio?: boolean;
}

export const montarItensPayload = (itens: ItemForm[]): ItemPedidoPayload[] => {
  return itens.map((item) => ({
    produto_id: Number(item.produto_id),
    quantidade: Number(item.quantidade),
    embalagem: item.embalagem || undefined,
    valor_unitario: Number(item.valor_unitario),
    comissao: Number(item.comissao || 0),
  }));
};

export const validarItensPayload = (itens: ItemPedidoPayload[]): string | null => {
  const possuiItemInvalido = itens.some(
    (item) =>
      !Number.isFinite(item.produto_id) ||
      item.produto_id <= 0 ||
      !Number.isFinite(item.quantidade) ||
      item.quantidade <= 0 ||
      !Number.isFinite(item.valor_unitario) ||
      item.valor_unitario < 0 ||
      !Number.isFinite(item.comissao)
  );

  if (possuiItemInvalido) {
    return 'Preencha os itens com produto, quantidade, valor unitário e comissão válidos.';
  }

  return null;
};

export const validarPedidoForm = ({
  data,
  itens,
  clienteId,
  clienteObrigatorio = false,
}: ValidarPedidoFormParams): string | null => {
  if (clienteObrigatorio && !clienteId) {
    return 'Selecione um cliente.';
  }

  if (!data) {
    return 'A data do pedido é obrigatória.';
  }

  if (itens.length === 0) {
    return 'Adicione pelo menos um item no pedido.';
  }

  return validarItensPayload(itens);
};
