import axios from 'axios';
import { auth } from './auth';

// Garantir que só usa a URL do cliente
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  }
  // Durante SSR, retornar uma URL vazia (não deve ser usado)
  return 'http://localhost:3000';
};

const API_URL = getApiUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos
});

// Interceptor para debug
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = auth.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Erro na requisição:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status as number | undefined;
    // Evitar overlay em erros 4xx esperados (ex.: 409 de conflito de negócio)
    if (!status || status >= 500) {
      console.error('[API] Erro na resposta:', error.message);
    }
    if (typeof window !== 'undefined' && status === 401) {
      auth.clearToken();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
      console.error('[API] Não foi possível conectar ao backend em:', API_URL);
    }
    return Promise.reject(error);
  }
);

// Tipos
export interface Cliente {
  id: number;
  codigo_cliente: string;
  nome: string;
  rota_id?: number;
  ativo?: boolean;
  imagem_url?: string | null;
  link?: string | null;
}

export interface Produto {
  id: number;
  codigo_produto: string;
  nome: string;
  embalagem?: string;
  preco_base?: number;
  ativo?: boolean;
  imagem_url?: string | null;
}

export interface Rota {
  id: number;
  nome: string;
  clientes_vinculados?: number;
  pedidos_vinculados?: number;
  imagem_url?: string | null;
}

export interface ClienteProduto {
  id: number;
  cliente_id: number;
  produto_id: number;
  valor_unitario: number;
  codigo_cliente?: string;
  cliente_nome?: string;
  codigo_produto?: string;
  produto_nome?: string;
  embalagem?: string | null;
}

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  perfil: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
  rota_id?: number | null;
  ativo: boolean;
  imagem_url?: string | null;
  criado_em: string;
}

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
  valor_total: number;
  valor_efetivado?: number;
  tem_trocas?: boolean;
  qtd_trocas?: number;
  nomes_trocas?: string | null;
  cliente_id: number;
  codigo_cliente: string;
  cliente_nome: string;
  rota_id?: number;
  rota_nome?: string;
  itens: ItemPedido[];
}

export interface TrocaPedido {
  id: number;
  pedido_id: number;
  item_pedido_id?: number | null;
  produto_id: number;
  quantidade: number;
  valor_troca: number;
  motivo?: string | null;
  criado_em: string;
  codigo_produto?: string;
  produto_nome?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    nome: string;
    username: string;
    perfil: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
    imagem_url?: string | null;
  };
}

export interface RelatorioProducaoItem {
  produto_id: number;
  codigo_produto: string;
  produto_nome: string;
  embalagem?: string | null;
  quantidade_total: number;
}

export interface RelatorioRotaClienteItem {
  rota_id: number;
  rota_nome: string;
  cliente_id: number;
  codigo_cliente: string;
  cliente_nome: string;
  total_pedidos: number;
  valor_total_pedidos: number;
}

export interface RelatorioRotaDetalhadoItem {
  rota_id: number;
  rota_nome: string;
  cliente_id: number;
  codigo_cliente: string;
  cliente_nome: string;
  pedido_id: number;
  chave_pedido?: string | null;
  pedido_data: string;
  pedido_status: string;
  pedido_valor_total: number;
  tem_trocas?: boolean;
  qtd_trocas?: number;
  nomes_trocas?: string | null;
  produto_id?: number | null;
  codigo_produto?: string | null;
  produto_nome?: string | null;
  embalagem?: string | null;
  quantidade?: number;
  valor_total_item?: number;
}

export interface RelatorioProdutosPorRotaItem {
  rota_id?: number | null;
  rota_nome?: string | null;
  produto_id: number;
  codigo_produto: string;
  produto_nome: string;
  embalagem?: string | null;
  quantidade_total: number;
}

export interface RelatorioTopClienteItem {
  cliente_id: number;
  codigo_cliente: string;
  cliente_nome: string;
  total_pedidos: number;
  valor_total_vendas: number;
}

export interface RelatorioTrocaItem {
  troca_id: number;
  criado_em: string;
  quantidade: number;
  valor_troca: number;
  motivo?: string | null;
  pedido_id: number;
  chave_pedido?: string | null;
  pedido_data: string;
  pedido_status: string;
  rota_id?: number | null;
  rota_nome?: string | null;
  cliente_id: number;
  codigo_cliente: string;
  cliente_nome: string;
  produto_id: number;
  codigo_produto: string;
  produto_nome: string;
}

