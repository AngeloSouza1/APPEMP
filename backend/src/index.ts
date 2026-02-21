import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { pool } from "./db";

dotenv.config();

const app = express();

app.use(cors({
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void
  ) => {
    // Em desenvolvimento, permitir todas as origens
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // Em produção, usar lista da env CORS_ORIGIN (separada por vírgula)
      const allowedOrigins = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
}));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const STATUS_PERMITIDOS = ["EM_ESPERA", "CONFERIR", "EFETIVADO", "CANCELADO"] as const;
type StatusPedido = (typeof STATUS_PERMITIDOS)[number];
const PERFIS_PERMITIDOS = ["admin", "backoffice", "vendedor", "motorista"] as const;
type PerfilUsuario = (typeof PERFIS_PERMITIDOS)[number];
const AUTH_USER = process.env.AUTH_USER || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123";
const AUTH_NAME = process.env.AUTH_NAME || "Administrador";
const AUTH_PERFIL = (process.env.AUTH_PERFIL || "admin") as PerfilUsuario;
const JWT_SECRET = process.env.JWT_SECRET || "appemp-dev-secret-change-me";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "8h") as SignOptions["expiresIn"];

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    nome: string;
    username: string;
    perfil: PerfilUsuario;
    imagem_url?: string | null;
  };
}

const normalizarStatus = (status: string): StatusPedido | null => {
  const valorNormalizado = status.trim().toUpperCase().replace(/\s+/g, "_");
  const valorMapeado = valorNormalizado === "OK" ? "EFETIVADO" : valorNormalizado;
  if (STATUS_PERMITIDOS.includes(valorMapeado as StatusPedido)) {
    return valorMapeado as StatusPedido;
  }
  return null;
};

const normalizarPerfil = (perfil: string): PerfilUsuario | null => {
  const valor = perfil.trim().toLowerCase();
  if (PERFIS_PERMITIDOS.includes(valor as PerfilUsuario)) {
    return valor as PerfilUsuario;
  }
  return null;
};

const normalizarImagemUrl = (imagemUrl: unknown): string | null => {
  const valor = String(imagemUrl ?? "").trim();
  return valor || null;
};

const gerarToken = (user: AuthenticatedRequest["user"]) => {
  return jwt.sign(
    {
      sub: String(user?.id),
      id: user?.id,
      nome: user?.nome,
      username: user?.username,
      perfil: user?.perfil,
      imagem_url: user?.imagem_url ?? null,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const autenticarToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não informado" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const userId = Number(payload.id);
    const username = payload.username;
    const nome = payload.nome;
    const perfil = normalizarPerfil(String(payload.perfil || ""));
    const imagemUrl = payload.imagem_url ? String(payload.imagem_url) : null;

    if (!userId || !username || typeof username !== "string" || !nome || !perfil) {
      return res.status(401).json({ error: "Token inválido" });
    }

    req.user = { id: userId, username, nome: String(nome), perfil, imagem_url: imagemUrl };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};

const requireRoles =
  (...roles: PerfilUsuario[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Não autenticado" });
    if (!roles.includes(req.user.perfil)) {
      return res.status(403).json({ error: "Sem permissão para esta operação" });
    }
    next();
  };

const canManageCadastros = requireRoles("admin", "backoffice");
const canManageUsuarios = requireRoles("admin");

const ensureDefaultAdminUser = async () => {
  const perfilPadrao = normalizarPerfil(AUTH_PERFIL) || "admin";
  const senhaHash = await bcrypt.hash(AUTH_PASSWORD, 10);

  await pool.query(
    `INSERT INTO usuarios (nome, login, senha_hash, perfil, ativo)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (login) DO UPDATE
     SET nome = EXCLUDED.nome,
         senha_hash = EXCLUDED.senha_hash,
         perfil = EXCLUDED.perfil,
         ativo = true`,
    [AUTH_NAME, AUTH_USER, senhaHash, perfilPadrao]
  );
};

const ensureImageColumns = async () => {
  await pool.query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS imagem_url TEXT");
  await pool.query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS link TEXT");
  await pool.query("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT");
  await pool.query("ALTER TABLE rotas ADD COLUMN IF NOT EXISTS imagem_url TEXT");
  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS imagem_url TEXT");
  await pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ordem_remaneio INTEGER");
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "APPEMP backend funcionando" });
});

