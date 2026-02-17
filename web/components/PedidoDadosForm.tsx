'use client';

import { Cliente, Rota } from '@/lib/api';

interface PedidoDadosFormProps {
  data: string;
  onDataChange: (valor: string) => void;
  rotaId: string;
  onRotaChange: (valor: string) => void;
  rotas: Rota[];
  status: string;
  onStatusChange: (valor: string) => void;
  statusOptions: readonly string[];
  disableRotaEStatus?: boolean;
  disableRota?: boolean;
  disableStatus?: boolean;
  cliente?: {
    clienteBusca: string;
    onClienteBuscaChange: (valor: string) => void;
    clienteId: string;
    onClienteIdChange: (valor: string) => void;
    clientesFiltrados: Cliente[];
  };
}

export default function PedidoDadosForm({
  data,
  onDataChange,
  rotaId,
  onRotaChange,
  rotas,
  status,
  onStatusChange,
  statusOptions,
  disableRotaEStatus = false,
  disableRota = false,
  disableStatus = false,
  cliente,
}: PedidoDadosFormProps) {
  const gridClass = cliente ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3';

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {cliente && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
          <input
            type="text"
            placeholder="Buscar por código ou nome"
            value={cliente.clienteBusca}
            onChange={(e) => cliente.onClienteBuscaChange(e.target.value)}
            className="ui-input mb-2"
          />
          <select
            value={cliente.clienteId}
            onChange={(e) => cliente.onClienteIdChange(e.target.value)}
            className="ui-select"
          >
            <option value="">Selecione</option>
            {cliente.clientesFiltrados.map((itemCliente) => (
              <option key={itemCliente.id} value={itemCliente.id}>
                {itemCliente.codigo_cliente} - {itemCliente.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
        <input
          type="date"
          value={data}
          onChange={(e) => onDataChange(e.target.value)}
          className="ui-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rota</label>
        <select
          value={rotaId}
          onChange={(e) => onRotaChange(e.target.value)}
          className="ui-select"
          disabled={disableRotaEStatus || disableRota}
        >
          <option value="">Sem rota</option>
          {rotas.map((rota) => (
            <option key={rota.id} value={rota.id}>
              {rota.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {cliente ? 'Status' : 'Status no pedido'}
        </label>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="ui-select"
          disabled={disableRotaEStatus || disableStatus}
        >
          {statusOptions.map((statusOption) => (
            <option key={statusOption} value={statusOption}>
              {statusOption}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