// API Calls
export const clientesApi = {
  listar: () => api.get<Cliente[]>('/clientes'),
  criar: (data: Omit<Cliente, 'id'>) => api.post<Cliente>('/clientes', data),
  atualizar: (
    id: number,
    data: {
      nome?: string;
      rota_id?: number | null;
      ativo?: boolean;
      imagem_url?: string | null;
      link?: string | null;
    }
  ) => api.patch<Cliente>(`/clientes/${id}`, data),
  excluir: (id: number) => api.delete(`/clientes/${id}`),
};

export const produtosApi = {
  listar: () => api.get<Produto[]>('/produtos'),
  criar: (data: Omit<Produto, 'id'>) => api.post<Produto>('/produtos', data),
  atualizar: (
    id: number,
    data: {
      codigo_produto?: string;
      nome?: string;
      embalagem?: string | null;
      preco_base?: number | null;
      ativo?: boolean;
      imagem_url?: string | null;
    }
  ) => api.patch<Produto>(`/produtos/${id}`, data),
  excluir: (id: number) => api.delete(`/produtos/${id}`),
};

export const rotasApi = {
  listar: () => api.get<Rota[]>('/rotas'),
  criar: (data: Omit<Rota, 'id'>) => api.post<Rota>('/rotas', data),
  atualizar: (id: number, data: Partial<Omit<Rota, 'id'>>) => api.patch<Rota>(`/rotas/${id}`, data),
  excluir: (id: number) => api.delete(`/rotas/${id}`),
};

export const pedidosApi = {
  listar: (filtros?: {
    data?: string;
    rota_id?: number;
    cliente_id?: number;
    status?: string;
  }) => {
    const params = new URLSearchParams();
    if (filtros?.data) params.append('data', filtros.data);
    if (filtros?.rota_id) params.append('rota_id', filtros.rota_id.toString());
    if (filtros?.cliente_id) params.append('cliente_id', filtros.cliente_id.toString());
    if (filtros?.status) params.append('status', filtros.status);
    
    return api.get<Pedido[]>(`/pedidos?${params.toString()}`);
  },
  listarPaginado: (filtros?: {
    data?: string;
    rota_id?: number;
    cliente_id?: number;
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filtros?.data) params.append('data', filtros.data);
    if (filtros?.rota_id) params.append('rota_id', filtros.rota_id.toString());
    if (filtros?.cliente_id) params.append('cliente_id', filtros.cliente_id.toString());
    if (filtros?.status) params.append('status', filtros.status);
    if (filtros?.q) params.append('q', filtros.q);
    if (filtros?.page) params.append('page', filtros.page.toString());
    if (filtros?.limit) params.append('limit', filtros.limit.toString());

    return api.get<PaginatedResponse<Pedido>>(`/pedidos/paginado?${params.toString()}`);
  },
  buscarPorId: (id: number) => api.get<Pedido>(`/pedidos/${id}`),
  criar: (data: {
    cliente_id: number;
    rota_id?: number;
    data: string;
    status?: string;
    itens: Omit<ItemPedido, 'id'>[];
  }) => api.post<Pedido>('/pedidos', data),
  atualizar: (id: number, data: {
    rota_id?: number;
    data?: string;
    status?: string;
    itens?: Omit<ItemPedido, 'id'>[];
  }) => api.put<Pedido>(`/pedidos/${id}`, data),
  atualizarStatus: (id: number, data: {
    status: string;
    valor_efetivado?: number;
  }) => api.patch(`/pedidos/${id}/status`, data),
};

export const trocasApi = {
  listarPorPedido: (pedidoId: number) => api.get<TrocaPedido[]>(`/pedidos/${pedidoId}/trocas`),
  criar: (data: {
    pedido_id: number;
    item_pedido_id?: number;
    produto_id: number;
    quantidade: number;
    valor_troca?: number;
    motivo?: string;
  }) => api.post<TrocaPedido>('/trocas', data),
  excluir: (id: number) => api.delete(`/trocas/${id}`),
};