app.get("/auth/user-preview", async (req, res) => {
  const username = String(req.query.username || "").trim();
  if (!username) {
    return res.json({ nome: null, imagem_url: null });
  }

  try {
    const result = await pool.query(
      `SELECT nome, imagem_url
       FROM usuarios
       WHERE login = $1 AND ativo = true
       LIMIT 1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.json({ nome: null, imagem_url: null });
    }

    const row = result.rows[0];
    return res.json({
      nome: String(row.nome),
      imagem_url: row.imagem_url ? String(row.imagem_url) : null,
    });
  } catch (error) {
    console.error("Erro ao buscar preview de usuário:", error);
    return res.status(500).json({ error: "Erro ao buscar preview de usuário" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username e password são obrigatórios" });
  }

  try {
    const result = await pool.query(
      `SELECT id, nome, login, senha_hash, perfil, ativo, imagem_url
       FROM usuarios
       WHERE login = $1`,
      [String(username)]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const usuario = result.rows[0];
    if (!usuario.ativo) {
      return res.status(403).json({ error: "Usuário inativo" });
    }

    const senhaValida = await bcrypt.compare(String(password), usuario.senha_hash);
    const perfilNormalizado = normalizarPerfil(String(usuario.perfil));
    if (!senhaValida || !perfilNormalizado) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const user = {
      id: Number(usuario.id),
      nome: String(usuario.nome),
      username: String(usuario.login),
      perfil: perfilNormalizado,
      imagem_url: usuario.imagem_url ? String(usuario.imagem_url) : null,
    };

    const token = gerarToken(user);
    return res.json({ token, user });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ error: "Erro ao autenticar" });
  }
});

app.get("/auth/me", autenticarToken, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, login, perfil, imagem_url
       FROM usuarios
       WHERE id = $1`,
      [req.user?.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    const row = result.rows[0];
    return res.json({
      user: {
        id: Number(row.id),
        nome: String(row.nome),
        username: String(row.login),
        perfil: normalizarPerfil(String(row.perfil)) || "vendedor",
        imagem_url: row.imagem_url ? String(row.imagem_url) : null,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar usuário autenticado:", error);
    return res.status(500).json({ error: "Erro ao buscar usuário autenticado" });
  }
});

app.post("/auth/change-password", autenticarToken, async (req: AuthenticatedRequest, res) => {
  const { senha_atual, nova_senha } = req.body;

  if (!senha_atual || !nova_senha) {
    return res.status(400).json({ error: "senha_atual e nova_senha são obrigatórias" });
  }
  if (String(nova_senha).length < 6) {
    return res.status(400).json({ error: "nova_senha deve ter ao menos 6 caracteres" });
  }

  try {
    const result = await pool.query(
      "SELECT id, senha_hash FROM usuarios WHERE id = $1",
      [req.user?.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(String(senha_atual), usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: "Senha atual inválida" });
    }

    const novaHash = await bcrypt.hash(String(nova_senha), 10);
    await pool.query(
      "UPDATE usuarios SET senha_hash = $1 WHERE id = $2",
      [novaHash, req.user?.id]
    );

    return res.json({ message: "Senha atualizada com sucesso" });
  } catch (error) {
    console.error("Erro ao trocar senha:", error);
    return res.status(500).json({ error: "Erro ao trocar senha" });
  }
});

app.use(autenticarToken);

// --------- USUARIOS ----------

app.get("/usuarios", canManageUsuarios, async (req, res) => {
  try {
    const {
      q,
      perfil,
      ativo,
      page = "1",
      limit = "10",
      sort_by = "id",
      sort_dir = "desc",
    } = req.query;

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      whereClause += ` AND (
        nome ILIKE $${paramIndex}
        OR login ILIKE $${paramIndex}
      )`;
      params.push(`%${String(q)}%`);
      paramIndex++;
    }

    if (perfil) {
      const perfilNormalizado = normalizarPerfil(String(perfil));
      if (!perfilNormalizado) {
        return res.status(400).json({ error: `perfil inválido. Use: ${PERFIS_PERMITIDOS.join(", ")}` });
      }
      whereClause += ` AND perfil = $${paramIndex}`;
      params.push(perfilNormalizado);
      paramIndex++;
    }

    if (ativo !== undefined && ativo !== "") {
      const ativoBool = String(ativo).toLowerCase() === "true";
      whereClause += ` AND ativo = $${paramIndex}`;
      params.push(ativoBool);
      paramIndex++;
    }

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM usuarios
       ${whereClause}`,
      params
    );
    const total = totalResult.rows[0].total as number;

    const sortColumnMap: Record<string, string> = {
      id: "id",
      nome: "nome",
      login: "login",
      perfil: "perfil",
      ativo: "ativo",
      criado_em: "criado_em",
    };
    const orderBy = sortColumnMap[String(sort_by)] || "id";
    const orderDir = String(sort_dir).toLowerCase() === "asc" ? "ASC" : "DESC";

    const result = await pool.query(
      `SELECT id, nome, login, perfil, rota_id, ativo, imagem_url, criado_em
       FROM usuarios
       ${whereClause}
       ORDER BY ${orderBy} ${orderDir}, id DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );
    res.json({
      data: result.rows,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(Math.ceil(total / limitNum), 1),
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

app.post("/usuarios", canManageUsuarios, async (req, res) => {
  const { nome, login, senha, perfil, rota_id, ativo, imagem_url } = req.body;

  if (!nome || !login || !senha || !perfil) {
    return res.status(400).json({ error: "nome, login, senha e perfil são obrigatórios" });
  }
  if (String(senha).length < 6) {
    return res.status(400).json({ error: "senha deve ter ao menos 6 caracteres" });
  }
  const perfilNormalizado = normalizarPerfil(String(perfil));
  if (!perfilNormalizado) {
    return res.status(400).json({ error: `perfil inválido. Use: ${PERFIS_PERMITIDOS.join(", ")}` });
  }

  try {
    const senhaHash = await bcrypt.hash(String(senha), 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nome, login, senha_hash, perfil, rota_id, ativo, imagem_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nome, login, perfil, rota_id, ativo, imagem_url, criado_em`,
      [nome, login, senhaHash, perfilNormalizado, rota_id || null, ativo ?? true, normalizarImagemUrl(imagem_url)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Erro ao criar usuário:", error);
    if (error.code === "23505") {
      return res.status(400).json({ error: "login já existe" });
    }
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

app.patch("/usuarios/:id", canManageUsuarios, async (req, res) => {
  const { id } = req.params;
  const { nome, perfil, rota_id, ativo, senha, imagem_url } = req.body;

  const fields: string[] = [];
  const params: any[] = [];
  let index = 1;

  if (nome !== undefined) {
    fields.push(`nome = $${index++}`);
    params.push(nome);
  }
  if (perfil !== undefined) {
    const perfilNormalizado = normalizarPerfil(String(perfil));
    if (!perfilNormalizado) {
      return res.status(400).json({ error: `perfil inválido. Use: ${PERFIS_PERMITIDOS.join(", ")}` });
    }
    fields.push(`perfil = $${index++}`);
    params.push(perfilNormalizado);
  }
  if (rota_id !== undefined) {
    fields.push(`rota_id = $${index++}`);
    params.push(rota_id || null);
  }
  if (ativo !== undefined) {
    fields.push(`ativo = $${index++}`);
    params.push(Boolean(ativo));
  }
  if (senha !== undefined) {
    if (String(senha).length < 6) {
      return res.status(400).json({ error: "senha deve ter ao menos 6 caracteres" });
    }
    const senhaHash = await bcrypt.hash(String(senha), 10);
    fields.push(`senha_hash = $${index++}`);
    params.push(senhaHash);
  }
  if (imagem_url !== undefined) {
    fields.push(`imagem_url = $${index++}`);
    params.push(normalizarImagemUrl(imagem_url));
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "Nenhum campo para atualizar" });
  }

  params.push(Number(String(id)));
  try {
    const result = await pool.query(
      `UPDATE usuarios
       SET ${fields.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, nome, login, perfil, rota_id, ativo, imagem_url, criado_em`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

app.delete("/usuarios/:id", canManageUsuarios, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const idAlvo = Number(String(id));

  if (!Number.isFinite(idAlvo) || idAlvo <= 0) {
    return res.status(400).json({ error: "ID de usuário inválido" });
  }

  if (req.user?.id === idAlvo) {
    return res.status(409).json({ error: "Você não pode excluir seu próprio usuário." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM usuarios WHERE id = $1 RETURNING id",
      [idAlvo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    return res.status(204).send();
  } catch (error: any) {
    if (error?.code === "23503") {
      return res.status(409).json({
        error: "Usuário possui registros vinculados e não pode ser excluído.",
      });
    }
    console.error("Erro ao excluir usuário:", error);
    return res.status(500).json({ error: "Erro ao excluir usuário" });
  }
});

// --------- CLIENTES ----------

// Lista simples de clientes (id, código e nome)
app.get("/clientes", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, codigo_cliente, nome, rota_id, ativo, imagem_url, link FROM clientes ORDER BY nome ASC"
    );
    res.json(result.rows);
  } catch (error: any) {
    // Compatibilidade temporária para bases sem a coluna "ativo"
    if (error?.code === "42703") {
      try {
        const fallback = await pool.query(
          "SELECT id, codigo_cliente, nome, rota_id, imagem_url, link FROM clientes ORDER BY nome ASC"
        );
        const data = fallback.rows.map((row) => ({ ...row, ativo: true }));
        return res.json(data);
      } catch (fallbackError) {
        console.error("Erro ao buscar clientes (fallback):", fallbackError);
      }
    }
    console.error("Erro ao buscar clientes:", error);
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

// Cria um novo cliente
app.post("/clientes", canManageCadastros, async (req, res) => {
  const { codigo_cliente, nome, rota_id, imagem_url, link } = req.body;

  if (!codigo_cliente || !nome) {
    return res
      .status(400)
      .json({ error: "codigo_cliente e nome são obrigatórios" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO clientes (codigo_cliente, nome, rota_id, ativo, imagem_url, link) VALUES ($1, $2, $3, true, $4, $5) RETURNING id, codigo_cliente, nome, rota_id, ativo, imagem_url, link",
      [codigo_cliente, nome, rota_id ?? null, normalizarImagemUrl(imagem_url), link ? String(link).trim() : null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    // Compatibilidade temporária para bases sem a coluna "ativo"
    if (error?.code === "42703") {
      try {
        const fallback = await pool.query(
          "INSERT INTO clientes (codigo_cliente, nome, rota_id, imagem_url, link) VALUES ($1, $2, $3, $4, $5) RETURNING id, codigo_cliente, nome, rota_id, imagem_url, link",
          [codigo_cliente, nome, rota_id ?? null, normalizarImagemUrl(imagem_url), link ? String(link).trim() : null]
        );
        return res.status(201).json({ ...fallback.rows[0], ativo: true });
      } catch (fallbackError) {
        console.error("Erro ao criar cliente (fallback):", fallbackError);
      }
    }
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({ error: "Erro ao criar cliente" });
  }
});

// Atualiza dados do cliente (nome e rota)
app.patch("/clientes/:id", canManageCadastros, async (req, res) => {
  const { id } = req.params;
  const { nome, rota_id, ativo, imagem_url, link } = req.body;

  const fields: string[] = [];
  const params: any[] = [];
  let index = 1;

  if (nome !== undefined) {
    const nomeNormalizado = String(nome).trim();
    if (!nomeNormalizado) {
      return res.status(400).json({ error: "nome é obrigatório" });
    }
    fields.push(`nome = $${index++}`);
    params.push(nomeNormalizado);
  }

  if (rota_id !== undefined) {
    fields.push(`rota_id = $${index++}`);
    params.push(rota_id || null);
  }

  if (ativo !== undefined) {
    fields.push(`ativo = $${index++}`);
    params.push(Boolean(ativo));
  }

  if (imagem_url !== undefined) {
    fields.push(`imagem_url = $${index++}`);
    params.push(normalizarImagemUrl(imagem_url));
  }

  if (link !== undefined) {
    fields.push(`link = $${index++}`);
    params.push(link ? String(link).trim() : null);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "Nenhum campo para atualizar" });
  }

  params.push(Number(String(id)));
  try {
    const result = await pool.query(
      `UPDATE clientes
       SET ${fields.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, codigo_cliente, nome, rota_id, ativo, imagem_url, link`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    // Compatibilidade temporária para bases sem a coluna "ativo"
    if (error?.code === "42703") {
      if (ativo !== undefined) {
        return res.status(400).json({
          error: "Bloqueio de cliente indisponível: aplique a migração migration-clientes-ativo.sql",
        });
      }
      try {
        const fallback = await pool.query(
          `UPDATE clientes
           SET ${fields.join(", ")}
           WHERE id = $${params.length}
           RETURNING id, codigo_cliente, nome, rota_id, imagem_url, link`,
          params
        );
        if (fallback.rows.length === 0) {
          return res.status(404).json({ error: "Cliente não encontrado" });
        }
        return res.json({ ...fallback.rows[0], ativo: true });
      } catch (fallbackError) {
        console.error("Erro ao atualizar cliente (fallback):", fallbackError);
      }
    }
    console.error("Erro ao atualizar cliente:", error);
    res.status(500).json({ error: "Erro ao atualizar cliente" });
  }
});

app.delete("/clientes/:id", canManageCadastros, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM clientes WHERE id = $1 RETURNING id",
      [Number(String(id))]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    return res.status(204).send();
  } catch (error: any) {
    if (error?.code === "23503") {
      return res.status(409).json({
        error: "Cliente possui pedidos vinculados e não pode ser excluído. Use bloqueio.",
      });
    }
    console.error("Erro ao excluir cliente:", error);
    return res.status(500).json({ error: "Erro ao excluir cliente" });
  }
});

// --------- CLIENTE x PRODUTOS (preço personalizado) ----------

app.get("/clientes/:id/produtos", async (req, res) => {
  const { id } = req.params;
  const clienteId = Number(String(id));
  if (!Number.isFinite(clienteId) || clienteId <= 0) {
    return res.status(400).json({ error: "ID de cliente inválido" });
  }

  try {
    const result = await pool.query(
      `SELECT
        cp.id,
        cp.cliente_id,
        cp.produto_id,
        cp.valor_unitario,
        c.codigo_cliente,
        c.nome AS cliente_nome,
        p.codigo_produto,
        p.nome AS produto_nome,
        p.embalagem
      FROM cliente_produtos cp
      INNER JOIN clientes c ON c.id = cp.cliente_id
      INNER JOIN produtos p ON p.id = cp.produto_id
      WHERE cp.cliente_id = $1
      ORDER BY p.nome ASC`,
      [clienteId]
    );
    return res.json(result.rows);
  } catch (error: any) {
    if (error?.code === "42P01") {
      return res.status(400).json({
        error: "Tabela cliente_produtos não encontrada. Aplique a migration-cliente-produtos.sql",
      });
    }
    console.error("Erro ao listar relação cliente-produtos:", error);
    return res.status(500).json({ error: "Erro ao listar relação cliente-produtos" });
  }
});

app.get("/cliente-produtos", canManageCadastros, async (req, res) => {
  const { cliente_id } = req.query;
  const clienteId = cliente_id ? Number(String(cliente_id)) : null;
  if (cliente_id && (!Number.isFinite(clienteId) || Number(clienteId) <= 0)) {
    return res.status(400).json({ error: "cliente_id inválido" });
  }

  try {
    const params: any[] = [];
    let whereClause = "";
    if (clienteId) {
      whereClause = "WHERE cp.cliente_id = $1";
      params.push(clienteId);
    }

    const result = await pool.query(
      `SELECT
        cp.id,
        cp.cliente_id,
        cp.produto_id,
        cp.valor_unitario,
        c.codigo_cliente,
        c.nome AS cliente_nome,
        p.codigo_produto,
        p.nome AS produto_nome,
        p.embalagem
      FROM cliente_produtos cp
      INNER JOIN clientes c ON c.id = cp.cliente_id
      INNER JOIN produtos p ON p.id = cp.produto_id
      ${whereClause}
      ORDER BY c.nome ASC, p.nome ASC`,
      params
    );
    return res.json(result.rows);
  } catch (error: any) {
    if (error?.code === "42P01") {
      return res.status(400).json({
        error: "Tabela cliente_produtos não encontrada. Aplique a migration-cliente-produtos.sql",
      });
    }
    console.error("Erro ao listar cliente-produtos:", error);
    return res.status(500).json({ error: "Erro ao listar cliente-produtos" });
  }
});

app.post("/cliente-produtos", canManageCadastros, async (req, res) => {
  const { cliente_id, produto_id, valor_unitario } = req.body;
  const clienteId = Number(cliente_id);
  const produtoId = Number(produto_id);
  const valorUnitario = Number(valor_unitario);

  if (!Number.isFinite(clienteId) || clienteId <= 0) {
    return res.status(400).json({ error: "cliente_id inválido" });
  }
  if (!Number.isFinite(produtoId) || produtoId <= 0) {
    return res.status(400).json({ error: "produto_id inválido" });
  }
  if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
    return res.status(400).json({ error: "valor_unitario inválido" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO cliente_produtos (cliente_id, produto_id, valor_unitario)
       VALUES ($1, $2, $3)
       RETURNING id, cliente_id, produto_id, valor_unitario`,
      [clienteId, produtoId, valorUnitario]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Este produto já está vinculado a este cliente" });
    }
    if (error?.code === "23503") {
      return res.status(400).json({ error: "Cliente ou produto não encontrado" });
    }
    if (error?.code === "42P01") {
      return res.status(400).json({
        error: "Tabela cliente_produtos não encontrada. Aplique a migration-cliente-produtos.sql",
      });
    }
    console.error("Erro ao criar cliente-produto:", error);
    return res.status(500).json({ error: "Erro ao criar cliente-produto" });
  }
});

app.patch("/cliente-produtos/:id", canManageCadastros, async (req, res) => {
  const { id } = req.params;
  const { valor_unitario } = req.body;
  const relacaoId = Number(String(id));
  const valorUnitario = Number(valor_unitario);

  if (!Number.isFinite(relacaoId) || relacaoId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }
  if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
    return res.status(400).json({ error: "valor_unitario inválido" });
  }

  try {
    const result = await pool.query(
      `UPDATE cliente_produtos
       SET valor_unitario = $1
       WHERE id = $2
       RETURNING id, cliente_id, produto_id, valor_unitario`,
      [valorUnitario, relacaoId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Relação não encontrada" });
    }
    return res.json(result.rows[0]);
  } catch (error: any) {
    if (error?.code === "42P01") {
      return res.status(400).json({
        error: "Tabela cliente_produtos não encontrada. Aplique a migration-cliente-produtos.sql",
      });
    }
    console.error("Erro ao atualizar cliente-produto:", error);
    return res.status(500).json({ error: "Erro ao atualizar cliente-produto" });
  }
});

app.delete("/cliente-produtos/:id", canManageCadastros, async (req, res) => {
  const { id } = req.params;
  const relacaoId = Number(String(id));

  if (!Number.isFinite(relacaoId) || relacaoId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM cliente_produtos WHERE id = $1 RETURNING id",
      [relacaoId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Relação não encontrada" });
    }
    return res.status(204).send();
  } catch (error: any) {
    if (error?.code === "42P01") {
      return res.status(400).json({
        error: "Tabela cliente_produtos não encontrada. Aplique a migration-cliente-produtos.sql",
      });
    }
    console.error("Erro ao excluir cliente-produto:", error);
    return res.status(500).json({ error: "Erro ao excluir cliente-produto" });
  }
});

// --------- ROTAS ----------

// Lista de rotas
app.get("/rotas", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        r.id,
        r.nome,
        r.imagem_url,
        COALESCE(c.clientes_vinculados, 0)::int AS clientes_vinculados,
        COALESCE(p.pedidos_vinculados, 0)::int AS pedidos_vinculados
      FROM rotas r
      LEFT JOIN (
        SELECT rota_id, COUNT(*)::int AS clientes_vinculados
        FROM clientes
        WHERE rota_id IS NOT NULL
        GROUP BY rota_id
      ) c ON c.rota_id = r.id
      LEFT JOIN (
        SELECT rota_id, COUNT(*)::int AS pedidos_vinculados
        FROM pedidos
        WHERE rota_id IS NOT NULL
        GROUP BY rota_id
      ) p ON p.rota_id = r.id
      ORDER BY r.nome ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar rotas:", error);
    res.status(500).json({ error: "Erro ao buscar rotas" });
  }
});

// Cria uma nova rota
app.post("/rotas", canManageCadastros, async (req, res) => {
  const { nome, imagem_url } = req.body;

  if (!nome) {
    return res.status(400).json({ error: "nome da rota é obrigatório" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO rotas (nome, imagem_url) VALUES ($1, $2) RETURNING id, nome, imagem_url",
      [nome, normalizarImagemUrl(imagem_url)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar rota:", error);
    res.status(500).json({ error: "Erro ao criar rota" });
  }
});

// Atualiza uma rota
app.patch("/rotas/:id", canManageCadastros, async (req, res) => {
  const { id } = req.params;
  const { nome, imagem_url } = req.body;

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ error: "nome da rota é obrigatório" });
  }

  try {
    const result = await pool.query(
      "UPDATE rotas SET nome = $1, imagem_url = $2 WHERE id = $3 RETURNING id, nome, imagem_url",
      [String(nome).trim(), normalizarImagemUrl(imagem_url), Number(String(id))]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Rota não encontrada" });
    }
    return res.json(result.rows[0]);
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Já existe uma rota com este nome" });
    }
    console.error("Erro ao atualizar rota:", error);
    return res.status(500).json({ error: "Erro ao atualizar rota" });
  }
});

// Exclui uma rota
app.delete("/rotas/:id", canManageCadastros, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM rotas WHERE id = $1 RETURNING id",
      [Number(String(id))]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Rota não encontrada" });
    }
    return res.status(204).send();
  } catch (error: any) {
    if (error?.code === "23503") {
      return res.status(409).json({
        error: "Rota possui vínculos com clientes/pedidos e não pode ser excluída.",
      });
    }
    console.error("Erro ao excluir rota:", error);
    return res.status(500).json({ error: "Erro ao excluir rota" });
  }
});

// --------- PRODUTOS ----------

// Lista de produtos
app.get("/produtos", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, codigo_produto, nome, embalagem, preco_base, ativo, imagem_url FROM produtos ORDER BY nome ASC"
    );
    res.json(result.rows);
  } catch (error: any) {
    // Compatibilidade temporária para bases sem a coluna "ativo"
    if (error?.code === "42703") {
      try {
        const fallback = await pool.query(
          "SELECT id, codigo_produto, nome, embalagem, preco_base, imagem_url FROM produtos ORDER BY nome ASC"
        );
        return res.json(fallback.rows.map((row) => ({ ...row, ativo: true })));
      } catch (fallbackError) {
        console.error("Erro ao buscar produtos (fallback):", fallbackError);
      }
    }
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// Cria um novo produto
app.post("/produtos", canManageCadastros, async (req, res) => {
  const { codigo_produto, nome, embalagem, preco_base, imagem_url } = req.body;

  if (!nome) {
    return res
      .status(400)
      .json({ error: "nome é obrigatório" });
  }

  try {
    const codigoGerado = codigo_produto && String(codigo_produto).trim()
      ? String(codigo_produto).trim()
      : `PR${Date.now().toString().slice(-8)}`;

    const result = await pool.query(
      "INSERT INTO produtos (codigo_produto, nome, embalagem, preco_base, ativo, imagem_url) VALUES ($1, $2, $3, $4, true, $5) RETURNING id, codigo_produto, nome, embalagem, preco_base, ativo, imagem_url",
      [codigoGerado, nome, embalagem ?? null, preco_base ?? null, normalizarImagemUrl(imagem_url)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    // Compatibilidade temporária para bases sem a coluna "ativo"
    if (error?.code === "42703") {
      try {
        const codigoGerado = codigo_produto && String(codigo_produto).trim()
          ? String(codigo_produto).trim()
          : `PR${Date.now().toString().slice(-8)}`;
        const fallback = await pool.query(
          "INSERT INTO produtos (codigo_produto, nome, embalagem, preco_base, imagem_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, codigo_produto, nome, embalagem, preco_base, imagem_url",
          [codigoGerado, nome, embalagem ?? null, preco_base ?? null, normalizarImagemUrl(imagem_url)]
        );
        return res.status(201).json({ ...fallback.rows[0], ativo: true });
      } catch (fallbackError) {
        console.error("Erro ao criar produto (fallback):", fallbackError);
      }
    }
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ error: "Erro ao criar produto" });
  }
});

app.patch("/produtos/:id", canManageCadastros, async (req, res) => {
  const { id } = req.params;
  const { codigo_produto, nome, embalagem, preco_base, ativo, imagem_url } = req.body;

  const fields: string[] = [];
  const params: any[] = [];
  let index = 1;

  if (codigo_produto !== undefined) {
    const codigoNormalizado = String(codigo_produto).trim();
    if (!codigoNormalizado) {
      return res.status(400).json({ error: "codigo_produto é obrigatório" });
    }
    fields.push(`codigo_produto = $${index++}`);
    params.push(codigoNormalizado);
  }

  if (nome !== undefined) {
    const nomeNormalizado = String(nome).trim();
    if (!nomeNormalizado) {
      return res.status(400).json({ error: "nome é obrigatório" });
    }
    fields.push(`nome = $${index++}`);
    params.push(nomeNormalizado);
  }

  if (embalagem !== undefined) {
    fields.push(`embalagem = $${index++}`);
    params.push(String(embalagem).trim() || null);
  }

  if (preco_base !== undefined) {
    fields.push(`preco_base = $${index++}`);
    params.push(preco_base === null || preco_base === "" ? null : Number(preco_base));
  }

  if (ativo !== undefined) {
    fields.push(`ativo = $${index++}`);
    params.push(Boolean(ativo));
  }

  if (imagem_url !== undefined) {
    fields.push(`imagem_url = $${index++}`);
    params.push(normalizarImagemUrl(imagem_url));
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "Nenhum campo para atualizar" });
  }

  params.push(Number(String(id)));
  try {
    const result = await pool.query(
      `UPDATE produtos
       SET ${fields.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, codigo_produto, nome, embalagem, preco_base, ativo, imagem_url`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    // Compatibilidade temporária para bases sem a coluna "ativo"
    if (error?.code === "42703") {
      if (ativo !== undefined) {
        return res.status(400).json({
          error: "Bloqueio de produto indisponível: aplique a migração migration-produtos-ativo.sql",
        });
      }
      try {
        const fallback = await pool.query(
          `UPDATE produtos
           SET ${fields.join(", ")}
           WHERE id = $${params.length}
           RETURNING id, codigo_produto, nome, embalagem, preco_base, imagem_url`,
          params
        );
        if (fallback.rows.length === 0) {
          return res.status(404).json({ error: "Produto não encontrado" });
        }
        return res.json({ ...fallback.rows[0], ativo: true });
      } catch (fallbackError) {
        console.error("Erro ao atualizar produto (fallback):", fallbackError);
      }
    }
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ error: "Erro ao atualizar produto" });
  }
});

app.delete("/produtos/:id", canManageCadastros, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM produtos WHERE id = $1 RETURNING id",
      [Number(String(id))]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }
    return res.status(204).send();
  } catch (error: any) {
    if (error?.code === "23503") {
      return res.status(409).json({
        error: "Produto possui itens vinculados em pedidos e não pode ser excluído.",
      });
    }
    console.error("Erro ao excluir produto:", error);
    return res.status(500).json({ error: "Erro ao excluir produto" });
  }
});

