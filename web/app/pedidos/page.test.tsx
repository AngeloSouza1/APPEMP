// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PedidosPage from '@/app/pedidos/page';

const mocks = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  pedidosListarPaginadoMock: vi.fn(),
  rotasListarMock: vi.fn(),
  clientesListarMock: vi.fn(),
  getUserMock: vi.fn(),
  clearTokenMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mocks.replaceMock,
  }),
}));

vi.mock('@/lib/api', () => ({
  pedidosApi: {
    listarPaginado: mocks.pedidosListarPaginadoMock,
  },
  rotasApi: {
    listar: mocks.rotasListarMock,
  },
  clientesApi: {
    listar: mocks.clientesListarMock,
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    getUser: mocks.getUserMock,
    clearToken: mocks.clearTokenMock,
  },
}));

describe('/pedidos page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getUserMock.mockReturnValue({
      id: 1,
      nome: 'Admin Teste',
      perfil: 'admin',
    });

    mocks.rotasListarMock.mockResolvedValue({
      data: [{ id: 1, nome: 'Rota Centro' }],
    });
    mocks.clientesListarMock.mockResolvedValue({
      data: [{ id: 10, codigo_cliente: 'CL001', nome: 'Cliente Teste' }],
    });

    mocks.pedidosListarPaginadoMock.mockResolvedValue({
      data: {
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      },
    });

  });

  it('renderiza filtros e lista de pedidos', async () => {
    render(<PedidosPage />);
    await screen.findByText('Pedidos');
    await screen.findByText('Nenhum pedido encontrado');

    fireEvent.change(screen.getByPlaceholderText('Cliente, código ou chave'), {
      target: { value: 'teste' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Cliente' }), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByDisplayValue('Em Espera'), {
      target: { value: 'CONFERIR' },
    });

    await waitFor(() => {
      expect(mocks.pedidosListarPaginadoMock).toHaveBeenCalled();
    });
  });
});
