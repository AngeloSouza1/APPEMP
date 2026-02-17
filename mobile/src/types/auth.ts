export type PerfilUsuario = 'admin' | 'backoffice' | 'vendedor' | 'motorista';

export interface UsuarioSession {
  id: number;
  nome: string;
  username: string;
  perfil: PerfilUsuario;
  imagem_url?: string | null;
}

export interface LoginResponse {
  token: string;
  user: UsuarioSession;
}