// --------- PEDIDOS ----------

// Lista pedidos com filtros opcionais
app.get("/pedidos", async (req, res) => {
  try {
    const { data, rota_id, cliente_id, status } = req.query;

    let query = `
      SELECT 
        p.id,
        p.chave_pedido,
        p.data,
        p.status,
        p.ordem_remaneio,
        p.valor_total,
        p.valor_efetivado,
        EXISTS (SELECT 1 FROM trocas t WHERE t.pedido_id = p.id) AS tem_trocas,
        (SELECT COUNT(*)::int FROM trocas t WHERE t.pedido_id = p.id) AS qtd_trocas,
        (
          SELECT STRING_AGG(DISTINCT pr.nome, ', ' ORDER BY pr.nome)
          FROM trocas t
          INNER JOIN produtos pr ON pr.id = t.produto_id
          WHERE t.pedido_id = p.id
        ) AS nomes_trocas,
        c.id as cliente_id,
        c.codigo_cliente,
        c.nome as cliente_nome,
        r.id as rota_id,
        r.nome as rota_nome
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rotas r ON p.rota_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (data) {
      query += ` AND p.data = $${paramIndex}`;
      params.push(data);
      paramIndex++;
    }

    if (rota_id) {
      query += ` AND p.rota_id = $${paramIndex}`;
      params.push(parseInt(rota_id as string));
      paramIndex++;
    }

    if (cliente_id) {
      query += ` AND p.cliente_id = $${paramIndex}`;
      params.push(parseInt(cliente_id as string));
      paramIndex++;
    }

    if (status) {
      const statusNormalizado = normalizarStatus(String(status));
      if (!statusNormalizado) {
        return res.status(400).json({
          error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`,
        });
      }
      query += ` AND p.status = $${paramIndex}`;
      params.push(statusNormalizado);
      paramIndex++;
    }

    query += ` ORDER BY
      CASE WHEN p.status = 'CONFERIR' AND p.ordem_remaneio IS NOT NULL THEN 0 ELSE 1 END,
      p.ordem_remaneio ASC NULLS LAST,
      p.data DESC,
      p.id DESC`;

    const result = await pool.query(query, params);
    const pedidos = result.rows;

    // Buscar itens de cada pedido
    for (const pedido of pedidos) {
      const itensResult = await pool.query(
        `SELECT 
          ip.id,
          ip.quantidade,
          ip.embalagem,
          ip.valor_unitario,
          ip.valor_total_item,
          ip.comissao,
          pr.id as produto_id,
          pr.codigo_produto,
          pr.nome as produto_nome
        FROM itens_pedido ip
        INNER JOIN produtos pr ON ip.produto_id = pr.id
        WHERE ip.pedido_id = $1
        ORDER BY ip.id`,
        [pedido.id]
      );
      pedido.itens = itensResult.rows;
    }

    res.json(pedidos);
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

