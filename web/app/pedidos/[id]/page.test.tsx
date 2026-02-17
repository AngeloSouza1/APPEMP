// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditarPedidoPage from '@/app/pedidos/[id]/page';

const mocks = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  buscarPorIdMock: vi.fn(),
  rotasListarMock: vi.fn(),
  produtosListarMock: vi.fn(),
  clientesListarMock: vi.fn(),
  atualizarPedidoMock: vi.fn(),
  atualizarStatusMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '55' }),
  useRouter: () => ({
    refresh: mocks.refreshMock,
  }),
}));

vi.mock('@/lib/api', () => ({
  pedidosApi: {
    buscarPorId: mocks.buscarPorIdMock,
    atualizar: mocks.atualizarPedidoMock,
    atualizarStatus: mocks.atualizarStatusMock,
  },
  rotasApi: { listar: mocks.rotasListarMock },
  produtosApi: { listar: mocks.produtosListarMock },
  clientesApi: { listar: mocks.clientesListarMock },
}));

describe('/pedidos/[id] page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.buscarPorIdMock.mockResolvedValue({
      data: {
        id: 55,
        chave_pedido: 'CL001abc',
        data: '2026-02-10T00:00:00.000Z',
        status: 'EM_ESPERA',
        valor_total: 20,
        cliente_id: 1,
        codigo_cliente: 'CL001',
        cliente_nome: 'Cliente Teste',
        rota_id: 99,
        itens: [
          {
            produto_id: 2,
            quantidade: 2,
            embalagem: 'UN',
            valor_unitario: 10,
            comissao: 0,
          },
        ],
      },
    });
    mocks.rotasListarMock.mockResolvedValue({ data: [{ id: 10, nome: 'Rota Teste' }] });
    mocks.produtosListarMock.mockResolvedValue({
      data: [{ id: 2, codigo_produto: 'PRD002', nome: 'Produto Teste' }],
    });
    mocks.clientesListarMock.mockResolvedValue({
      data: [{ id: 1, codigo_cliente: 'CL001', nome: 'Cliente Teste', rota_id: 10 }],
    });
    mocks.atualizarPedidoMock.mockResolvedValue({ data: {} });
    mocks.atualizarStatusMock.mockResolvedValue({ data: {} });
  });

  it('valida data obrigatória antes de salvar pedido', async () => {
    const { container } = render(<EditarPedidoPage />);
    await screen.findByText('Editar Pedido #55');

    const dataInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dataInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Pedido' }));

    expect(await screen.findByText('A data do pedido é obrigatória.')).toBeInTheDocument();
    expect(mocks.atualizarPedidoMock).not.toHaveBeenCalled();
  });

  it('envia atualização de pedido com payload esperado', async () => {
    render(<EditarPedidoPage />);
    await screen.findByText('Editar Pedido #55');

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Pedido' }));

    await waitFor(() => {
      expect(mocks.atualizarPedidoMock).toHaveBeenCalledTimes(1);
    });

    expect(mocks.atualizarPedidoMock).toHaveBeenCalledWith(55, {
      rota_id: 10,
      data: '2026-02-10',
      status: 'EM_ESPERA',
      itens: [
        {
          produto_id: 2,
          quantidade: 2,
          embalagem: 'UN',
          valor_unitario: 10,
          comissao: 0,
        },
      ],
    });
  });

  it('atualiza status automaticamente ao mudar o select no formulário principal', async () => {
    render(<EditarPedidoPage />);
    await screen.findByText('Editar Pedido #55');
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[1];
    fireEvent.change(statusSelect, { target: { value: 'CONFERIR' } });

    await waitFor(() => {
      expect(mocks.atualizarStatusMock).toHaveBeenCalledTimes(1);
    });

    expect(mocks.atualizarStatusMock).toHaveBeenCalledWith(55, {
      status: 'CONFERIR',
    });
  });
});
