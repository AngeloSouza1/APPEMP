// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NovoPedidoPage from '@/app/pedidos/novo/page';

const mocks = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  clientesListarMock: vi.fn(),
  rotasListarMock: vi.fn(),
  produtosListarMock: vi.fn(),
  clienteProdutosListarPorClienteMock: vi.fn(),
  pedidosCriarMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mocks.replaceMock,
  }),
}));

vi.mock('@/lib/api', () => ({
  clientesApi: { listar: mocks.clientesListarMock },
  rotasApi: { listar: mocks.rotasListarMock },
  produtosApi: { listar: mocks.produtosListarMock },
  clienteProdutosApi: { listarPorCliente: mocks.clienteProdutosListarPorClienteMock },
  pedidosApi: { criar: mocks.pedidosCriarMock },
  trocasApi: { criar: vi.fn() },
}));

describe('/pedidos/novo page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.clientesListarMock.mockResolvedValue({
      data: [{ id: 1, codigo_cliente: 'CL001', nome: 'Cliente Teste', rota_id: 10 }],
    });
    mocks.rotasListarMock.mockResolvedValue({
      data: [{ id: 10, nome: 'Rota Teste' }],
    });
    mocks.produtosListarMock.mockResolvedValue({
      data: [{ id: 2, codigo_produto: 'PRD002', nome: 'Produto Teste', preco_base: 10 }],
    });
    mocks.clienteProdutosListarPorClienteMock.mockResolvedValue({ data: [] });
  });

  it('mantém botão criar desabilitado sem cliente e item com produto', async () => {
    render(<NovoPedidoPage />);

    await screen.findByText('Novo Pedido');
    const botaoCriar = screen.getByRole('button', { name: 'Criar Pedido' });

    expect(botaoCriar).toBeDisabled();
    expect(mocks.pedidosCriarMock).not.toHaveBeenCalled();
  });

  it('envia criação com payload esperado e redireciona', async () => {
    mocks.pedidosCriarMock.mockResolvedValue({ data: { id: 123 } });
    render(<NovoPedidoPage />);

    await screen.findByText('Novo Pedido');

    let selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } }); // cliente
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Item' }));

    selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[3], { target: { value: '2' } }); // produto do item

    fireEvent.click(screen.getByRole('button', { name: 'Criar Pedido' }));

    await waitFor(() => {
      expect(mocks.pedidosCriarMock).toHaveBeenCalledTimes(1);
    });

    expect(mocks.pedidosCriarMock).toHaveBeenCalledWith({
      cliente_id: 1,
      rota_id: 10,
      data: expect.any(String),
      status: 'EM_ESPERA',
      itens: [
        {
          produto_id: 2,
          quantidade: 1,
          embalagem: undefined,
          valor_unitario: 10,
          comissao: 0,
        },
      ],
    });
    expect(mocks.replaceMock).toHaveBeenCalledWith('/pedidos');
  });

  it('pré-seleciona cliente via query params e aplica rota automática do cliente', async () => {
    window.history.pushState({}, '', '/pedidos/novo?cliente_id=1');
    render(<NovoPedidoPage />);

    await screen.findByText('Novo Pedido');
    const selects = screen.getAllByRole('combobox');

    expect((selects[0] as HTMLSelectElement).value).toBe('1');
    await waitFor(() => {
      expect((selects[1] as HTMLSelectElement).value).toBe('10');
    });
  });

  it('reaplica preço vinculado do cliente nos itens já selecionados', async () => {
    let resolver!: (value: { data: Array<{ produto_id: number; valor_unitario: number }> }) => void;
    mocks.clienteProdutosListarPorClienteMock.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      })
    );

    render(<NovoPedidoPage />);

    await screen.findByText('Novo Pedido');

    let selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Item' }));

    selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[3], { target: { value: '2' } });

    expect(screen.getByDisplayValue('10')).toBeInTheDocument();

    resolver({ data: [{ produto_id: 2, valor_unitario: 18.2 }] });

    await waitFor(() => {
      expect(screen.getByDisplayValue('18.2')).toBeInTheDocument();
    });
  });
});