// Busca um pedido por id
app.get("/pedidos/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === "paginado") {
      return next();
    }

    const pedidoResult = await pool.query(
      `SELECT
        p.id,
        p.chave_pedido,
        p.data,
        p.status,
        p.ordem_remaneio,
        p.valor_total,
        p.valor_efetivado,
        EXISTS (SELECT 1 FROM trocas t WHERE t.pedido_id = p.id) AS tem_trocas,
        (SELECT COUNT(*)::int FROM trocas t WHERE t.pedido_id = p.id) AS qtd_trocas,
        (
          SELECT STRING_AGG(DISTINCT pr.nome, ', ' ORDER BY pr.nome)
          FROM trocas t
          INNER JOIN produtos pr ON pr.id = t.produto_id
          WHERE t.pedido_id = p.id
        ) AS nomes_trocas,
        c.id as cliente_id,
        c.codigo_cliente,
        c.nome as cliente_nome,
        r.id as rota_id,
        r.nome as rota_nome
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rotas r ON p.rota_id = r.id
      WHERE p.id = $1`,
      [parseInt(String(id), 10)]
    );

    if (pedidoResult.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const pedido = pedidoResult.rows[0];
    const itensResult = await pool.query(
      `SELECT
        ip.id,
        ip.quantidade,
        ip.embalagem,
        ip.valor_unitario,
        ip.valor_total_item,
        ip.comissao,
        pr.id as produto_id,
        pr.codigo_produto,
        pr.nome as produto_nome
      FROM itens_pedido ip
      INNER JOIN produtos pr ON ip.produto_id = pr.id
      WHERE ip.pedido_id = $1
      ORDER BY ip.id`,
      [pedido.id]
    );
    pedido.itens = itensResult.rows;

    res.json(pedido);
  } catch (error) {
    console.error("Erro ao buscar pedido por id:", error);
    res.status(500).json({ error: "Erro ao buscar pedido" });
  }
});

