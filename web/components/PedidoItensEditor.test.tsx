// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import PedidoItensEditor from '@/components/PedidoItensEditor';

describe('PedidoItensEditor', () => {
  const produtos = [
    { id: 1, codigo_produto: 'PRD001', nome: 'Arroz Tipo A' },
    { id: 2, codigo_produto: 'PRD002', nome: 'Feijao Tipo B' },
  ];

  const itens = [
    {
      produto_id: '1',
      quantidade: '2',
      embalagem: 'UN',
      valor_unitario: '10',
      comissao: '0.5',
    },
  ];

  const baseProps = {
    itens,
    produtos,
    buscaProdutoPorItem: [''],
    onBuscaProdutoChange: vi.fn(),
    onProdutoChange: vi.fn(),
    onItemChange: vi.fn(),
    onAdicionarItem: vi.fn(),
    onRemoverItem: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispara callbacks de adicionar, busca e alteração de campos', () => {
    render(<PedidoItensEditor {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Item' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar produto'), {
      target: { value: 'Arroz' },
    });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '2' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '3' } });

    expect(baseProps.onAdicionarItem).toHaveBeenCalledTimes(1);
    expect(baseProps.onBuscaProdutoChange).toHaveBeenCalledWith(0, 'Arroz');
    expect(baseProps.onProdutoChange).toHaveBeenCalledWith(0, '2');
    expect(baseProps.onItemChange).toHaveBeenCalledWith(0, 'quantidade', '3');
  });

  it('filtra opções de produto conforme busca por item', () => {
    render(<PedidoItensEditor {...baseProps} buscaProdutoPorItem={['feijao']} />);

    const opcoes = screen.getAllByRole('option').map((opt) => opt.textContent);
    expect(opcoes).toContain('Selecione');
    expect(opcoes).toContain('PRD002 - Feijao Tipo B');
    expect(opcoes).not.toContain('PRD001 - Arroz Tipo A');
  });

  it('desabilita remover quando só há um item e flag ativa', () => {
    render(<PedidoItensEditor {...baseProps} disableRemoveWhenSingle />);

    const botaoRemover = screen.getByRole('button', { name: 'Remover' });
    expect(botaoRemover).toBeDisabled();
  });

  it('permite remover quando há mais de um item', () => {
    render(
      <PedidoItensEditor
        {...baseProps}
        itens={[
          ...itens,
          {
            produto_id: '2',
            quantidade: '1',
            embalagem: 'UN',
            valor_unitario: '12',
            comissao: '0.3',
          },
        ]}
        buscaProdutoPorItem={['', '']}
      />
    );

    const botoesRemover = screen.getAllByRole('button', { name: 'Remover' });
    expect(botoesRemover[0]).toBeEnabled();

    fireEvent.click(botoesRemover[0]);
    expect(baseProps.onRemoverItem).toHaveBeenCalledWith(0);
  });

  it('desabilita adicionar item quando o último item não tem produto selecionado', () => {
    render(
      <PedidoItensEditor
        {...baseProps}
        itens={[
          {
            produto_id: '',
            quantidade: '1',
            embalagem: '',
            valor_unitario: '0',
            comissao: '0',
          },
        ]}
      />
    );

    const botaoAdicionar = screen.getByRole('button', { name: 'Adicionar Item' });
    expect(botaoAdicionar).toBeDisabled();

    fireEvent.click(botaoAdicionar);
    expect(baseProps.onAdicionarItem).not.toHaveBeenCalled();
  });

  it('desabilita no select produtos já selecionados em outros itens', () => {
    render(
      <PedidoItensEditor
        {...baseProps}
        itens={[
          {
            produto_id: '1',
            quantidade: '1',
            embalagem: 'UN',
            valor_unitario: '10',
            comissao: '0',
          },
          {
            produto_id: '',
            quantidade: '1',
            embalagem: '',
            valor_unitario: '0',
            comissao: '0',
          },
        ]}
        buscaProdutoPorItem={['', '']}
      />
    );

    const selects = screen.getAllByRole('combobox');
    const segundoSelect = selects[1] as HTMLSelectElement;
    const opcaoProdutoJaUsado = Array.from(segundoSelect.options).find(
      (option) => option.value === '1'
    );

    expect(opcaoProdutoJaUsado).toBeDefined();
    expect(opcaoProdutoJaUsado?.disabled).toBe(true);
  });
});
