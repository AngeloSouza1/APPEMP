import {
  montarItensPayload,
  STATUS_OPTIONS,
  validarItensPayload,
  validarPedidoForm,
  type ItemForm,
} from '@/lib/pedidos';

describe('lib/pedidos', () => {
  const itensForm: ItemForm[] = [
    {
      produto_id: '10',
      quantidade: '2',
      embalagem: 'CX',
      valor_unitario: '15.5',
      comissao: '1.25',
    },
  ];

  it('exposes expected status options', () => {
    expect(STATUS_OPTIONS).toEqual(['EM_ESPERA', 'CONFERIR', 'EFETIVADO', 'CANCELADO']);
  });

  it('builds payload from form values', () => {
    const payload = montarItensPayload(itensForm);

    expect(payload).toEqual([
      {
        produto_id: 10,
        quantidade: 2,
        embalagem: 'CX',
        valor_unitario: 15.5,
        comissao: 1.25,
      },
    ]);
  });

  it('returns validation error for invalid item payload', () => {
    const erro = validarItensPayload([
      {
        produto_id: 0,
        quantidade: 1,
        valor_unitario: 10,
        comissao: 0,
      },
    ]);

    expect(erro).toBe(
      'Preencha os itens com produto, quantidade, valor unitário e comissão válidos.'
    );
  });

  it('requires cliente when clienteObrigatorio=true', () => {
    const erro = validarPedidoForm({
      clienteObrigatorio: true,
      clienteId: '',
      data: '2026-02-10',
      itens: montarItensPayload(itensForm),
    });

    expect(erro).toBe('Selecione um cliente.');
  });

  it('requires date', () => {
    const erro = validarPedidoForm({
      data: '',
      itens: montarItensPayload(itensForm),
    });

    expect(erro).toBe('A data do pedido é obrigatória.');
  });

  it('requires at least one item', () => {
    const erro = validarPedidoForm({
      data: '2026-02-10',
      itens: [],
    });

    expect(erro).toBe('Adicione pelo menos um item no pedido.');
  });

  it('returns null when payload is valid', () => {
    const erro = validarPedidoForm({
      clienteObrigatorio: true,
      clienteId: '1',
      data: '2026-02-10',
      itens: montarItensPayload(itensForm),
    });

    expect(erro).toBeNull();
  });
});
