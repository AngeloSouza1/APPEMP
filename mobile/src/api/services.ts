import { api } from './client';
import { LoginResponse } from '../types/auth';
import { ItemPedido, PaginatedResponse, Pedido, TrocaPedido } from '../types/pedidos';

export type ClienteResumo = {
  id: number;
  codigo_cliente: string;
  nome: string;
  imagem_url?: string | null;
  rota_id?: number | null;
  ativo?: boolean;
  link?: string | null;
};

export type RotaResumo = {
  id: number;
  nome: string;
  imagem_url?: string | null;
  clientes_vinculados?: number;
  pedidos_vinculados?: number;
};

export type ProdutoResumo = {
  id: number;
  codigo_produto: string;
  nome: string;
  embalagem?: string | null;
  preco_base?: number | null;
  ativo?: boolean;
  imagem_url?: string | null;
};

export type UsuarioResumo = {
  id: number;
  nome: string;
  login: string;
  perfil: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
  rota_id?: number | null;
  ativo: boolean;
  imagem_url?: string | null;
  criado_em?: string;
};

export type ClienteProduto = {
  id: number;
  cliente_id: number;
  produto_id: number;
  valor_unitario: number | null;
  ativo?: boolean;
  codigo_cliente?: string;
  cliente_nome?: string;
  codigo_produto?: string;
  produto_nome?: string;
  embalagem?: string | null;
};

export type RelatorioProducaoItem = {
  produto_id: number;
  codigo_produto: string;
  produto_nome: string;
  embalagem?: string | null;
  quantidade_total: number;
};

export type RelatorioRotaItem = {
  rota_id: number;
  rota_nome: string;
  cliente_id: number;
  codigo_cliente: string;
  cliente_nome: string;
  total_pedidos: number;
  valor_total_pedidos: number;
};

export type RelatorioRotaDetalhadoItem = {
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
};

export type RelatorioProdutosPorRotaItem = {
  rota_id?: number | null;
  rota_nome?: string | null;
  produto_id: number;
  codigo_produto: string;
  produto_nome: string;
  embalagem?: string | null;
  quantidade_total: number;
};

export type RelatorioTopClienteItem = {
  cliente_id: number;
  codigo_cliente: string;
  cliente_nome: string;
  total_pedidos: number;
  valor_total_vendas: number;
};

export type RelatorioTrocaItem = {
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
};

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }),
  userPreview: (username: string) =>
    api.get<{ nome: string | null; imagem_url: string | null }>(
      `/auth/user-preview?username=${encodeURIComponent(username)}`
    ),
};

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const getMimeTypeFromUri = (uri: string, mimeType?: string | null) => {
  if (mimeType && mimeType.startsWith('image/')) return mimeType;
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
};

export const arquivosApi = {
  uploadImagemCloudinary: async (asset: { uri: string; base64?: string | null; mimeType?: string | null }) => {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error(
        'Cloudinary não configurado. Defina EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME e EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.'
      );
    }

    const mimeType = getMimeTypeFromUri(asset.uri, asset.mimeType);
    const formData = new FormData();
    if (asset.base64) {
      formData.append('file', `data:${mimeType};base64,${asset.base64}`);
    } else {
      formData.append('file', {
        uri: asset.uri,
        name: `nf-${Date.now()}.jpg`,
        type: mimeType,
      } as any);
    }
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'appemp/nf');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    if (!response.ok || !data?.secure_url) {
      throw new Error(data?.error?.message || 'Falha ao enviar imagem para Cloudinary.');
    }
    return String(data.secure_url);
  },
};

