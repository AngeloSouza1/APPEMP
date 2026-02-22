export interface ItemPedido {
  id?: number;
  produto_id: number;
  quantidade: number;
  embalagem?: string;
  valor_unitario: number;
  comissao?: number;
  produto_nome?: string;
  codigo_produto?: string;
  valor_total_item?: number;
}

export interface Pedido {
  id: number;
  chave_pedido: string;
  data: string;
  status: string;
  ordem_remaneio?: number | null;
  usa_nf?: boolean;
  nf_imagem_url?: string | null;
  valor_total: number;
  valor_efetivado?: number;
  cliente_id: number;
  codigo_cliente: string;
  cliente_nome: string;
  rota_id?: number;
  rota_nome?: string;
  tem_trocas?: boolean;
  qtd_trocas?: number;
  nomes_trocas?: string;
  itens: ItemPedido[];
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TrocaPedido {
  id: number;
  pedido_id: number;
  item_pedido_id?: number | null;
  quantidade: number;
  valor_troca: number;
  motivo?: string | null;
  criado_em: string;
  produto_id: number;
  codigo_produto: string;
  produto_nome: string;
}
