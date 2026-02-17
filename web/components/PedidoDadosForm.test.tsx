// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import PedidoDadosForm from '@/components/PedidoDadosForm';

describe('PedidoDadosForm', () => {
  const baseProps = {
    data: '2026-02-10',
    onDataChange: vi.fn(),
    rotaId: '',
    onRotaChange: vi.fn(),
    rotas: [
      { id: 1, nome: 'Rota Norte' },
      { id: 2, nome: 'Rota Sul' },
    ],
    status: 'EM_ESPERA',
    onStatusChange: vi.fn(),
    statusOptions: ['EM_ESPERA', 'CONFERIR', 'EFETIVADO', 'CANCELADO'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza sem bloco de cliente quando prop cliente não é informada', () => {
    const { container } = render(<PedidoDadosForm {...baseProps} />);

    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByText('Status no pedido')).toBeInTheDocument();
  });

  it('dispara callbacks de data, rota e status', () => {
    const { container } = render(<PedidoDadosForm {...baseProps} />);

    const dataInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    const selects = screen.getAllByRole('combobox');
    const rotaSelect = selects[0];
    const statusSelect = selects[1];

    fireEvent.change(dataInput, { target: { value: '2026-03-01' } });
    fireEvent.change(rotaSelect, { target: { value: '2' } });
    fireEvent.change(statusSelect, { target: { value: 'CONFERIR' } });

    expect(baseProps.onDataChange).toHaveBeenCalledWith('2026-03-01');
    expect(baseProps.onRotaChange).toHaveBeenCalledWith('2');
    expect(baseProps.onStatusChange).toHaveBeenCalledWith('CONFERIR');
  });

  it('renderiza e atualiza campos de cliente quando prop cliente existe', () => {
    const onClienteBuscaChange = vi.fn();
    const onClienteIdChange = vi.fn();

    const { container } = render(
      <PedidoDadosForm
        {...baseProps}
        cliente={{
          clienteBusca: '',
          onClienteBuscaChange,
          clienteId: '',
          onClienteIdChange,
          clientesFiltrados: [
            { id: 10, codigo_cliente: 'CL001', nome: 'Cliente Um' },
            { id: 11, codigo_cliente: 'CL002', nome: 'Cliente Dois' },
          ],
        }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar por código ou nome'), {
      target: { value: 'Dois' },
    });
    const clienteSelect = container.querySelectorAll('select')[0];
    fireEvent.change(clienteSelect, { target: { value: '11' } });

    expect(onClienteBuscaChange).toHaveBeenCalledWith('Dois');
    expect(onClienteIdChange).toHaveBeenCalledWith('11');
    expect(screen.getByText('Status')).toBeInTheDocument();
  });
});