export const pedidosApi = {
  listarPaginado: (filtros?: {
    q?: string;
    status?: string;
    data?: string;
    rota_id?: number;
    cliente_id?: number;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filtros?.q) params.append('q', filtros.q);
    if (filtros?.status) params.append('status', filtros.status);
    if (filtros?.data) params.append('data', filtros.data);
    if (filtros?.rota_id) params.append('rota_id', String(filtros.rota_id));
    if (filtros?.cliente_id) params.append('cliente_id', String(filtros.cliente_id));
    if (filtros?.page) params.append('page', String(filtros.page));
    if (filtros?.limit) params.append('limit', String(filtros.limit));

    return api.get<PaginatedResponse<Pedido>>(`/pedidos/paginado?${params.toString()}`);
  },
  buscarPorId: (id: number) => api.get<Pedido>(`/pedidos/${id}`),
  listarTrocas: (id: number) => api.get<TrocaPedido[]>(`/pedidos/${id}/trocas`),
  criar: (data: {
    cliente_id: number;
    rota_id?: number | null;
    data: string;
    status?: string;
    usa_nf?: boolean;
    nf_imagem_url?: string | null;
    itens: Omit<ItemPedido, 'id' | 'produto_nome' | 'codigo_produto' | 'valor_total_item'>[];
  }) => api.post<Pedido>('/pedidos', data),
  atualizar: (id: number, data: {
    rota_id?: number | null;
    data?: string;
    status?: string;
    usa_nf?: boolean;
    nf_imagem_url?: string | null;
    itens?: Omit<ItemPedido, 'id' | 'produto_nome' | 'codigo_produto' | 'valor_total_item'>[];
  }) =>
    api.put<Pedido>(`/pedidos/${id}`, data),
  atualizarStatus: (id: number, data: { status: string; valor_efetivado?: number; data?: string }) =>
    api.patch(`/pedidos/${id}/status`, data),
  excluir: (id: number) => api.delete(`/pedidos/${id}`),
  atualizarOrdemRemaneio: (pedido_ids: number[]) =>
    api.patch('/pedidos/remaneio/ordem', { pedido_ids }),
};

export const clientesApi = {
  listar: () => api.get<ClienteResumo[]>('/clientes'),
  criar: (data: {
    codigo_cliente: string;
    nome: string;
    rota_id?: number | null;
    imagem_url?: string | null;
    link?: string | null;
  }) => api.post<ClienteResumo>('/clientes', data),
  atualizar: (
    id: number,
    data: {
      nome?: string;
      rota_id?: number | null;
      imagem_url?: string | null;
      link?: string | null;
      ativo?: boolean;
    }
  ) => api.patch<ClienteResumo>(`/clientes/${id}`, data),
  excluir: (id: number) => api.delete(`/clientes/${id}`),
};

export const rotasApi = {
  listar: () => api.get<RotaResumo[]>('/rotas'),
  criar: (data: { nome: string; imagem_url?: string | null }) =>
    api.post<RotaResumo>('/rotas', data),
  atualizar: (id: number, data: { nome: string; imagem_url?: string | null }) =>
    api.patch<RotaResumo>(`/rotas/${id}`, data),
  excluir: (id: number) => api.delete(`/rotas/${id}`),
};

export const produtosApi = {
  listar: () => api.get<ProdutoResumo[]>('/produtos'),
  criar: (data: {
    codigo_produto?: string;
    nome: string;
    embalagem?: string | null;
    preco_base?: number | null;
    imagem_url?: string | null;
  }) => api.post<ProdutoResumo>('/produtos', data),
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
  ) => api.patch<ProdutoResumo>(`/produtos/${id}`, data),
  excluir: (id: number) => api.delete(`/produtos/${id}`),
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
    if (filtros?.page) params.append('page', String(filtros.page));
    if (filtros?.limit) params.append('limit', String(filtros.limit));
    if (filtros?.sort_by) params.append('sort_by', filtros.sort_by);
    if (filtros?.sort_dir) params.append('sort_dir', filtros.sort_dir);
    return api.get<PaginatedResponse<UsuarioResumo>>(`/usuarios?${params.toString()}`);
  },
  criar: (data: {
    nome: string;
    login: string;
    senha: string;
    perfil: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
    rota_id?: number | null;
    ativo?: boolean;
    imagem_url?: string | null;
  }) => api.post<UsuarioResumo>('/usuarios', data),
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
  ) => api.patch<UsuarioResumo>(`/usuarios/${id}`, data),
  excluir: (id: number) => api.delete(`/usuarios/${id}`),
};

export const trocasApi = {
  criar: (data: {
    pedido_id: number;
    item_pedido_id?: number | null;
    produto_id: number;
    quantidade: number;
    valor_troca?: number;
    motivo?: string;
  }) => api.post<TrocaPedido>('/trocas', data),
  excluir: (id: number) => api.delete(`/trocas/${id}`),
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
    return api.get<RelatorioRotaItem[]>(`/relatorios/rotas?${params.toString()}`);
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