export const clienteProdutosApi = {
  listar: (filtros?: { cliente_id?: number }) => {
    const params = new URLSearchParams();
    if (filtros?.cliente_id) params.append('cliente_id', String(filtros.cliente_id));
    return api.get<ClienteProduto[]>(`/cliente-produtos?${params.toString()}`);
  },
  listarPorCliente: (clienteId: number) => api.get<ClienteProduto[]>(`/clientes/${clienteId}/produtos`),
  criar: (data: {
    cliente_id: number;
    produto_id: number;
    valor_unitario: number;
  }) => api.post<ClienteProduto>('/cliente-produtos', data),
  atualizar: (id: number, data: { valor_unitario: number }) =>
    api.patch<ClienteProduto>(`/cliente-produtos/${id}`, data),
  excluir: (id: number) => api.delete(`/cliente-produtos/${id}`),
};

export const usuariosApi = {
  listar: (filtros?: {
    q?: string;
    perfil?: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
    ativo?: boolean;
    page?: number;
    limit?: number;
    sort_by?: 'id' | 'nome' | 'login' | 'perfil' | 'ativo' | 'criado_em';
    sort_dir?: 'asc' | 'desc';
  }) => {
    const params = new URLSearchParams();
    if (filtros?.q) params.append('q', filtros.q);
    if (filtros?.perfil) params.append('perfil', filtros.perfil);
    if (filtros?.ativo !== undefined) params.append('ativo', String(filtros.ativo));
    if (filtros?.page) params.append('page', filtros.page.toString());
    if (filtros?.limit) params.append('limit', filtros.limit.toString());
    if (filtros?.sort_by) params.append('sort_by', filtros.sort_by);
    if (filtros?.sort_dir) params.append('sort_dir', filtros.sort_dir);
    return api.get<PaginatedResponse<Usuario>>(`/usuarios?${params.toString()}`);
  },
  criar: (data: {
    nome: string;
    login: string;
    senha: string;
    perfil: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
    rota_id?: number;
    ativo?: boolean;
    imagem_url?: string | null;
  }) => api.post<Usuario>('/usuarios', data),
  atualizar: (
    id: number,
    data: {
      nome?: string;
      perfil?: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
      rota_id?: number | null;
      ativo?: boolean;
      senha?: string;
      imagem_url?: string | null;
    }
  ) => api.patch<Usuario>(`/usuarios/${id}`, data),
  excluir: (id: number) => api.delete(`/usuarios/${id}`),
};

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }),
  userPreview: (username: string) =>
    api.get<{ nome: string | null; imagem_url: string | null }>(
      `/auth/user-preview?username=${encodeURIComponent(username)}`
    ),
  me: () =>
    api.get<{
      user: {
        id: number;
        nome: string;
        username: string;
        perfil: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
        imagem_url?: string | null;
      };
    }>('/auth/me'),
  changePassword: (senhaAtual: string, novaSenha: string) =>
    api.post('/auth/change-password', {
      senha_atual: senhaAtual,
      nova_senha: novaSenha,
    }),
};

export const relatoriosApi = {
  producao: (filtros?: { data_inicio?: string; data_fim?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros?.status) params.append('status', filtros.status);
    return api.get<RelatorioProducaoItem[]>(`/relatorios/producao?${params.toString()}`);
  },
  rotas: (filtros?: { data_inicio?: string; data_fim?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros?.status) params.append('status', filtros.status);
    return api.get<RelatorioRotaClienteItem[]>(`/relatorios/rotas?${params.toString()}`);
  },
  rotasDetalhado: (filtros?: { data_inicio?: string; data_fim?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros?.status) params.append('status', filtros.status);
    return api.get<RelatorioRotaDetalhadoItem[]>(`/relatorios/rotas-detalhado?${params.toString()}`);
  },
  produtosPorRota: (filtros?: { rota_id?: number; data_inicio?: string; data_fim?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.rota_id) params.append('rota_id', String(filtros.rota_id));
    if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros?.status) params.append('status', filtros.status);
    return api.get<RelatorioProdutosPorRotaItem[]>(`/relatorios/produtos-por-rota?${params.toString()}`);
  },
  topClientes: (filtros?: { data_inicio?: string; data_fim?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros?.status) params.append('status', filtros.status);
    return api.get<RelatorioTopClienteItem[]>(`/relatorios/top-clientes?${params.toString()}`);
  },
  trocas: (filtros?: { data_inicio?: string; data_fim?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros?.status) params.append('status', filtros.status);
    return api.get<RelatorioTrocaItem[]>(`/relatorios/trocas?${params.toString()}`);
  },
};