// Lista pedidos paginados com filtros opcionais
app.get("/pedidos/paginado", async (req, res) => {
  try {
    const { data, rota_id, cliente_id, status, q, page = "1", limit = "10" } = req.query;

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = `WHERE 1=1`;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (data) {
      whereClause += ` AND p.data = $${paramIndex}`;
      params.push(String(data));
      paramIndex++;
    }

    if (rota_id) {
      whereClause += ` AND p.rota_id = $${paramIndex}`;
      params.push(parseInt(String(rota_id), 10));
      paramIndex++;
    }

    if (cliente_id) {
      whereClause += ` AND p.cliente_id = $${paramIndex}`;
      params.push(parseInt(String(cliente_id), 10));
      paramIndex++;
    }

    if (status) {
      const statusNormalizado = normalizarStatus(String(status));
      if (!statusNormalizado) {
        return res.status(400).json({
          error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`,
        });
      }
      whereClause += ` AND p.status = $${paramIndex}`;
      params.push(statusNormalizado);
      paramIndex++;
    }

    if (q) {
      whereClause += ` AND (
        c.nome ILIKE $${paramIndex}
        OR c.codigo_cliente ILIKE $${paramIndex}
        OR p.chave_pedido ILIKE $${paramIndex}
      )`;
      params.push(`%${String(q)}%`);
      paramIndex++;
    }

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM pedidos p
       INNER JOIN clientes c ON p.cliente_id = c.id
       LEFT JOIN rotas r ON p.rota_id = r.id
       ${whereClause}`,
      params
    );
    const total = totalResult.rows[0].total as number;

    const dataResult = await pool.query(
      `SELECT
        p.id,
        p.chave_pedido,
        p.data,
        p.status,
        p.ordem_remaneio,
        p.valor_total,
        p.valor_efetivado,
        EXISTS (SELECT 1 FROM trocas t WHERE t.pedido_id = p.id) AS tem_trocas,
        (SELECT COUNT(*)::int FROM trocas t WHERE t.pedido_id = p.id) AS qtd_trocas,
        (
          SELECT STRING_AGG(DISTINCT pr.nome, ', ' ORDER BY pr.nome)
          FROM trocas t
          INNER JOIN produtos pr ON pr.id = t.produto_id
          WHERE t.pedido_id = p.id
        ) AS nomes_trocas,
        c.id as cliente_id,
        c.codigo_cliente,
        c.nome as cliente_nome,
        r.id as rota_id,
        r.nome as rota_nome
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rotas r ON p.rota_id = r.id
      ${whereClause}
      ORDER BY
        CASE WHEN p.status = 'CONFERIR' AND p.ordem_remaneio IS NOT NULL THEN 0 ELSE 1 END,
        p.ordem_remaneio ASC NULLS LAST,
        p.data DESC,
        p.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );
    const pedidos = dataResult.rows;

    for (const pedido of pedidos) {
      const itensResult = await pool.query(
        `SELECT
          ip.id,
          ip.quantidade,
          ip.embalagem,
          ip.valor_unitario,
          ip.valor_total_item,
          ip.comissao,
          pr.id as produto_id,
          pr.codigo_produto,
          pr.nome as produto_nome
        FROM itens_pedido ip
        INNER JOIN produtos pr ON ip.produto_id = pr.id
        WHERE ip.pedido_id = $1
        ORDER BY ip.id`,
        [pedido.id]
      );
      pedido.itens = itensResult.rows;
    }

    res.json({
      data: pedidos,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(Math.ceil(total / limitNum), 1),
    });
  } catch (error) {
    console.error("Erro ao buscar pedidos paginados:", error);
    res.status(500).json({ error: "Erro ao buscar pedidos paginados" });
  }
});

app.patch(
  "/pedidos/remaneio/ordem",
  autenticarToken,
  requireRoles("admin", "backoffice", "motorista"),
  async (req: AuthenticatedRequest, res) => {
    const pedidoIdsRaw: unknown[] | null = Array.isArray(req.body?.pedido_ids) ? req.body.pedido_ids : null;
    if (!pedidoIdsRaw || pedidoIdsRaw.length === 0) {
      return res.status(400).json({ error: "pedido_ids é obrigatório e deve ter ao menos 1 item." });
    }

    const pedidoIds = [
      ...new Set(
        pedidoIdsRaw
          .map((id: unknown) => Number(id))
          .filter((id: number): id is number => Number.isInteger(id) && id > 0)
      ),
    ];
    if (pedidoIds.length === 0) {
      return res.status(400).json({ error: "pedido_ids inválido." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const conferindoResult = await client.query(
        `SELECT id
         FROM pedidos
         WHERE status = 'CONFERIR'
         ORDER BY ordem_remaneio ASC NULLS LAST, data DESC, id DESC`
      );

      const idsConferindo: number[] = conferindoResult.rows.map((row) => Number(row.id));
      const idsConferindoSet = new Set<number>(idsConferindo);
      const idsInvalidos = pedidoIds.filter((id) => !idsConferindoSet.has(id));
      if (idsInvalidos.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Um ou mais pedidos não estão no status Conferir.",
          invalidos: idsInvalidos,
        });
      }

      const idsRestantes = idsConferindo.filter((id) => !pedidoIds.includes(id));
      const ordemFinal = [...pedidoIds, ...idsRestantes];

      await client.query(
        `WITH nova_ordem AS (
           SELECT * FROM UNNEST($1::int[]) WITH ORDINALITY AS t(id, posicao)
         )
         UPDATE pedidos p
         SET ordem_remaneio = no.posicao::int,
             atualizado_por = $2,
             atualizado_em = NOW()
         FROM nova_ordem no
         WHERE p.id = no.id
           AND p.status = 'CONFERIR'`,
        [ordemFinal, req.user?.id || null]
      );

      await client.query("COMMIT");
      return res.json({ ok: true, total: ordemFinal.length });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao reordenar remaneio:", error);
      return res.status(500).json({ error: "Erro ao reordenar remaneio." });
    } finally {
      client.release();
    }
  }
);

// Cria um novo pedido com itens
app.post("/pedidos", async (req: AuthenticatedRequest, res) => {
  const { chave_pedido, cliente_id, rota_id, data, status, itens } = req.body;
  const usuarioId = req.user?.id || null;

  if (!cliente_id || !data || !itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({
      error: "cliente_id, data e itens (array não vazio) são obrigatórios",
    });
  }

  // Validação dos itens
  for (const item of itens) {
    if (!item.produto_id || !item.quantidade || item.valor_unitario === undefined) {
      return res.status(400).json({
        error: "Cada item deve ter produto_id, quantidade e valor_unitario",
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Gerar chave_pedido se não fornecida
    let finalChavePedido = chave_pedido;
    if (!finalChavePedido) {
      const clienteResult = await client.query(
        "SELECT codigo_cliente FROM clientes WHERE id = $1",
        [cliente_id]
      );
      if (clienteResult.rows.length === 0) {
        throw new Error("Cliente não encontrado");
      }
      const codigoCliente = clienteResult.rows[0].codigo_cliente;
      const timestamp = Date.now().toString(36);
      finalChavePedido = `${codigoCliente}${timestamp}`;
    }

    // Validar se todos os produtos existem
    for (const item of itens) {
      const produtoCheck = await client.query(
        "SELECT id FROM produtos WHERE id = $1",
        [item.produto_id]
      );
      if (produtoCheck.rows.length === 0) {
        throw new Error(`Produto com id ${item.produto_id} não encontrado`);
      }
    }

    // Calcular valor total do pedido
    let valorTotal = 0;
    for (const item of itens) {
      const valorItem = parseFloat(item.quantidade) * parseFloat(item.valor_unitario);
      valorTotal += valorItem;
    }

    const statusNormalizado = status ? normalizarStatus(String(status)) : "EM_ESPERA";
    if (!statusNormalizado) {
      throw new Error(`Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`);
    }

    // Inserir pedido
    const pedidoResult = await client.query(
      `INSERT INTO pedidos (chave_pedido, cliente_id, rota_id, data, status, valor_total, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, chave_pedido, data, status, valor_total`,
      [
        finalChavePedido,
        cliente_id,
        rota_id || null,
        data,
        statusNormalizado,
        valorTotal,
        usuarioId,
      ]
    );

    const pedido = pedidoResult.rows[0];

    // Inserir itens do pedido
    const itensInseridos = [];
    for (const item of itens) {
      const valorTotalItem = parseFloat(item.quantidade) * parseFloat(item.valor_unitario);
      const comissao = item.comissao || 0;

      const itemResult = await client.query(
        `INSERT INTO itens_pedido 
         (pedido_id, produto_id, quantidade, embalagem, valor_unitario, valor_total_item, comissao)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, quantidade, embalagem, valor_unitario, valor_total_item, comissao`,
        [
          pedido.id,
          item.produto_id,
          item.quantidade,
          item.embalagem || null,
          item.valor_unitario,
          valorTotalItem,
          comissao,
        ]
      );

      // Buscar dados do produto
      const produtoResult = await client.query(
        "SELECT id, codigo_produto, nome FROM produtos WHERE id = $1",
        [item.produto_id]
      );

      const produto = produtoResult.rows[0];
      const itemInserido = itemResult.rows[0];

      itensInseridos.push({
        id: itemInserido.id,
        produto_id: produto.id,
        codigo_produto: produto.codigo_produto,
        produto_nome: produto.nome,
        quantidade: itemInserido.quantidade,
        embalagem: itemInserido.embalagem,
        valor_unitario: itemInserido.valor_unitario,
        valor_total_item: itemInserido.valor_total_item,
        comissao: itemInserido.comissao,
      });
    }

    await client.query("COMMIT");

    res.status(201).json({
      ...pedido,
      itens: itensInseridos,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar pedido:", error);
    
    // Mensagens de erro mais específicas
    if (error.message === "Cliente não encontrado") {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    
    if (error.message?.includes("Produto com id")) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.code === "23503") { // Foreign key violation
      if (error.constraint?.includes("cliente_id")) {
        return res.status(400).json({ error: "Cliente não encontrado" });
      }
      if (error.constraint?.includes("produto_id")) {
        return res.status(400).json({ error: "Um ou mais produtos não foram encontrados" });
      }
      if (error.constraint?.includes("rota_id")) {
        return res.status(400).json({ error: "Rota não encontrada" });
      }
    }
    
    if (error.code === "23505") { // Unique violation
      return res.status(400).json({ error: "Chave do pedido já existe" });
    }
    
    res.status(500).json({ 
      error: "Erro ao criar pedido",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Atualiza o status de um pedido
app.patch("/pedidos/:id/status", async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status, valor_efetivado, data } = req.body;

  if (!status) {
    return res.status(400).json({ error: "status é obrigatório" });
  }

  const statusNormalizado = normalizarStatus(String(status));
  if (!statusNormalizado) {
    return res.status(400).json({ 
      error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}` 
    });
  }

  const dataNormalizada = data !== undefined ? parseDateParam(data) : null;
  if (data !== undefined && !dataNormalizada) {
    return res.status(400).json({ error: "Use data no formato YYYY-MM-DD" });
  }

  try {
    const updateFields: string[] = ["status = $1", "atualizado_por = $2"];
    const params: any[] = [statusNormalizado];
    params.push(req.user?.id || null);
    let paramIndex = 3;

    if (statusNormalizado === "CONFERIR") {
      updateFields.push(
        `ordem_remaneio = COALESCE(
          ordem_remaneio,
          (SELECT COALESCE(MAX(ordem_remaneio), 0) + 1 FROM pedidos WHERE status = 'CONFERIR')
        )`
      );
    } else {
      updateFields.push("ordem_remaneio = NULL");
    }

    if (valor_efetivado !== undefined) {
      updateFields.push(`valor_efetivado = $${paramIndex}`);
      params.push(valor_efetivado);
      paramIndex++;
    }

    if (data !== undefined && dataNormalizada) {
      updateFields.push(`data = $${paramIndex}`);
      params.push(dataNormalizada);
      paramIndex++;
    }

    params.push(parseInt(String(id), 10));

    const result = await pool.query(
      `UPDATE pedidos 
       SET ${updateFields.join(", ")}, atualizado_em = NOW()
       WHERE id = $${paramIndex}
       RETURNING id, chave_pedido, data, status, ordem_remaneio, valor_total, valor_efetivado`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar status do pedido:", error);
    res.status(500).json({ error: "Erro ao atualizar status do pedido" });
  }
});

// --------- TROCAS ----------

// Lista trocas de um pedido específico
app.get("/pedidos/:id/trocas", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        t.id,
        t.pedido_id,
        t.item_pedido_id,
        t.quantidade,
        t.valor_troca,
        t.motivo,
        t.criado_em,
        p.id as produto_id,
        p.codigo_produto,
        p.nome as produto_nome
      FROM trocas t
      INNER JOIN produtos p ON t.produto_id = p.id
      WHERE t.pedido_id = $1
      ORDER BY t.criado_em DESC`,
      [parseInt(String(id), 10)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar trocas:", error);
    res.status(500).json({ error: "Erro ao buscar trocas" });
  }
});

// Cria uma nova troca
app.post("/trocas", async (req: AuthenticatedRequest, res) => {
  const { pedido_id, item_pedido_id, produto_id, quantidade, valor_troca, motivo } = req.body;
  const usuarioId = req.user?.id || null;

  if (!pedido_id || !produto_id || !quantidade) {
    return res.status(400).json({
      error: "pedido_id, produto_id e quantidade são obrigatórios",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verificar se o pedido existe
    const pedidoCheck = await client.query(
      "SELECT id FROM pedidos WHERE id = $1",
      [pedido_id]
    );
    if (pedidoCheck.rows.length === 0) {
      throw new Error("Pedido não encontrado");
    }

    // Verificar se o produto existe
    const produtoCheck = await client.query(
      "SELECT id FROM produtos WHERE id = $1",
      [produto_id]
    );
    if (produtoCheck.rows.length === 0) {
      throw new Error("Produto não encontrado");
    }

    // Inserir troca
    const result = await client.query(
      `INSERT INTO trocas (pedido_id, item_pedido_id, produto_id, quantidade, valor_troca, motivo, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, pedido_id, item_pedido_id, produto_id, quantidade, valor_troca, motivo, criado_em`,
      [
        pedido_id,
        item_pedido_id || null,
        produto_id,
        quantidade,
        valor_troca || 0,
        motivo || null,
        usuarioId,
      ]
    );

    // Buscar dados do produto para retornar completo
    const produtoResult = await client.query(
      "SELECT id, codigo_produto, nome FROM produtos WHERE id = $1",
      [produto_id]
    );

    await client.query("COMMIT");

    const troca = result.rows[0];
    const produto = produtoResult.rows[0];

    res.status(201).json({
      ...troca,
      produto: produto,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar troca:", error);

    if (error.message === "Pedido não encontrado") {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    if (error.message === "Produto não encontrado") {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    if (error.code === "23503") {
      if (error.constraint?.includes("pedido_id")) {
        return res.status(400).json({ error: "Pedido não encontrado" });
      }
      if (error.constraint?.includes("produto_id")) {
        return res.status(400).json({ error: "Produto não encontrado" });
      }
    }

    res.status(500).json({ error: "Erro ao criar troca" });
  } finally {
    client.release();
  }
});

// Exclui uma troca
app.delete("/trocas/:id", async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM trocas
       WHERE id = $1
       RETURNING id`,
      [parseInt(String(id), 10)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Troca não encontrada" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir troca:", error);
    return res.status(500).json({ error: "Erro ao excluir troca" });
  }
});

// Atualiza um pedido completo (incluindo itens)
app.put("/pedidos/:id", async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { rota_id, data, status, itens } = req.body;
  const usuarioId = req.user?.id || null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verificar se o pedido existe
    const pedidoCheck = await client.query(
      "SELECT id, cliente_id FROM pedidos WHERE id = $1",
      [parseInt(String(id), 10)]
    );
    if (pedidoCheck.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const clienteId = pedidoCheck.rows[0].cliente_id;

    // Atualizar campos do pedido (se fornecidos)
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (rota_id !== undefined) {
      updateFields.push(`rota_id = $${paramIndex}`);
      params.push(rota_id);
      paramIndex++;
    }

    if (data !== undefined) {
      updateFields.push(`data = $${paramIndex}`);
      params.push(data);
      paramIndex++;
    }

    if (status !== undefined) {
      const statusNormalizado = normalizarStatus(String(status));
      if (!statusNormalizado) {
        throw new Error(`Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`);
      }
      updateFields.push(`status = $${paramIndex}`);
      params.push(statusNormalizado);
      paramIndex++;
    }

    // Se itens foram fornecidos, atualizar itens
    if (itens && Array.isArray(itens)) {
      // Validar itens
      for (const item of itens) {
        if (!item.produto_id || !item.quantidade || item.valor_unitario === undefined) {
          throw new Error("Cada item deve ter produto_id, quantidade e valor_unitario");
        }
      }

      // Validar se todos os produtos existem
      for (const item of itens) {
        const produtoCheck = await client.query(
          "SELECT id FROM produtos WHERE id = $1",
          [item.produto_id]
        );
        if (produtoCheck.rows.length === 0) {
          throw new Error(`Produto com id ${item.produto_id} não encontrado`);
        }
      }

      // Antes de deletar itens, remover referências nas trocas
      // (setar item_pedido_id como NULL nas trocas que referenciam itens deste pedido)
      await client.query(
        "UPDATE trocas SET item_pedido_id = NULL WHERE pedido_id = $1 AND item_pedido_id IS NOT NULL",
        [parseInt(String(id), 10)]
      );

      // Deletar itens antigos
      await client.query("DELETE FROM itens_pedido WHERE pedido_id = $1", [parseInt(String(id), 10)]);

      // Inserir novos itens
      let valorTotal = 0;
      for (const item of itens) {
        const valorTotalItem = parseFloat(item.quantidade) * parseFloat(item.valor_unitario);
        valorTotal += valorTotalItem;

        await client.query(
          `INSERT INTO itens_pedido 
           (pedido_id, produto_id, quantidade, embalagem, valor_unitario, valor_total_item, comissao)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            parseInt(String(id), 10),
            item.produto_id,
            item.quantidade,
            item.embalagem || null,
            item.valor_unitario,
            valorTotalItem,
            item.comissao || 0,
          ]
        );
      }

      // Atualizar valor_total do pedido
      updateFields.push(`valor_total = $${paramIndex}`);
      params.push(valorTotal);
      paramIndex++;
    }

    // Atualizar pedido se houver campos para atualizar
    if (updateFields.length > 0) {
      updateFields.push(`atualizado_em = NOW()`);
      updateFields.push(`atualizado_por = $${paramIndex}`);
      params.push(usuarioId);
      paramIndex++;
      params.push(parseInt(String(id), 10));

      const updateQuery = `UPDATE pedidos SET ${updateFields.join(", ")} WHERE id = $${params.length}`;
      await client.query(updateQuery, params);
    }

    await client.query("COMMIT");

    // Buscar pedido atualizado com itens
    const pedidoResult = await client.query(
      `SELECT 
        p.id,
        p.chave_pedido,
        p.data,
        p.status,
        p.valor_total,
        p.valor_efetivado,
        c.id as cliente_id,
        c.codigo_cliente,
        c.nome as cliente_nome,
        r.id as rota_id,
        r.nome as rota_nome
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rotas r ON p.rota_id = r.id
      WHERE p.id = $1`,
      [parseInt(String(id), 10)]
    );

    const pedido = pedidoResult.rows[0];

    // Buscar itens
    const itensResult = await client.query(
      `SELECT 
        ip.id,
        ip.quantidade,
        ip.embalagem,
        ip.valor_unitario,
        ip.valor_total_item,
        ip.comissao,
        pr.id as produto_id,
        pr.codigo_produto,
        pr.nome as produto_nome
      FROM itens_pedido ip
      INNER JOIN produtos pr ON ip.produto_id = pr.id
      WHERE ip.pedido_id = $1
      ORDER BY ip.id`,
      [parseInt(String(id), 10)]
    );

    pedido.itens = itensResult.rows;

    res.json(pedido);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Erro ao atualizar pedido:", error);

    if (error.message?.includes("Cada item deve ter")) {
      return res.status(400).json({ error: error.message });
    }

    if (error.message?.includes("Produto com id")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes("Status inválido")) {
      return res.status(400).json({ error: error.message });
    }

    if (error.code === "23503") {
      if (error.constraint?.includes("rota_id")) {
        return res.status(400).json({ error: "Rota não encontrada" });
      }
      if (error.constraint?.includes("trocas_item_pedido_id_fkey")) {
        return res.status(400).json({ 
          error: "Não é possível atualizar pedido: existem trocas vinculadas aos itens. Remova as trocas primeiro ou atualize-as." 
        });
      }
    }

    res.status(500).json({ 
      error: "Erro ao atualizar pedido",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// --------- RELATÓRIOS ----------

const parseDateParam = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
};

// Produção: quantidade total por produto
app.get("/relatorios/producao", async (req, res) => {
  try {
    const dataInicio = parseDateParam(req.query.data_inicio);
    const dataFim = parseDateParam(req.query.data_fim);
    const status = req.query.status ? normalizarStatus(String(req.query.status)) : null;

    if ((req.query.data_inicio && !dataInicio) || (req.query.data_fim && !dataFim)) {
      return res.status(400).json({ error: "Use data_inicio e data_fim no formato YYYY-MM-DD" });
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      return res.status(400).json({ error: "data_inicio não pode ser maior que data_fim" });
    }
    if (req.query.status && !status) {
      return res.status(400).json({
        error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`,
      });
    }

    const params: string[] = [];
    const filtros: string[] = [];
    if (dataInicio) {
      params.push(dataInicio);
      filtros.push(`p.data >= $${params.length}`);
    }
    if (dataFim) {
      params.push(dataFim);
      filtros.push(`p.data <= $${params.length}`);
    }
    if (status) {
      params.push(status);
      filtros.push(`p.status = $${params.length}`);
    }
    const onPedidos = filtros.length > 0
      ? `AND ${filtros.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT
        pr.id AS produto_id,
        pr.codigo_produto,
        pr.nome AS produto_nome,
        pr.embalagem,
        COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN ip.quantidade ELSE 0 END), 0)::numeric AS quantidade_total
      FROM produtos pr
      LEFT JOIN itens_pedido ip ON ip.produto_id = pr.id
      LEFT JOIN pedidos p ON p.id = ip.pedido_id ${onPedidos}
      GROUP BY pr.id, pr.codigo_produto, pr.nome, pr.embalagem
      HAVING COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN ip.quantidade ELSE 0 END), 0) > 0
      ORDER BY pr.nome ASC`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório de produção:", error);
    return res.status(500).json({ error: "Erro ao gerar relatório de produção" });
  }
});

// Relatório de rotas: clientes e seus pedidos
app.get("/relatorios/rotas", async (req, res) => {
  try {
    const dataInicio = parseDateParam(req.query.data_inicio);
    const dataFim = parseDateParam(req.query.data_fim);
    const status = req.query.status ? normalizarStatus(String(req.query.status)) : null;

    if ((req.query.data_inicio && !dataInicio) || (req.query.data_fim && !dataFim)) {
      return res.status(400).json({ error: "Use data_inicio e data_fim no formato YYYY-MM-DD" });
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      return res.status(400).json({ error: "data_inicio não pode ser maior que data_fim" });
    }
    if (req.query.status && !status) {
      return res.status(400).json({
        error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`,
      });
    }

    const params: string[] = [];
    const filtros: string[] = [];
    if (dataInicio) {
      params.push(dataInicio);
      filtros.push(`p.data >= $${params.length}`);
    }
    if (dataFim) {
      params.push(dataFim);
      filtros.push(`p.data <= $${params.length}`);
    }
    if (status) {
      params.push(status);
      filtros.push(`p.status = $${params.length}`);
    }
    const onPedidos = filtros.length > 0
      ? `AND ${filtros.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT
        COALESCE(r.id, 0) AS rota_id,
        COALESCE(r.nome, 'Sem rota') AS rota_nome,
        c.id AS cliente_id,
        c.codigo_cliente,
        c.nome AS cliente_nome,
        COUNT(p.id)::int AS total_pedidos,
        COALESCE(SUM(p.valor_total), 0)::numeric AS valor_total_pedidos
      FROM clientes c
      LEFT JOIN rotas r ON r.id = c.rota_id
      LEFT JOIN pedidos p ON p.cliente_id = c.id ${onPedidos}
      GROUP BY r.id, r.nome, c.id, c.codigo_cliente, c.nome
      ORDER BY rota_nome ASC, c.nome ASC`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório de rotas:", error);
    return res.status(500).json({ error: "Erro ao gerar relatório de rotas" });
  }
});

// Relatório detalhado de rotas: rota > cliente > pedidos > itens
app.get("/relatorios/rotas-detalhado", async (req, res) => {
  try {
    const dataInicio = parseDateParam(req.query.data_inicio);
    const dataFim = parseDateParam(req.query.data_fim);
    const status = req.query.status ? normalizarStatus(String(req.query.status)) : null;

    if ((req.query.data_inicio && !dataInicio) || (req.query.data_fim && !dataFim)) {
      return res.status(400).json({ error: "Use data_inicio e data_fim no formato YYYY-MM-DD" });
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      return res.status(400).json({ error: "data_inicio não pode ser maior que data_fim" });
    }
    if (req.query.status && !status) {
      return res.status(400).json({
        error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`,
      });
    }

    const params: string[] = [];
    const filtros: string[] = [];
    if (dataInicio) {
      params.push(dataInicio);
      filtros.push(`p.data >= $${params.length}`);
    }
    if (dataFim) {
      params.push(dataFim);
      filtros.push(`p.data <= $${params.length}`);
    }
    if (status) {
      params.push(status);
      filtros.push(`p.status = $${params.length}`);
    }
    const onPedidos = filtros.length > 0 ? `AND ${filtros.join(" AND ")}` : "";

    const result = await pool.query(
      `WITH pedidos_filtrados AS (
         SELECT
           p.id,
           p.cliente_id,
           p.chave_pedido,
           p.data,
           p.status,
           p.valor_total,
           EXISTS (SELECT 1 FROM trocas t WHERE t.pedido_id = p.id) AS tem_trocas,
           (SELECT COUNT(*)::int FROM trocas t WHERE t.pedido_id = p.id) AS qtd_trocas,
           (
             SELECT STRING_AGG(DISTINCT pr.nome, ', ' ORDER BY pr.nome)
             FROM trocas t
             INNER JOIN produtos pr ON pr.id = t.produto_id
             WHERE t.pedido_id = p.id
           ) AS nomes_trocas
         FROM pedidos p
         WHERE 1=1 ${onPedidos}
       )
       SELECT
         COALESCE(r.id, 0) AS rota_id,
         COALESCE(r.nome, 'Sem rota') AS rota_nome,
         c.id AS cliente_id,
         c.codigo_cliente,
         c.nome AS cliente_nome,
         pf.id AS pedido_id,
         pf.chave_pedido,
         pf.data AS pedido_data,
         pf.status AS pedido_status,
         pf.valor_total AS pedido_valor_total,
         pf.tem_trocas AS tem_trocas,
         pf.qtd_trocas AS qtd_trocas,
         pf.nomes_trocas AS nomes_trocas,
         pr.id AS produto_id,
         pr.codigo_produto,
         pr.nome AS produto_nome,
         ip.embalagem,
         ip.quantidade,
         ip.valor_total_item
       FROM clientes c
       LEFT JOIN rotas r ON r.id = c.rota_id
       INNER JOIN pedidos_filtrados pf ON pf.cliente_id = c.id
       LEFT JOIN itens_pedido ip ON ip.pedido_id = pf.id
       LEFT JOIN produtos pr ON pr.id = ip.produto_id
       ORDER BY rota_nome ASC, c.nome ASC, pf.data DESC, pf.id DESC, pr.nome ASC NULLS LAST`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório detalhado de rotas:", error);
    return res.status(500).json({ error: "Erro ao gerar relatório detalhado de rotas" });
  }
});

// Produtos por rota: quantidade de cada produto filtrado por rota
app.get("/relatorios/produtos-por-rota", async (req, res) => {
  try {
    const { rota_id } = req.query;
    const rotaId = rota_id ? Number(String(rota_id)) : null;
    const dataInicio = parseDateParam(req.query.data_inicio);
    const dataFim = parseDateParam(req.query.data_fim);
    const status = req.query.status ? normalizarStatus(String(req.query.status)) : null;

    if (rota_id && (!Number.isFinite(rotaId) || Number(rotaId) <= 0)) {
      return res.status(400).json({ error: "rota_id inválido" });
    }
    if ((req.query.data_inicio && !dataInicio) || (req.query.data_fim && !dataFim)) {
      return res.status(400).json({ error: "Use data_inicio e data_fim no formato YYYY-MM-DD" });
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      return res.status(400).json({ error: "data_inicio não pode ser maior que data_fim" });
    }
    if (req.query.status && !status) {
      return res.status(400).json({
        error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`,
      });
    }

    const queryParams: any[] = [];
    const buildWhereParts: string[] = [];
    if (rotaId) {
      queryParams.push(rotaId);
      buildWhereParts.push(`p.rota_id = $${queryParams.length}`);
    }
    if (dataInicio) {
      queryParams.push(dataInicio);
      buildWhereParts.push(`p.data >= $${queryParams.length}`);
    }
    if (dataFim) {
      queryParams.push(dataFim);
      buildWhereParts.push(`p.data <= $${queryParams.length}`);
    }
    if (status) {
      queryParams.push(status);
      buildWhereParts.push(`p.status = $${queryParams.length}`);
    }
    const whereClause = buildWhereParts.length > 0 ? `WHERE ${buildWhereParts.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
        r.id AS rota_id,
        r.nome AS rota_nome,
        pr.id AS produto_id,
        pr.codigo_produto,
        pr.nome AS produto_nome,
        pr.embalagem,
        COALESCE(SUM(ip.quantidade), 0)::numeric AS quantidade_total
      FROM itens_pedido ip
      INNER JOIN pedidos p ON p.id = ip.pedido_id
      INNER JOIN produtos pr ON pr.id = ip.produto_id
      LEFT JOIN rotas r ON r.id = p.rota_id
      ${whereClause}
      GROUP BY r.id, r.nome, pr.id, pr.codigo_produto, pr.nome, pr.embalagem
      ORDER BY r.nome ASC NULLS LAST, pr.nome ASC`,
      queryParams
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório de produtos por rota:", error);
    return res.status(500).json({ error: "Erro ao gerar relatório de produtos por rota" });
  }
});

// Top 10 clientes que mais venderam no período
app.get("/relatorios/top-clientes", async (req, res) => {
  try {
    const dataInicio = parseDateParam(req.query.data_inicio);
    const dataFim = parseDateParam(req.query.data_fim);
    const status = req.query.status ? normalizarStatus(String(req.query.status)) : null;

    if ((req.query.data_inicio && !dataInicio) || (req.query.data_fim && !dataFim)) {
      return res.status(400).json({ error: "Use data_inicio e data_fim no formato YYYY-MM-DD" });
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      return res.status(400).json({ error: "data_inicio não pode ser maior que data_fim" });
    }
    if (req.query.status && !status) {
      return res.status(400).json({
        error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`,
      });
    }

    const params: string[] = [];
    const filtros: string[] = [];
    if (dataInicio) {
      params.push(dataInicio);
      filtros.push(`p.data >= $${params.length}`);
    }
    if (dataFim) {
      params.push(dataFim);
      filtros.push(`p.data <= $${params.length}`);
    }
    if (status) {
      params.push(status);
      filtros.push(`p.status = $${params.length}`);
    }
    const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
        c.id AS cliente_id,
        c.codigo_cliente,
        c.nome AS cliente_nome,
        COUNT(p.id)::int AS total_pedidos,
        COALESCE(SUM(p.valor_total), 0)::numeric AS valor_total_vendas
      FROM pedidos p
      INNER JOIN clientes c ON c.id = p.cliente_id
      ${whereClause}
      GROUP BY c.id, c.codigo_cliente, c.nome
      ORDER BY valor_total_vendas DESC, total_pedidos DESC, c.nome ASC
      LIMIT 10`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório de top clientes:", error);
    return res.status(500).json({ error: "Erro ao gerar relatório de top clientes" });
  }
});

// Relatório de trocas
app.get("/relatorios/trocas", async (req, res) => {
  try {
    const dataInicio = parseDateParam(req.query.data_inicio);
    const dataFim = parseDateParam(req.query.data_fim);
    const status = req.query.status ? normalizarStatus(String(req.query.status)) : null;

    if ((req.query.data_inicio && !dataInicio) || (req.query.data_fim && !dataFim)) {
      return res.status(400).json({ error: "Use data_inicio e data_fim no formato YYYY-MM-DD" });
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      return res.status(400).json({ error: "data_inicio não pode ser maior que data_fim" });
    }
    if (req.query.status && !status) {
      return res.status(400).json({
        error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}`,
      });
    }

    const params: string[] = [];
    const filtros: string[] = [];
    if (dataInicio) {
      params.push(dataInicio);
      filtros.push(`p.data >= $${params.length}`);
    }
    if (dataFim) {
      params.push(dataFim);
      filtros.push(`p.data <= $${params.length}`);
    }
    if (status) {
      params.push(status);
      filtros.push(`p.status = $${params.length}`);
    }
    const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
        t.id AS troca_id,
        t.criado_em,
        t.quantidade,
        COALESCE(t.valor_troca, 0)::numeric AS valor_troca,
        t.motivo,
        p.id AS pedido_id,
        p.chave_pedido,
        p.data AS pedido_data,
        p.status AS pedido_status,
        r.id AS rota_id,
        COALESCE(r.nome, 'Sem rota') AS rota_nome,
        c.id AS cliente_id,
        c.codigo_cliente,
        c.nome AS cliente_nome,
        pr.id AS produto_id,
        pr.codigo_produto,
        pr.nome AS produto_nome
      FROM trocas t
      INNER JOIN pedidos p ON p.id = t.pedido_id
      INNER JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN rotas r ON r.id = p.rota_id
      INNER JOIN produtos pr ON pr.id = t.produto_id
      ${whereClause}
      ORDER BY p.data DESC, p.id DESC, t.criado_em DESC`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório de trocas:", error);
    return res.status(500).json({ error: "Erro ao gerar relatório de trocas" });
  }
});

const startServer = async () => {
  try {
    await ensureImageColumns();
    await ensureDefaultAdminUser();
    app.listen(PORT, () => {
      console.log(`APPEMP backend ouvindo na porta ${PORT}`);
    });
  } catch (error) {
    console.error("Falha ao inicializar backend:", error);
    process.exit(1);
  }
};

startServer();
