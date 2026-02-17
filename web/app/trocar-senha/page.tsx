'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { authApi } from '@/lib/api';
import FeedbackModal from '@/components/FeedbackModal';

export default function TrocarSenhaPage() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmacao) {
      setErro('A confirmação de senha não confere.');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(senhaAtual, novaSenha);
      setSucesso('Senha alterada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacao('');
    } catch (error: unknown) {
      const maybeError = error as { response?: { data?: { error?: string } } };
      const mensagem = maybeError?.response?.data?.error || 'Não foi possível alterar a senha.';
      setErro(mensagem);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Trocar Senha</h1>
          <Link href="/pedidos" className="text-blue-600 hover:text-blue-800">
            Voltar
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <FeedbackModal
            open={Boolean(erro)}
            variant="error"
            message={erro || ''}
            onClose={() => setErro(null)}
          />
          <FeedbackModal
            open={Boolean(sucesso)}
            variant="success"
            message={sucesso || ''}
            onClose={() => setSucesso(null)}
          />

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha atual</label>
              <input
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                className="ui-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="ui-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                className="ui-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
