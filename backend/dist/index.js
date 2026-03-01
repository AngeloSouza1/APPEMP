"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Em desenvolvimento, permitir todas as origens
        if (process.env.NODE_ENV !== 'production') {
            callback(null, true);
        }
        else {
            // Em produção, usar lista da env CORS_ORIGIN (separada por vírgula)
            const allowedOrigins = (process.env.CORS_ORIGIN || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
const PORT = process.env.PORT || 3000;
const APP_BASE_URL = (process.env.APP_BASE_URL || "https://appemp.onrender.com").replace(/\/+$/, "");
const STATUS_PERMITIDOS = ["EM_ESPERA", "CONFERIR", "EFETIVADO", "CANCELADO"];
const PERFIS_PERMITIDOS = ["admin", "backoffice", "vendedor", "motorista"];
const AUTH_USER = process.env.AUTH_USER || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123";
const AUTH_NAME = process.env.AUTH_NAME || "Administrador";
const AUTH_PERFIL = (process.env.AUTH_PERFIL || "admin");
const JWT_SECRET = process.env.JWT_SECRET || "appemp-dev-secret-change-me";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "8h");
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_ACCESS_TOKEN = process.env.EXPO_PUSH_ACCESS_TOKEN || "";
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
    || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
    || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const CLOUDINARY_STORAGE_LIMIT_BYTES = Number(process.env.CLOUDINARY_STORAGE_LIMIT_BYTES || 1024 * 1024 * 1024);
const CLOUDINARY_ALERT_THRESHOLD_PERCENT = Number(process.env.CLOUDINARY_ALERT_THRESHOLD_PERCENT || 80);
const CLOUDINARY_MONITOR_INTERVAL_MINUTES = Number(process.env.CLOUDINARY_MONITOR_INTERVAL_MINUTES || 360);
const CLOUDINARY_ALERT_COOLDOWN_MINUTES = Number(process.env.CLOUDINARY_ALERT_COOLDOWN_MINUTES || 1440);
const CLOUDINARY_ALERT_EMAIL_TO = process.env.CLOUDINARY_ALERT_EMAIL_TO || "";
const CLOUDINARY_ALERT_EMAIL_FROM = process.env.CLOUDINARY_ALERT_EMAIL_FROM || process.env.SMTP_USER || "";
const CLOUDINARY_BACKUP_DIR = process.env.CLOUDINARY_BACKUP_DIR || "backups/cloudinary";
const CLOUDINARY_BACKUP_MIN_AGE_DAYS = Number(process.env.CLOUDINARY_BACKUP_MIN_AGE_DAYS || 30);
const CLOUDINARY_BACKUP_BATCH_LIMIT = Number(process.env.CLOUDINARY_BACKUP_BATCH_LIMIT || 100);
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_SECURE_ENV = process.env.SMTP_SECURE;
const SMTP_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 10000);
let cloudinaryMonitorTimer = null;
let cloudinaryLastAlertAt = 0;
const normalizarStatus = (status) => {
    const valorNormalizado = status.trim().toUpperCase().replace(/\s+/g, "_");
    const valorMapeado = valorNormalizado === "OK" ? "EFETIVADO" : valorNormalizado;
    if (STATUS_PERMITIDOS.includes(valorMapeado)) {
        return valorMapeado;
    }
    return null;
};
const normalizarPerfil = (perfil) => {
    const valor = perfil.trim().toLowerCase();
    if (PERFIS_PERMITIDOS.includes(valor)) {
        return valor;
    }
    return null;
};
const normalizarImagemUrl = (imagemUrl) => {
    const valor = String(imagemUrl !== null && imagemUrl !== void 0 ? imagemUrl : "").trim();
    return valor || null;
};
const normalizarNfNumero = (nfNumero) => {
    const valor = String(nfNumero !== null && nfNumero !== void 0 ? nfNumero : "").trim();
    return valor || null;
};
const normalizarNfStatus = (valor) => {
    const status = String(valor !== null && valor !== void 0 ? valor : "").trim().toUpperCase();
    return status === "ANTECIPADA" ? "ANTECIPADA" : "PENDENTE";
};
const normalizarBoolean = (valor) => {
    if (typeof valor === "boolean")
        return valor;
    if (typeof valor === "string") {
        const v = valor.trim().toLowerCase();
        return v === "true" || v === "1" || v === "sim" || v === "yes";
    }
    if (typeof valor === "number")
        return valor === 1;
    return false;
};
const SMTP_SECURE = normalizarBoolean(SMTP_SECURE_ENV) || SMTP_PORT === 465;
const normalizarExpoPushToken = (valor) => {
    const token = String(valor !== null && valor !== void 0 ? valor : "").trim();
    if (!token)
        return null;
    if (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) {
        return token;
    }
    return null;
};
const formatarBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0)
        return "0 B";
    const unidades = ["B", "KB", "MB", "GB", "TB"];
    let valor = bytes;
    let indice = 0;
    while (valor >= 1024 && indice < unidades.length - 1) {
        valor /= 1024;
        indice += 1;
    }
    return `${valor >= 100 ? valor.toFixed(0) : valor.toFixed(2)} ${unidades[indice]}`;
};
const normalizarNomeArquivo = (valor) => valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "arquivo";
const resolverExtensaoArquivo = (url, contentType) => {
    const lowerType = String(contentType || "").toLowerCase();
    if (lowerType.includes("pdf"))
        return ".pdf";
    if (lowerType.includes("png"))
        return ".png";
    if (lowerType.includes("jpeg") || lowerType.includes("jpg"))
        return ".jpg";
    if (lowerType.includes("webp"))
        return ".webp";
    try {
        const pathname = new URL(url).pathname;
        const ext = node_path_1.default.extname(pathname);
        if (ext)
            return ext.toLowerCase();
    }
    catch {
        // Ignora URL inválida e usa fallback abaixo.
    }
    return ".bin";
};
const escapeHtml = (valor) => String(valor !== null && valor !== void 0 ? valor : "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const dividirEmBlocos = (itens, tamanho) => {
    const blocos = [];
    for (let i = 0; i < itens.length; i += tamanho) {
        blocos.push(itens.slice(i, i + tamanho));
    }
    return blocos;
};
const desativarTokensInvalidos = async (tokens) => {
    if (!tokens.length)
        return;
    try {
        await db_1.pool.query(`UPDATE notificacao_dispositivos
       SET ativo = false,
           atualizado_em = NOW()
       WHERE expo_push_token = ANY($1::text[])`, [tokens]);
    }
    catch (error) {
        console.error("Erro ao desativar tokens inválidos:", error);
    }
};
const enviarPushPedidos = async (params) => {
    try {
        const tokensResult = await db_1.pool.query(`SELECT DISTINCT nd.expo_push_token
       FROM notificacao_dispositivos nd
       INNER JOIN usuarios u ON u.id = nd.usuario_id
       WHERE nd.ativo = true
         AND u.ativo = true
         AND u.perfil <> 'motorista'`);
        const tokens = tokensResult.rows
            .map((row) => normalizarExpoPushToken(row.expo_push_token))
            .filter((value) => Boolean(value));
        if (!tokens.length)
            return;
        const payloadBase = {
            sound: "default",
            title: params.titulo,
            body: params.corpo,
            data: params.data || {},
            priority: "high",
            channelId: "appemp-pedidos",
        };
        const invalidos = [];
        const headers = {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
        };
        if (EXPO_PUSH_ACCESS_TOKEN) {
            headers.Authorization = `Bearer ${EXPO_PUSH_ACCESS_TOKEN}`;
        }
        const blocos = dividirEmBlocos(tokens, 100);
        for (const bloco of blocos) {
            const body = bloco.map((to) => ({ to, ...payloadBase }));
            const response = await fetch(EXPO_PUSH_URL, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const textoErro = await response.text();
                console.error("Falha ao enviar push Expo:", response.status, textoErro);
                continue;
            }
            const json = (await response.json());
            if (!Array.isArray(json.data))
                continue;
            json.data.forEach((item, index) => {
                var _a;
                const erro = (_a = item === null || item === void 0 ? void 0 : item.details) === null || _a === void 0 ? void 0 : _a.error;
                if ((item === null || item === void 0 ? void 0 : item.status) === "error" && erro === "DeviceNotRegistered") {
                    const token = bloco[index];
                    if (token)
                        invalidos.push(token);
                }
            });
        }
        if (invalidos.length) {
            await desativarTokensInvalidos(invalidos);
        }
    }
    catch (error) {
        console.error("Erro ao enviar push de pedidos:", error);
    }
};
const cloudinaryMonitoramentoHabilitado = () => Boolean(CLOUDINARY_CLOUD_NAME
    && CLOUDINARY_API_KEY
    && CLOUDINARY_API_SECRET
    && CLOUDINARY_ALERT_EMAIL_TO
    && CLOUDINARY_ALERT_EMAIL_FROM
    && (BREVO_API_KEY || (SMTP_HOST && SMTP_USER && SMTP_PASS)));
const smtpHabilitado = () => Boolean(CLOUDINARY_ALERT_EMAIL_TO
    && CLOUDINARY_ALERT_EMAIL_FROM
    && SMTP_HOST
    && SMTP_USER
    && SMTP_PASS);
const brevoApiHabilitada = () => Boolean(BREVO_API_KEY
    && CLOUDINARY_ALERT_EMAIL_TO
    && CLOUDINARY_ALERT_EMAIL_FROM);
const getEmailTransportMode = () => {
    if (brevoApiHabilitada())
        return "brevo-api";
    if (smtpHabilitado())
        return "smtp";
    return "none";
};
const criarTransporterSmtp = () => nodemailer_1.default.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    connectionTimeout: Math.max(SMTP_TIMEOUT_MS, 1000),
    greetingTimeout: Math.max(SMTP_TIMEOUT_MS, 1000),
    socketTimeout: Math.max(SMTP_TIMEOUT_MS, 1000),
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});
const enviarEmailViaBrevoApi = async (params) => {
    if (!brevoApiHabilitada()) {
        throw new Error("Brevo API não configurada por completo.");
    }
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify({
            sender: {
                email: CLOUDINARY_ALERT_EMAIL_FROM,
            },
            to: [
                {
                    email: CLOUDINARY_ALERT_EMAIL_TO,
                },
            ],
            subject: params.subject,
            textContent: params.text,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brevo API ${response.status}: ${errorText}`);
    }
};
const enviarEmailTexto = async (params) => {
    const mode = getEmailTransportMode();
    if (mode === "none") {
        throw new Error("E-mail não configurado por completo.");
    }
    if (mode === "brevo-api") {
        await enviarEmailViaBrevoApi(params);
        return;
    }
    const transporter = criarTransporterSmtp();
    try {
        await transporter.sendMail({
            from: CLOUDINARY_ALERT_EMAIL_FROM,
            to: CLOUDINARY_ALERT_EMAIL_TO,
            subject: params.subject,
            text: params.text,
        });
    }
    finally {
        transporter.close();
    }
};
const buscarUsoCloudinary = async () => {
    var _a, _b;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error("Cloudinary não configurado para monitoramento.");
    }
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/usage`, {
        method: "GET",
        headers: {
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao consultar Cloudinary (${response.status}): ${errorText}`);
    }
    const payload = (await response.json());
    const usageBytes = Number(((_a = payload.storage) === null || _a === void 0 ? void 0 : _a.usage) || 0);
    const limitBytes = Number(((_b = payload.storage) === null || _b === void 0 ? void 0 : _b.limit) || CLOUDINARY_STORAGE_LIMIT_BYTES);
    const usagePercent = limitBytes > 0 ? (usageBytes / limitBytes) * 100 : 0;
    return {
        usageBytes,
        limitBytes,
        usagePercent,
        resources: Number(payload.resources || 0),
        plan: payload.plan || "N/A",
        lastUpdated: payload.last_updated || null,
    };
};
const enviarAlertaCloudinaryPorEmail = async (dados) => {
    const usagePercentLabel = dados.usagePercent.toFixed(2);
    const subject = `[APPEMP] Alerta de armazenamento Cloudinary (${usagePercentLabel}%)`;
    const text = [
        "Monitoramento Cloudinary - APPEMP",
        "",
        `Conta: ${CLOUDINARY_CLOUD_NAME}`,
        `Plano: ${dados.plan}`,
        `Uso atual: ${formatarBytes(dados.usageBytes)} (${usagePercentLabel}%)`,
        `Limite: ${formatarBytes(dados.limitBytes)}`,
        `Recursos: ${dados.resources}`,
        dados.lastUpdated ? `Atualizado em: ${dados.lastUpdated}` : null,
        "",
        `Limite de alerta configurado: ${CLOUDINARY_ALERT_THRESHOLD_PERCENT}%`,
        "Ação sugerida: preparar backup/arquivamento antes de atingir o limite total.",
    ]
        .filter(Boolean)
        .join("\n");
    await enviarEmailTexto({ subject, text });
};
const enviarEmailTesteSmtp = async () => {
    const mode = getEmailTransportMode();
    if (mode === "none") {
        throw new Error("E-mail não configurado por completo.");
    }
    const subject = mode === "brevo-api" ? "[APPEMP] Teste de e-mail (Brevo API)" : "[APPEMP] Teste de SMTP";
    const text = [
        mode === "brevo-api" ? "Teste de envio via Brevo API - APPEMP" : "Teste de envio SMTP - APPEMP",
        "",
        mode === "brevo-api" ? "Transporte: Brevo API" : `Host: ${SMTP_HOST}:${SMTP_PORT}`,
        mode === "brevo-api" ? null : `Usuário: ${SMTP_USER}`,
        `Data: ${new Date().toISOString()}`,
        "",
        mode === "brevo-api"
            ? "Se este e-mail chegou, a API da Brevo está funcionando."
            : "Se este e-mail chegou, o SMTP está funcionando.",
    ]
        .filter(Boolean)
        .join("\n");
    await enviarEmailTexto({ subject, text });
};
const baixarArquivoCloudinaryParaBackup = async (params) => {
    const response = await fetch(params.url, { method: "GET" });
    if (!response.ok) {
        const error = new Error(`Falha ao baixar arquivo (${response.status})`);
        error.status = response.status;
        throw error;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const ext = resolverExtensaoArquivo(params.url, response.headers.get("content-type"));
    const subdir = node_path_1.default.join(params.batchDir, params.tipo);
    await (0, promises_1.mkdir)(subdir, { recursive: true });
    const nomeBase = normalizarNomeArquivo(params.clienteNome);
    const fileName = `${String(params.pedidoId).padStart(6, "0")}-${params.tipo}-${nomeBase}${ext}`;
    const absolutePath = node_path_1.default.join(subdir, fileName);
    await (0, promises_1.writeFile)(absolutePath, bytes);
    return {
        fileName,
        absolutePath,
        bytes: bytes.length,
    };
};
const compactarLoteBackupCloudinary = async (backupRoot, batchKey) => {
    const archivePath = node_path_1.default.resolve(process.cwd(), CLOUDINARY_BACKUP_DIR, `${batchKey}.zip`);
    await new Promise((resolve, reject) => {
        (0, node_child_process_1.execFile)("zip", ["-rq", archivePath, "."], { cwd: backupRoot }, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
    const archiveStats = await (0, promises_1.stat)(archivePath);
    return {
        archivePath,
        archiveBytes: archiveStats.size,
    };
};
const montarDownloadPathBackupCloudinary = (batchKey) => `/admin/monitoramento/cloudinary/backup/${encodeURIComponent(batchKey)}/download`;
const montarDownloadUrlBackupCloudinary = (batchKey) => `${APP_BASE_URL}${montarDownloadPathBackupCloudinary(batchKey)}`;
const validarBatchKeyBackupCloudinary = (value) => {
    const batchKey = String(value || "").trim();
    if (!batchKey || !/^[0-9TZ-]+$/.test(batchKey)) {
        throw new Error("Lote de backup inválido.");
    }
    return batchKey;
};
const resolverArquivosLoteBackupCloudinary = (batchKey) => {
    const backupRoot = node_path_1.default.resolve(process.cwd(), CLOUDINARY_BACKUP_DIR, batchKey);
    const archivePath = node_path_1.default.resolve(process.cwd(), CLOUDINARY_BACKUP_DIR, `${batchKey}.zip`);
    const manifestPath = node_path_1.default.join(backupRoot, "manifest.json");
    return {
        backupRoot,
        archivePath,
        manifestPath,
    };
};
const extrairReferenciaCloudinary = (sourceUrl) => {
    const parsedUrl = new URL(sourceUrl);
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathSegments[0] !== CLOUDINARY_CLOUD_NAME) {
        throw new Error("URL não pertence à conta configurada do Cloudinary.");
    }
    const resourceType = pathSegments[1] || "image";
    const uploadIndex = pathSegments.findIndex((segment, index) => index >= 2 && segment === "upload");
    if (uploadIndex === -1) {
        throw new Error("URL do Cloudinary sem segmento upload.");
    }
    const publicIdSegments = pathSegments.slice(uploadIndex + 1);
    if (publicIdSegments[0] && /^v\d+$/.test(publicIdSegments[0])) {
        publicIdSegments.shift();
    }
    if (!publicIdSegments.length) {
        throw new Error("Não foi possível identificar o public_id do Cloudinary.");
    }
    const lastIndex = publicIdSegments.length - 1;
    publicIdSegments[lastIndex] = publicIdSegments[lastIndex].replace(/\.[^.]+$/, "");
    const publicId = publicIdSegments.join("/");
    return {
        resourceType,
        publicId,
    };
};
const excluirArquivoCloudinary = async (params) => {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error("Cloudinary não configurado para exclusão.");
    }
    const { resourceType, publicId } = extrairReferenciaCloudinary(params.sourceUrl);
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: new URLSearchParams({
            public_id: publicId,
            invalidate: "true",
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudinary destroy ${response.status}: ${errorText}`);
    }
    const payload = (await response.json());
    return {
        resourceType,
        publicId,
        result: payload.result || "unknown",
    };
};
const executarLimpezaCloudinary = async (params) => {
    let files = Array.isArray(params.files) ? params.files : [];
    let manifestPath = null;
    if (!files.length) {
        const batchKey = validarBatchKeyBackupCloudinary(params.batchKey);
        const filesDoLote = resolverArquivosLoteBackupCloudinary(batchKey);
        manifestPath = filesDoLote.manifestPath;
        const manifestRaw = await (0, promises_1.readFile)(filesDoLote.manifestPath, "utf-8");
        const manifest = JSON.parse(manifestRaw);
        files = Array.isArray(manifest.files) ? manifest.files : [];
    }
    const candidatos = files.filter((item) => (item === null || item === void 0 ? void 0 : item.sourceUrl) && !(item === null || item === void 0 ? void 0 : item.error));
    const results = [];
    for (const item of candidatos) {
        try {
            const deleted = await excluirArquivoCloudinary({
                sourceUrl: item.sourceUrl,
            });
            if (deleted.result === "ok") {
                const coluna = item.tipo === "canhoto" ? "canhoto_imagem_url" : "nf_imagem_url";
                await db_1.pool.query(`UPDATE pedidos
           SET ${coluna} = NULL
           WHERE id = $1`, [item.pedidoId]);
            }
            results.push({
                pedidoId: item.pedidoId,
                tipo: item.tipo,
                sourceUrl: item.sourceUrl,
                publicId: deleted.publicId,
                resourceType: deleted.resourceType,
                result: deleted.result,
            });
        }
        catch (error) {
            results.push({
                pedidoId: item.pedidoId,
                tipo: item.tipo,
                sourceUrl: item.sourceUrl,
                error: (error === null || error === void 0 ? void 0 : error.message) || "Falha ao excluir arquivo do Cloudinary.",
            });
        }
    }
    const deleted = results.filter((item) => !item.error && item.result === "ok");
    const notFound = results.filter((item) => !item.error && item.result === "not found");
    const failed = results.filter((item) => item.error);
    return {
        ok: true,
        batchKey: params.batchKey || null,
        manifestPath,
        filesListed: files.length,
        filesEligible: candidatos.length,
        deletedCount: deleted.length,
        notFoundCount: notFound.length,
        failedCount: failed.length,
        results,
    };
};
const executarBackupCloudinary = async (options) => {
    var _a, _b;
    const olderThanDays = Math.max(Number((_a = options === null || options === void 0 ? void 0 : options.olderThanDays) !== null && _a !== void 0 ? _a : CLOUDINARY_BACKUP_MIN_AGE_DAYS), 0);
    const limit = Math.max(Math.min(Number((_b = options === null || options === void 0 ? void 0 : options.limit) !== null && _b !== void 0 ? _b : CLOUDINARY_BACKUP_BATCH_LIMIT), 500), 1);
    const sendEmail = (options === null || options === void 0 ? void 0 : options.sendEmail) !== false;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffIso = cutoffDate.toISOString().slice(0, 10);
    const result = await db_1.pool.query(`SELECT
      p.id,
      p.data,
      c.nome AS cliente_nome,
      p.nf_imagem_url,
      p.canhoto_imagem_url
     FROM pedidos p
     INNER JOIN clientes c ON c.id = p.cliente_id
     WHERE p.status <> 'CANCELADO'
       AND p.data <= $1
       AND (p.nf_imagem_url IS NOT NULL OR p.canhoto_imagem_url IS NOT NULL)
     ORDER BY p.data ASC, p.id ASC
     LIMIT $2`, [cutoffIso, limit]);
    const rows = result.rows;
    const batchKey = new Date().toISOString().replace(/[:.]/g, "-");
    const backupRoot = node_path_1.default.resolve(process.cwd(), CLOUDINARY_BACKUP_DIR, batchKey);
    await (0, promises_1.mkdir)(backupRoot, { recursive: true });
    const arquivos = [];
    for (const row of rows) {
        const anexos = [
            { tipo: "nf", url: normalizarImagemUrl(row.nf_imagem_url) },
            { tipo: "canhoto", url: normalizarImagemUrl(row.canhoto_imagem_url) },
        ].filter((item) => Boolean(item.url));
        for (const anexo of anexos) {
            try {
                const salvo = await baixarArquivoCloudinaryParaBackup({
                    url: anexo.url,
                    tipo: anexo.tipo,
                    pedidoId: row.id,
                    clienteNome: row.cliente_nome || `pedido-${row.id}`,
                    batchDir: backupRoot,
                });
                arquivos.push({
                    pedidoId: row.id,
                    tipo: anexo.tipo,
                    sourceUrl: anexo.url,
                    fileName: salvo.fileName,
                    bytes: salvo.bytes,
                });
            }
            catch (error) {
                let bancoAtualizado = false;
                if ((error === null || error === void 0 ? void 0 : error.status) === 404) {
                    const coluna = anexo.tipo === "canhoto" ? "canhoto_imagem_url" : "nf_imagem_url";
                    await db_1.pool.query(`UPDATE pedidos
             SET ${coluna} = NULL
             WHERE id = $1`, [row.id]);
                    bancoAtualizado = true;
                }
                arquivos.push({
                    pedidoId: row.id,
                    tipo: anexo.tipo,
                    sourceUrl: anexo.url,
                    error: (error === null || error === void 0 ? void 0 : error.message) || "Falha ao baixar arquivo.",
                    bancoAtualizado,
                });
            }
        }
    }
    const sucesso = arquivos.filter((item) => !item.error);
    const falhas = arquivos.filter((item) => item.error);
    const brokenUrlsCleaned = falhas.filter((item) => item.bancoAtualizado).length;
    const totalBytes = sucesso.reduce((acc, item) => acc + Number(item.bytes || 0), 0);
    const manifest = {
        createdAt: new Date().toISOString(),
        backupRoot,
        olderThanDays,
        cutoffDate: cutoffIso,
        limit,
        rowsScanned: rows.length,
        filesBackedUp: sucesso.length,
        filesFailed: falhas.length,
        brokenUrlsCleaned,
        totalBytes,
        files: arquivos,
    };
    await (0, promises_1.writeFile)(node_path_1.default.join(backupRoot, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
    const { archivePath, archiveBytes } = await compactarLoteBackupCloudinary(backupRoot, batchKey);
    const downloadPath = montarDownloadPathBackupCloudinary(batchKey);
    const downloadUrl = montarDownloadUrlBackupCloudinary(batchKey);
    let emailSent = false;
    if (sendEmail && getEmailTransportMode() !== "none") {
        const subject = `[APPEMP] Backup Cloudinary gerado (${sucesso.length} arquivo(s))`;
        const text = [
            "Backup Cloudinary - APPEMP",
            "",
            `Pasta: ${backupRoot}`,
            `Arquivo compactado: ${archivePath}`,
            `Download pela API: ${downloadUrl}`,
            `Critério: pedidos com data até ${cutoffIso} (${olderThanDays} dia(s) ou mais)`,
            `Pedidos analisados: ${rows.length}`,
            `Arquivos salvos: ${sucesso.length}`,
            `Falhas: ${falhas.length}`,
            `URLs quebradas removidas do banco: ${brokenUrlsCleaned}`,
            `Tamanho total: ${formatarBytes(totalBytes)}`,
            `Tamanho do .zip: ${formatarBytes(archiveBytes)}`,
        ]
            .filter(Boolean)
            .join("\n");
        await enviarEmailTexto({ subject, text });
        emailSent = true;
    }
    return {
        ok: true,
        backupRoot,
        batchKey,
        archivePath,
        archiveBytes,
        archiveBytesFormatted: formatarBytes(archiveBytes),
        downloadPath,
        downloadUrl,
        olderThanDays,
        cutoffDate: cutoffIso,
        rowsScanned: rows.length,
        filesBackedUp: sucesso.length,
        filesFailed: falhas.length,
        brokenUrlsCleaned,
        totalBytes,
        totalBytesFormatted: formatarBytes(totalBytes),
        emailSent,
        files: arquivos,
    };
};
const verificarUsoCloudinary = async (options) => {
    const manual = (options === null || options === void 0 ? void 0 : options.manual) === true;
    const forceEmail = (options === null || options === void 0 ? void 0 : options.forceEmail) === true;
    if (!cloudinaryMonitoramentoHabilitado()) {
        return {
            ok: false,
            enabled: false,
            reason: "Monitoramento do Cloudinary não configurado por completo.",
        };
    }
    try {
        const dados = await buscarUsoCloudinary();
        const acimaDoLimite = dados.usagePercent >= CLOUDINARY_ALERT_THRESHOLD_PERCENT;
        const cooldownMs = Math.max(CLOUDINARY_ALERT_COOLDOWN_MINUTES, 1) * 60 * 1000;
        const emCooldown = Date.now() - cloudinaryLastAlertAt < cooldownMs;
        const deveEnviarEmail = forceEmail || (acimaDoLimite && !emCooldown);
        if (deveEnviarEmail) {
            await enviarAlertaCloudinaryPorEmail(dados);
            cloudinaryLastAlertAt = Date.now();
        }
        if (manual || acimaDoLimite) {
            console.log(`[Cloudinary] uso ${dados.usagePercent.toFixed(2)}% (${formatarBytes(dados.usageBytes)} de ${formatarBytes(dados.limitBytes)})`);
        }
        return {
            ok: true,
            enabled: true,
            alertSent: deveEnviarEmail,
            aboveThreshold: acimaDoLimite,
            cooldownActive: emCooldown && !forceEmail,
            ...dados,
        };
    }
    catch (error) {
        console.error("Erro no monitoramento do Cloudinary:", error);
        return {
            ok: false,
            enabled: true,
            reason: (error === null || error === void 0 ? void 0 : error.message) || "Erro ao verificar uso do Cloudinary.",
        };
    }
};
const iniciarMonitoramentoCloudinary = () => {
    if (!cloudinaryMonitoramentoHabilitado()) {
        console.log("[Cloudinary] Monitoramento desabilitado: faltam variáveis de ambiente.");
        return;
    }
    const intervaloMs = Math.max(CLOUDINARY_MONITOR_INTERVAL_MINUTES, 5) * 60 * 1000;
    if (cloudinaryMonitorTimer) {
        clearInterval(cloudinaryMonitorTimer);
    }
    setTimeout(() => {
        void verificarUsoCloudinary();
    }, 10000);
    cloudinaryMonitorTimer = setInterval(() => {
        void verificarUsoCloudinary();
    }, intervaloMs);
    console.log(`[Cloudinary] Monitoramento ativo a cada ${Math.max(CLOUDINARY_MONITOR_INTERVAL_MINUTES, 5)} minuto(s).`);
};
const gerarToken = (user) => {
    var _a;
    return jsonwebtoken_1.default.sign({
        sub: String(user === null || user === void 0 ? void 0 : user.id),
        id: user === null || user === void 0 ? void 0 : user.id,
        nome: user === null || user === void 0 ? void 0 : user.nome,
        username: user === null || user === void 0 ? void 0 : user.username,
        perfil: user === null || user === void 0 ? void 0 : user.perfil,
        imagem_url: (_a = user === null || user === void 0 ? void 0 : user.imagem_url) !== null && _a !== void 0 ? _a : null,
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};
const autenticarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token não informado" });
    }
    const token = authHeader.slice("Bearer ".length);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
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
    }
    catch {
        return res.status(401).json({ error: "Token inválido ou expirado" });
    }
};
const requireRoles = (...roles) => (req, res, next) => {
    if (!req.user)
        return res.status(401).json({ error: "Não autenticado" });
    if (!roles.includes(req.user.perfil)) {
        return res.status(403).json({ error: "Sem permissão para esta operação" });
    }
    next();
};
const canManageCadastros = requireRoles("admin", "backoffice");
const canManageUsuarios = requireRoles("admin");
const ensureDefaultAdminUser = async () => {
    const perfilPadrao = normalizarPerfil(AUTH_PERFIL) || "admin";
    const senhaHash = await bcryptjs_1.default.hash(AUTH_PASSWORD, 10);
    await db_1.pool.query(`INSERT INTO usuarios (nome, login, senha_hash, perfil, ativo)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (login) DO UPDATE
     SET nome = EXCLUDED.nome,
         senha_hash = EXCLUDED.senha_hash,
         perfil = EXCLUDED.perfil,
         ativo = true`, [AUTH_NAME, AUTH_USER, senhaHash, perfilPadrao]);
};
const ensureImageColumns = async () => {
    await db_1.pool.query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS imagem_url TEXT");
    await db_1.pool.query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS link TEXT");
    await db_1.pool.query("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT");
    await db_1.pool.query("ALTER TABLE rotas ADD COLUMN IF NOT EXISTS imagem_url TEXT");
    await db_1.pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS imagem_url TEXT");
    await db_1.pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ordem_remaneio INTEGER");
    await db_1.pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usa_nf BOOLEAN NOT NULL DEFAULT false");
    await db_1.pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_imagem_url TEXT");
    await db_1.pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS canhoto_imagem_url TEXT");
    await db_1.pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_numero TEXT");
    await db_1.pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_status TEXT NOT NULL DEFAULT 'PENDENTE'");
    await db_1.pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_efetivado_por INTEGER");
    await db_1.pool.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_efetivado_por_nome TEXT");
    await db_1.pool.query("UPDATE pedidos SET nf_status = 'PENDENTE' WHERE nf_status IS NULL");
    await db_1.pool.query(`CREATE TABLE IF NOT EXISTS notificacao_dispositivos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expo_push_token TEXT NOT NULL UNIQUE,
      plataforma VARCHAR(30) NOT NULL DEFAULT 'unknown',
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_notificacao_dispositivos_usuario
     ON notificacao_dispositivos (usuario_id)`);
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
        const result = await db_1.pool.query(`SELECT nome, imagem_url
       FROM usuarios
       WHERE login = $1 AND ativo = true
       LIMIT 1`, [username]);
        if (result.rows.length === 0) {
            return res.json({ nome: null, imagem_url: null });
        }
        const row = result.rows[0];
        return res.json({
            nome: String(row.nome),
            imagem_url: row.imagem_url ? String(row.imagem_url) : null,
        });
    }
    catch (error) {
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
        const result = await db_1.pool.query(`SELECT id, nome, login, senha_hash, perfil, ativo, imagem_url
       FROM usuarios
       WHERE login = $1`, [String(username)]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Credenciais inválidas" });
        }
        const usuario = result.rows[0];
        if (!usuario.ativo) {
            return res.status(403).json({ error: "Usuário inativo" });
        }
        const senhaValida = await bcryptjs_1.default.compare(String(password), usuario.senha_hash);
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
    }
    catch (error) {
        console.error("Erro no login:", error);
        return res.status(500).json({ error: "Erro ao autenticar" });
    }
});
app.get("/auth/me", autenticarToken, async (req, res) => {
    var _a;
    try {
        const result = await db_1.pool.query(`SELECT id, nome, login, perfil, imagem_url
       FROM usuarios
       WHERE id = $1`, [(_a = req.user) === null || _a === void 0 ? void 0 : _a.id]);
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
    }
    catch (error) {
        console.error("Erro ao buscar usuário autenticado:", error);
        return res.status(500).json({ error: "Erro ao buscar usuário autenticado" });
    }
});
app.post("/auth/change-password", autenticarToken, async (req, res) => {
    var _a, _b;
    const { senha_atual, nova_senha } = req.body;
    if (!senha_atual || !nova_senha) {
        return res.status(400).json({ error: "senha_atual e nova_senha são obrigatórias" });
    }
    if (String(nova_senha).length < 6) {
        return res.status(400).json({ error: "nova_senha deve ter ao menos 6 caracteres" });
    }
    try {
        const result = await db_1.pool.query("SELECT id, senha_hash FROM usuarios WHERE id = $1", [(_a = req.user) === null || _a === void 0 ? void 0 : _a.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        const usuario = result.rows[0];
        const senhaValida = await bcryptjs_1.default.compare(String(senha_atual), usuario.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ error: "Senha atual inválida" });
        }
        const novaHash = await bcryptjs_1.default.hash(String(nova_senha), 10);
        await db_1.pool.query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2", [novaHash, (_b = req.user) === null || _b === void 0 ? void 0 : _b.id]);
        return res.json({ message: "Senha atualizada com sucesso" });
    }
    catch (error) {
        console.error("Erro ao trocar senha:", error);
        return res.status(500).json({ error: "Erro ao trocar senha" });
    }
});
app.post("/notificacoes/dispositivos", autenticarToken, async (req, res) => {
    var _a, _b, _c, _d, _e;
    const expoPushToken = normalizarExpoPushToken((_a = req.body) === null || _a === void 0 ? void 0 : _a.expo_push_token);
    const plataforma = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.plataforma) || "unknown").trim().slice(0, 30) || "unknown";
    if (!expoPushToken) {
        return res.status(400).json({ error: "expo_push_token inválido." });
    }
    try {
        if (((_c = req.user) === null || _c === void 0 ? void 0 : _c.perfil) === "motorista") {
            await db_1.pool.query(`UPDATE notificacao_dispositivos
         SET ativo = false,
             atualizado_em = NOW()
         WHERE expo_push_token = $1 OR usuario_id = $2`, [expoPushToken, (_d = req.user) === null || _d === void 0 ? void 0 : _d.id]);
            return res.json({ ok: true });
        }
        await db_1.pool.query(`INSERT INTO notificacao_dispositivos (usuario_id, expo_push_token, plataforma, ativo, atualizado_em)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (expo_push_token) DO UPDATE
       SET usuario_id = EXCLUDED.usuario_id,
           plataforma = EXCLUDED.plataforma,
           ativo = true,
           atualizado_em = NOW()`, [(_e = req.user) === null || _e === void 0 ? void 0 : _e.id, expoPushToken, plataforma]);
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("Erro ao registrar dispositivo de notificação:", error);
        return res.status(500).json({ error: "Erro ao registrar dispositivo de notificação." });
    }
});
app.delete("/notificacoes/dispositivos", autenticarToken, async (req, res) => {
    var _a;
    const expoPushToken = normalizarExpoPushToken((_a = req.body) === null || _a === void 0 ? void 0 : _a.expo_push_token);
    if (!expoPushToken) {
        return res.status(400).json({ error: "expo_push_token inválido." });
    }
    try {
        await db_1.pool.query(`UPDATE notificacao_dispositivos
       SET ativo = false,
           atualizado_em = NOW()
       WHERE expo_push_token = $1`, [expoPushToken]);
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("Erro ao desativar dispositivo de notificação:", error);
        return res.status(500).json({ error: "Erro ao desativar dispositivo de notificação." });
    }
});
app.get(["/compartilhar/pedido/:id/nf", "/nf/:id", "/n/:id"], async (req, res) => {
    try {
        const pedidoId = parseInt(String(req.params.id), 10);
        const result = await db_1.pool.query(`SELECT nf_imagem_url
       FROM pedidos
       WHERE id = $1`, [pedidoId]);
        if (result.rows.length === 0) {
            return res.status(404).send("Pedido não encontrado.");
        }
        const url = normalizarImagemUrl(result.rows[0].nf_imagem_url);
        if (!url) {
            return res.status(404).send("NF não encontrada.");
        }
        return res.redirect(url);
    }
    catch (error) {
        console.error("Erro ao compartilhar NF:", error);
        return res.status(500).send("Erro ao abrir NF.");
    }
});
app.get(["/compartilhar/pedido/:id/canhoto", "/canhoto/:id", "/c/:id"], async (req, res) => {
    try {
        const pedidoId = parseInt(String(req.params.id), 10);
        const result = await db_1.pool.query(`SELECT canhoto_imagem_url
       FROM pedidos
       WHERE id = $1`, [pedidoId]);
        if (result.rows.length === 0) {
            return res.status(404).send("Pedido não encontrado.");
        }
        const url = normalizarImagemUrl(result.rows[0].canhoto_imagem_url);
        if (!url) {
            return res.status(404).send("Canhoto não encontrado.");
        }
        return res.redirect(url);
    }
    catch (error) {
        console.error("Erro ao compartilhar canhoto:", error);
        return res.status(500).send("Erro ao abrir canhoto.");
    }
});
app.get(["/compartilhar/pedido/:id", "/pedido/:id"], async (req, res) => {
    try {
        const pedidoId = parseInt(String(req.params.id), 10);
        const result = await db_1.pool.query(`SELECT
        p.id,
        p.data,
        p.status,
        p.nf_numero,
        p.nf_imagem_url,
        p.canhoto_imagem_url,
        c.nome AS cliente_nome
      FROM pedidos p
      INNER JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = $1`, [pedidoId]);
        if (result.rows.length === 0) {
            return res.status(404).send("Pedido não encontrado.");
        }
        const pedido = result.rows[0];
        const nfLink = normalizarImagemUrl(pedido.nf_imagem_url)
            ? `/n/${pedidoId}`
            : null;
        const canhotoLink = normalizarImagemUrl(pedido.canhoto_imagem_url)
            ? `/c/${pedidoId}`
            : null;
        const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pedido #${escapeHtml(pedido.id)} - APPEMP</title>
    <style>
      body { font-family: Arial, sans-serif; background: #eef4ff; color: #0f172a; margin: 0; padding: 24px; }
      .card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 6px 0; }
      .links { margin-top: 18px; display: grid; gap: 10px; }
      a { display: inline-block; text-decoration: none; background: #2563eb; color: #fff; padding: 10px 14px; border-radius: 10px; font-weight: 700; }
      .secondary { background: #16a34a; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>APPEMP • Pedido #${escapeHtml(pedido.id)}</h1>
      <p><strong>Cliente:</strong> ${escapeHtml(pedido.cliente_nome)}</p>
      <p><strong>Data:</strong> ${escapeHtml(pedido.data)}</p>
      <p><strong>Status:</strong> ${escapeHtml(pedido.status)}</p>
      ${pedido.nf_numero ? `<p><strong>NF:</strong> ${escapeHtml(pedido.nf_numero)}</p>` : ""}
      <div class="links">
        ${nfLink ? `<a href="${nfLink}">Abrir nota fiscal</a>` : ""}
        ${canhotoLink ? `<a class="secondary" href="${canhotoLink}">Abrir canhoto</a>` : ""}
      </div>
    </div>
  </body>
</html>`;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
    }
    catch (error) {
        console.error("Erro ao compartilhar pedido:", error);
        return res.status(500).send("Erro ao abrir pedido.");
    }
});
app.use(autenticarToken);
app.post("/admin/monitoramento/cloudinary/verificar", async (req, res) => {
    var _a, _b, _c;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.perfil) !== "admin" && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.perfil) !== "backoffice") {
        return res.status(403).json({ error: "Sem permissão para verificar o monitoramento." });
    }
    const resultado = await verificarUsoCloudinary({
        manual: true,
        forceEmail: normalizarBoolean((_c = req.body) === null || _c === void 0 ? void 0 : _c.force_email),
    });
    if (!resultado.ok) {
        return res.status(400).json(resultado);
    }
    return res.json(resultado);
});
app.post("/admin/monitoramento/cloudinary/backup", async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.perfil) !== "admin" && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.perfil) !== "backoffice") {
        return res.status(403).json({ error: "Sem permissão para executar o backup." });
    }
    try {
        const resultado = await executarBackupCloudinary({
            olderThanDays: Number((_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.older_than_days) !== null && _d !== void 0 ? _d : CLOUDINARY_BACKUP_MIN_AGE_DAYS),
            limit: Number((_f = (_e = req.body) === null || _e === void 0 ? void 0 : _e.limit) !== null && _f !== void 0 ? _f : CLOUDINARY_BACKUP_BATCH_LIMIT),
            sendEmail: ((_g = req.body) === null || _g === void 0 ? void 0 : _g.send_email) === undefined ? true : normalizarBoolean((_h = req.body) === null || _h === void 0 ? void 0 : _h.send_email),
        });
        return res.json(resultado);
    }
    catch (error) {
        return res.status(400).json({
            ok: false,
            reason: (error === null || error === void 0 ? void 0 : error.message) || "Falha ao executar o backup do Cloudinary.",
        });
    }
});
app.get("/admin/monitoramento/cloudinary/backup/:batchKey/download", async (req, res) => {
    var _a, _b;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.perfil) !== "admin" && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.perfil) !== "backoffice") {
        return res.status(403).json({ error: "Sem permissão para baixar o backup." });
    }
    try {
        const batchKey = validarBatchKeyBackupCloudinary(req.params.batchKey);
        const { archivePath } = resolverArquivosLoteBackupCloudinary(batchKey);
        const archiveStats = await (0, promises_1.stat)(archivePath);
        if (!archiveStats.isFile()) {
            return res.status(404).json({ error: "Arquivo de backup não encontrado." });
        }
        return res.download(archivePath, `${batchKey}.zip`);
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "ENOENT") {
            return res.status(404).json({ error: "Arquivo de backup não encontrado." });
        }
        return res.status(400).json({
            error: (error === null || error === void 0 ? void 0 : error.message) || "Falha ao baixar o arquivo de backup.",
        });
    }
});
app.post("/admin/monitoramento/cloudinary/limpar", async (req, res) => {
    var _a, _b, _c, _d;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.perfil) !== "admin" && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.perfil) !== "backoffice") {
        return res.status(403).json({ error: "Sem permissão para limpar arquivos do Cloudinary." });
    }
    try {
        const files = Array.isArray((_c = req.body) === null || _c === void 0 ? void 0 : _c.files)
            ? req.body.files
                .map((item) => ({
                pedidoId: Number((item === null || item === void 0 ? void 0 : item.pedidoId) || (item === null || item === void 0 ? void 0 : item.pedido_id) || 0),
                tipo: String((item === null || item === void 0 ? void 0 : item.tipo) || "").trim() === "canhoto" ? "canhoto" : "nf",
                sourceUrl: String((item === null || item === void 0 ? void 0 : item.sourceUrl) || (item === null || item === void 0 ? void 0 : item.source_url) || "").trim(),
                error: (item === null || item === void 0 ? void 0 : item.error) ? String(item.error) : undefined,
            }))
                .filter((item) => item.sourceUrl)
            : [];
        const resultado = await executarLimpezaCloudinary({
            batchKey: ((_d = req.body) === null || _d === void 0 ? void 0 : _d.batch_key) ? String(req.body.batch_key) : undefined,
            files,
        });
        return res.json(resultado);
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "ENOENT") {
            return res.status(404).json({
                ok: false,
                reason: "Manifesto do lote de backup não encontrado.",
            });
        }
        return res.status(400).json({
            ok: false,
            reason: (error === null || error === void 0 ? void 0 : error.message) || "Falha ao limpar arquivos do Cloudinary.",
        });
    }
});
app.post("/admin/monitoramento/email/testar", async (req, res) => {
    var _a, _b;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.perfil) !== "admin" && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.perfil) !== "backoffice") {
        return res.status(403).json({ error: "Sem permissão para testar o SMTP." });
    }
    try {
        await enviarEmailTesteSmtp();
        return res.json({
            ok: true,
            mode: getEmailTransportMode(),
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            to: CLOUDINARY_ALERT_EMAIL_TO,
            from: CLOUDINARY_ALERT_EMAIL_FROM,
            message: "E-mail de teste enviado com sucesso.",
        });
    }
    catch (error) {
        return res.status(400).json({
            ok: false,
            mode: getEmailTransportMode(),
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            reason: (error === null || error === void 0 ? void 0 : error.message) || "Falha ao enviar e-mail de teste.",
        });
    }
});
// --------- USUARIOS ----------
app.get("/usuarios", canManageUsuarios, async (req, res) => {
    try {
        const { q, perfil, ativo, page = "1", limit = "10", sort_by = "id", sort_dir = "desc", } = req.query;
        const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 100);
        const offset = (pageNum - 1) * limitNum;
        let whereClause = "WHERE 1=1";
        const params = [];
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
        const totalResult = await db_1.pool.query(`SELECT COUNT(*)::int as total
       FROM usuarios
       ${whereClause}`, params);
        const total = totalResult.rows[0].total;
        const sortColumnMap = {
            id: "id",
            nome: "nome",
            login: "login",
            perfil: "perfil",
            ativo: "ativo",
            criado_em: "criado_em",
        };
        const orderBy = sortColumnMap[String(sort_by)] || "id";
        const orderDir = String(sort_dir).toLowerCase() === "asc" ? "ASC" : "DESC";
        const result = await db_1.pool.query(`SELECT id, nome, login, perfil, rota_id, ativo, imagem_url, criado_em
       FROM usuarios
       ${whereClause}
       ORDER BY ${orderBy} ${orderDir}, id DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, [...params, limitNum, offset]);
        res.json({
            data: result.rows,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.max(Math.ceil(total / limitNum), 1),
        });
    }
    catch (error) {
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
        const senhaHash = await bcryptjs_1.default.hash(String(senha), 10);
        const result = await db_1.pool.query(`INSERT INTO usuarios (nome, login, senha_hash, perfil, rota_id, ativo, imagem_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nome, login, perfil, rota_id, ativo, imagem_url, criado_em`, [nome, login, senhaHash, perfilNormalizado, rota_id || null, ativo !== null && ativo !== void 0 ? ativo : true, normalizarImagemUrl(imagem_url)]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
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
    const fields = [];
    const params = [];
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
        const senhaHash = await bcryptjs_1.default.hash(String(senha), 10);
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
        const result = await db_1.pool.query(`UPDATE usuarios
       SET ${fields.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, nome, login, perfil, rota_id, ativo, imagem_url, criado_em`, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
});
app.delete("/usuarios/:id", canManageUsuarios, async (req, res) => {
    var _a;
    const { id } = req.params;
    const idAlvo = Number(String(id));
    if (!Number.isFinite(idAlvo) || idAlvo <= 0) {
        return res.status(400).json({ error: "ID de usuário inválido" });
    }
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) === idAlvo) {
        return res.status(409).json({ error: "Você não pode excluir seu próprio usuário." });
    }
    try {
        const result = await db_1.pool.query("DELETE FROM usuarios WHERE id = $1 RETURNING id", [idAlvo]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        return res.status(204).send();
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "23503") {
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
        const result = await db_1.pool.query("SELECT id, codigo_cliente, nome, rota_id, ativo, imagem_url, link FROM clientes ORDER BY nome ASC");
        res.json(result.rows);
    }
    catch (error) {
        // Compatibilidade temporária para bases sem a coluna "ativo"
        if ((error === null || error === void 0 ? void 0 : error.code) === "42703") {
            try {
                const fallback = await db_1.pool.query("SELECT id, codigo_cliente, nome, rota_id, imagem_url, link FROM clientes ORDER BY nome ASC");
                const data = fallback.rows.map((row) => ({ ...row, ativo: true }));
                return res.json(data);
            }
            catch (fallbackError) {
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
        const result = await db_1.pool.query("INSERT INTO clientes (codigo_cliente, nome, rota_id, ativo, imagem_url, link) VALUES ($1, $2, $3, true, $4, $5) RETURNING id, codigo_cliente, nome, rota_id, ativo, imagem_url, link", [codigo_cliente, nome, rota_id !== null && rota_id !== void 0 ? rota_id : null, normalizarImagemUrl(imagem_url), link ? String(link).trim() : null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        // Compatibilidade temporária para bases sem a coluna "ativo"
        if ((error === null || error === void 0 ? void 0 : error.code) === "42703") {
            try {
                const fallback = await db_1.pool.query("INSERT INTO clientes (codigo_cliente, nome, rota_id, imagem_url, link) VALUES ($1, $2, $3, $4, $5) RETURNING id, codigo_cliente, nome, rota_id, imagem_url, link", [codigo_cliente, nome, rota_id !== null && rota_id !== void 0 ? rota_id : null, normalizarImagemUrl(imagem_url), link ? String(link).trim() : null]);
                return res.status(201).json({ ...fallback.rows[0], ativo: true });
            }
            catch (fallbackError) {
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
    const fields = [];
    const params = [];
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
        const result = await db_1.pool.query(`UPDATE clientes
       SET ${fields.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, codigo_cliente, nome, rota_id, ativo, imagem_url, link`, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        // Compatibilidade temporária para bases sem a coluna "ativo"
        if ((error === null || error === void 0 ? void 0 : error.code) === "42703") {
            if (ativo !== undefined) {
                return res.status(400).json({
                    error: "Bloqueio de cliente indisponível: aplique a migração migration-clientes-ativo.sql",
                });
            }
            try {
                const fallback = await db_1.pool.query(`UPDATE clientes
           SET ${fields.join(", ")}
           WHERE id = $${params.length}
           RETURNING id, codigo_cliente, nome, rota_id, imagem_url, link`, params);
                if (fallback.rows.length === 0) {
                    return res.status(404).json({ error: "Cliente não encontrado" });
                }
                return res.json({ ...fallback.rows[0], ativo: true });
            }
            catch (fallbackError) {
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
        const result = await db_1.pool.query("DELETE FROM clientes WHERE id = $1 RETURNING id", [Number(String(id))]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }
        return res.status(204).send();
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "23503") {
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
        const result = await db_1.pool.query(`SELECT
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
      ORDER BY p.nome ASC`, [clienteId]);
        return res.json(result.rows);
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "42P01") {
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
        const params = [];
        let whereClause = "";
        if (clienteId) {
            whereClause = "WHERE cp.cliente_id = $1";
            params.push(clienteId);
        }
        const result = await db_1.pool.query(`SELECT
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
      ORDER BY c.nome ASC, p.nome ASC`, params);
        return res.json(result.rows);
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "42P01") {
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
        const result = await db_1.pool.query(`INSERT INTO cliente_produtos (cliente_id, produto_id, valor_unitario)
       VALUES ($1, $2, $3)
       RETURNING id, cliente_id, produto_id, valor_unitario`, [clienteId, produtoId, valorUnitario]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "23505") {
            return res.status(409).json({ error: "Este produto já está vinculado a este cliente" });
        }
        if ((error === null || error === void 0 ? void 0 : error.code) === "23503") {
            return res.status(400).json({ error: "Cliente ou produto não encontrado" });
        }
        if ((error === null || error === void 0 ? void 0 : error.code) === "42P01") {
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
        const result = await db_1.pool.query(`UPDATE cliente_produtos
       SET valor_unitario = $1
       WHERE id = $2
       RETURNING id, cliente_id, produto_id, valor_unitario`, [valorUnitario, relacaoId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Relação não encontrada" });
        }
        return res.json(result.rows[0]);
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "42P01") {
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
        const result = await db_1.pool.query("DELETE FROM cliente_produtos WHERE id = $1 RETURNING id", [relacaoId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Relação não encontrada" });
        }
        return res.status(204).send();
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "42P01") {
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
        const result = await db_1.pool.query(`SELECT
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
      ORDER BY r.nome ASC`);
        res.json(result.rows);
    }
    catch (error) {
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
        const result = await db_1.pool.query("INSERT INTO rotas (nome, imagem_url) VALUES ($1, $2) RETURNING id, nome, imagem_url", [nome, normalizarImagemUrl(imagem_url)]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
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
        const result = await db_1.pool.query("UPDATE rotas SET nome = $1, imagem_url = $2 WHERE id = $3 RETURNING id, nome, imagem_url", [String(nome).trim(), normalizarImagemUrl(imagem_url), Number(String(id))]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Rota não encontrada" });
        }
        return res.json(result.rows[0]);
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "23505") {
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
        const result = await db_1.pool.query("DELETE FROM rotas WHERE id = $1 RETURNING id", [Number(String(id))]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Rota não encontrada" });
        }
        return res.status(204).send();
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "23503") {
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
        const result = await db_1.pool.query("SELECT id, codigo_produto, nome, embalagem, preco_base, ativo, imagem_url FROM produtos ORDER BY nome ASC");
        res.json(result.rows);
    }
    catch (error) {
        // Compatibilidade temporária para bases sem a coluna "ativo"
        if ((error === null || error === void 0 ? void 0 : error.code) === "42703") {
            try {
                const fallback = await db_1.pool.query("SELECT id, codigo_produto, nome, embalagem, preco_base, imagem_url FROM produtos ORDER BY nome ASC");
                return res.json(fallback.rows.map((row) => ({ ...row, ativo: true })));
            }
            catch (fallbackError) {
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
        const result = await db_1.pool.query("INSERT INTO produtos (codigo_produto, nome, embalagem, preco_base, ativo, imagem_url) VALUES ($1, $2, $3, $4, true, $5) RETURNING id, codigo_produto, nome, embalagem, preco_base, ativo, imagem_url", [codigoGerado, nome, embalagem !== null && embalagem !== void 0 ? embalagem : null, preco_base !== null && preco_base !== void 0 ? preco_base : null, normalizarImagemUrl(imagem_url)]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        // Compatibilidade temporária para bases sem a coluna "ativo"
        if ((error === null || error === void 0 ? void 0 : error.code) === "42703") {
            try {
                const codigoGerado = codigo_produto && String(codigo_produto).trim()
                    ? String(codigo_produto).trim()
                    : `PR${Date.now().toString().slice(-8)}`;
                const fallback = await db_1.pool.query("INSERT INTO produtos (codigo_produto, nome, embalagem, preco_base, imagem_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, codigo_produto, nome, embalagem, preco_base, imagem_url", [codigoGerado, nome, embalagem !== null && embalagem !== void 0 ? embalagem : null, preco_base !== null && preco_base !== void 0 ? preco_base : null, normalizarImagemUrl(imagem_url)]);
                return res.status(201).json({ ...fallback.rows[0], ativo: true });
            }
            catch (fallbackError) {
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
    const fields = [];
    const params = [];
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
        const result = await db_1.pool.query(`UPDATE produtos
       SET ${fields.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, codigo_produto, nome, embalagem, preco_base, ativo, imagem_url`, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        // Compatibilidade temporária para bases sem a coluna "ativo"
        if ((error === null || error === void 0 ? void 0 : error.code) === "42703") {
            if (ativo !== undefined) {
                return res.status(400).json({
                    error: "Bloqueio de produto indisponível: aplique a migração migration-produtos-ativo.sql",
                });
            }
            try {
                const fallback = await db_1.pool.query(`UPDATE produtos
           SET ${fields.join(", ")}
           WHERE id = $${params.length}
           RETURNING id, codigo_produto, nome, embalagem, preco_base, imagem_url`, params);
                if (fallback.rows.length === 0) {
                    return res.status(404).json({ error: "Produto não encontrado" });
                }
                return res.json({ ...fallback.rows[0], ativo: true });
            }
            catch (fallbackError) {
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
        const result = await db_1.pool.query("DELETE FROM produtos WHERE id = $1 RETURNING id", [Number(String(id))]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }
        return res.status(204).send();
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "23503") {
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
        p.usa_nf,
        p.nf_imagem_url,
        p.canhoto_imagem_url,
        p.nf_numero,
        p.nf_status,
        p.nf_efetivado_por_nome,
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
        c.link as cliente_link,
        r.id as rota_id,
        r.nome as rota_nome
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rotas r ON p.rota_id = r.id
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;
        if (data) {
            query += ` AND p.data = $${paramIndex}`;
            params.push(data);
            paramIndex++;
        }
        if (rota_id) {
            query += ` AND p.rota_id = $${paramIndex}`;
            params.push(parseInt(rota_id));
            paramIndex++;
        }
        if (cliente_id) {
            query += ` AND p.cliente_id = $${paramIndex}`;
            params.push(parseInt(cliente_id));
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
        const result = await db_1.pool.query(query, params);
        const pedidos = result.rows;
        // Buscar itens de cada pedido
        for (const pedido of pedidos) {
            const itensResult = await db_1.pool.query(`SELECT 
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
        ORDER BY ip.id`, [pedido.id]);
            pedido.itens = itensResult.rows;
        }
        res.json(pedidos);
    }
    catch (error) {
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
        const pedidoResult = await db_1.pool.query(`SELECT
        p.id,
        p.chave_pedido,
        p.data,
        p.status,
        p.ordem_remaneio,
        p.usa_nf,
        p.nf_imagem_url,
        p.canhoto_imagem_url,
        p.nf_numero,
        p.nf_status,
        p.nf_efetivado_por_nome,
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
        c.link as cliente_link,
        r.id as rota_id,
        r.nome as rota_nome
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rotas r ON p.rota_id = r.id
      WHERE p.id = $1`, [parseInt(String(id), 10)]);
        if (pedidoResult.rows.length === 0) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }
        const pedido = pedidoResult.rows[0];
        const itensResult = await db_1.pool.query(`SELECT
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
      ORDER BY ip.id`, [pedido.id]);
        pedido.itens = itensResult.rows;
        res.json(pedido);
    }
    catch (error) {
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
        const params = [];
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
        const totalResult = await db_1.pool.query(`SELECT COUNT(*)::int as total
       FROM pedidos p
       INNER JOIN clientes c ON p.cliente_id = c.id
       LEFT JOIN rotas r ON p.rota_id = r.id
       ${whereClause}`, params);
        const total = totalResult.rows[0].total;
        const dataResult = await db_1.pool.query(`SELECT
        p.id,
        p.chave_pedido,
        p.data,
        p.status,
        p.ordem_remaneio,
        p.usa_nf,
        p.nf_imagem_url,
        p.canhoto_imagem_url,
        p.nf_numero,
        p.nf_status,
        p.nf_efetivado_por_nome,
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
        c.link as cliente_link,
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
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, [...params, limitNum, offset]);
        const pedidos = dataResult.rows;
        for (const pedido of pedidos) {
            const itensResult = await db_1.pool.query(`SELECT
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
        ORDER BY ip.id`, [pedido.id]);
            pedido.itens = itensResult.rows;
        }
        res.json({
            data: pedidos,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.max(Math.ceil(total / limitNum), 1),
        });
    }
    catch (error) {
        console.error("Erro ao buscar pedidos paginados:", error);
        res.status(500).json({ error: "Erro ao buscar pedidos paginados" });
    }
});
app.patch("/pedidos/remaneio/ordem", autenticarToken, requireRoles("admin", "backoffice", "motorista"), async (req, res) => {
    var _a, _b;
    const pedidoIdsRaw = Array.isArray((_a = req.body) === null || _a === void 0 ? void 0 : _a.pedido_ids) ? req.body.pedido_ids : null;
    if (!pedidoIdsRaw || pedidoIdsRaw.length === 0) {
        return res.status(400).json({ error: "pedido_ids é obrigatório e deve ter ao menos 1 item." });
    }
    const pedidoIds = [
        ...new Set(pedidoIdsRaw
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)),
    ];
    if (pedidoIds.length === 0) {
        return res.status(400).json({ error: "pedido_ids inválido." });
    }
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const conferindoResult = await client.query(`SELECT id
         FROM pedidos
         WHERE status = 'CONFERIR'
         ORDER BY ordem_remaneio ASC NULLS LAST, data DESC, id DESC`);
        const idsConferindo = conferindoResult.rows.map((row) => Number(row.id));
        const idsConferindoSet = new Set(idsConferindo);
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
        await client.query(`WITH nova_ordem AS (
           SELECT * FROM UNNEST($1::int[]) WITH ORDINALITY AS t(id, posicao)
         )
         UPDATE pedidos p
         SET ordem_remaneio = no.posicao::int,
             atualizado_por = $2,
             atualizado_em = NOW()
         FROM nova_ordem no
         WHERE p.id = no.id
           AND p.status = 'CONFERIR'`, [ordemFinal, ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || null]);
        await client.query("COMMIT");
        return res.json({ ok: true, total: ordemFinal.length });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Erro ao reordenar remaneio:", error);
        return res.status(500).json({ error: "Erro ao reordenar remaneio." });
    }
    finally {
        client.release();
    }
});
app.patch("/pedidos/nf/antecipar", async (req, res) => {
    var _a, _b, _c;
    const pedidoIdsRaw = Array.isArray((_a = req.body) === null || _a === void 0 ? void 0 : _a.pedido_ids) ? req.body.pedido_ids : null;
    if (!pedidoIdsRaw || pedidoIdsRaw.length === 0) {
        return res.status(400).json({ error: "pedido_ids é obrigatório e deve ter ao menos 1 item." });
    }
    const pedidoIds = [
        ...new Set(pedidoIdsRaw
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
            .map((value) => Math.trunc(value))),
    ];
    if (pedidoIds.length === 0) {
        return res.status(400).json({ error: "pedido_ids inválido." });
    }
    try {
        const result = await db_1.pool.query(`UPDATE pedidos
       SET nf_status = 'ANTECIPADA',
           nf_efetivado_por = $2,
           nf_efetivado_por_nome = $3,
           atualizado_em = NOW(),
           atualizado_por = $2
       WHERE id = ANY($1::int[])
         AND COALESCE(nf_imagem_url, '') <> ''
         AND status <> 'CANCELADO'
       RETURNING id`, [pedidoIds, ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || null, ((_c = req.user) === null || _c === void 0 ? void 0 : _c.nome) || null]);
        return res.json({
            ok: true,
            total: result.rowCount || 0,
            ids: result.rows.map((row) => Number(row.id)),
        });
    }
    catch (error) {
        console.error("Erro ao efetivar notas:", error);
        return res.status(500).json({ error: "Erro ao efetivar notas." });
    }
});
// Cria um novo pedido com itens
app.post("/pedidos", async (req, res) => {
    var _a, _b, _c, _d, _e;
    const { chave_pedido, cliente_id, rota_id, data, status, itens, usa_nf, nf_imagem_url, nf_numero, canhoto_imagem_url } = req.body;
    const usuarioId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null;
    const usaNf = normalizarBoolean(usa_nf);
    const nfImagemUrl = normalizarImagemUrl(nf_imagem_url);
    const canhotoImagemUrl = normalizarImagemUrl(canhoto_imagem_url);
    const nfNumero = normalizarNfNumero(nf_numero);
    let clienteNome = "Cliente";
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
    if (usaNf && !nfImagemUrl) {
        return res.status(400).json({
            error: "Informe a imagem da NF quando o checklist 'Usa NF' estiver ativo.",
        });
    }
    if (usaNf && !nfNumero) {
        return res.status(400).json({
            error: "Informe o número da NF quando o checklist 'Usa NF' estiver ativo.",
        });
    }
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const clienteResult = await client.query("SELECT codigo_cliente, nome FROM clientes WHERE id = $1", [cliente_id]);
        if (clienteResult.rows.length === 0) {
            throw new Error("Cliente não encontrado");
        }
        clienteNome = String(clienteResult.rows[0].nome || "Cliente");
        // Gerar chave_pedido se não fornecida
        let finalChavePedido = chave_pedido;
        if (!finalChavePedido) {
            const codigoCliente = clienteResult.rows[0].codigo_cliente;
            const timestamp = Date.now().toString(36);
            finalChavePedido = `${codigoCliente}${timestamp}`;
        }
        // Validar se todos os produtos existem
        for (const item of itens) {
            const produtoCheck = await client.query("SELECT id FROM produtos WHERE id = $1", [item.produto_id]);
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
        const pedidoResult = await client.query(`INSERT INTO pedidos (chave_pedido, cliente_id, rota_id, data, status, valor_total, usa_nf, nf_imagem_url, canhoto_imagem_url, nf_numero, nf_status, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, chave_pedido, data, status, valor_total, usa_nf, nf_imagem_url, canhoto_imagem_url, nf_numero, nf_status`, [
            finalChavePedido,
            cliente_id,
            rota_id || null,
            data,
            statusNormalizado,
            valorTotal,
            usaNf,
            usaNf ? nfImagemUrl : null,
            usaNf ? canhotoImagemUrl : null,
            usaNf ? nfNumero : null,
            "PENDENTE",
            usuarioId,
        ]);
        const pedido = pedidoResult.rows[0];
        // Inserir itens do pedido
        const itensInseridos = [];
        for (const item of itens) {
            const valorTotalItem = parseFloat(item.quantidade) * parseFloat(item.valor_unitario);
            const comissao = item.comissao || 0;
            const itemResult = await client.query(`INSERT INTO itens_pedido 
         (pedido_id, produto_id, quantidade, embalagem, valor_unitario, valor_total_item, comissao)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, quantidade, embalagem, valor_unitario, valor_total_item, comissao`, [
                pedido.id,
                item.produto_id,
                item.quantidade,
                item.embalagem || null,
                item.valor_unitario,
                valorTotalItem,
                comissao,
            ]);
            // Buscar dados do produto
            const produtoResult = await client.query("SELECT id, codigo_produto, nome FROM produtos WHERE id = $1", [item.produto_id]);
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
        void enviarPushPedidos({
            titulo: "Novo pedido",
            corpo: `Pedido #${pedido.id} criado para ${clienteNome}.`,
            data: {
                tipo: "pedido_criado",
                pedido_id: Number(pedido.id),
            },
        });
        res.status(201).json({
            ...pedido,
            itens: itensInseridos,
        });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Erro ao criar pedido:", error);
        // Mensagens de erro mais específicas
        if (error.message === "Cliente não encontrado") {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }
        if ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("Produto com id")) {
            return res.status(404).json({ error: error.message });
        }
        if (error.code === "23503") { // Foreign key violation
            if ((_c = error.constraint) === null || _c === void 0 ? void 0 : _c.includes("cliente_id")) {
                return res.status(400).json({ error: "Cliente não encontrado" });
            }
            if ((_d = error.constraint) === null || _d === void 0 ? void 0 : _d.includes("produto_id")) {
                return res.status(400).json({ error: "Um ou mais produtos não foram encontrados" });
            }
            if ((_e = error.constraint) === null || _e === void 0 ? void 0 : _e.includes("rota_id")) {
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
    }
    finally {
        client.release();
    }
});
// Atualiza o status de um pedido
app.patch("/pedidos/:id/status", async (req, res) => {
    var _a;
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
        const updateFields = ["status = $1", "atualizado_por = $2"];
        const params = [statusNormalizado];
        params.push(((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null);
        let paramIndex = 3;
        if (statusNormalizado === "CONFERIR") {
            updateFields.push(`ordem_remaneio = COALESCE(
          ordem_remaneio,
          (SELECT COALESCE(MAX(ordem_remaneio), 0) + 1 FROM pedidos WHERE status = 'CONFERIR')
        )`);
        }
        else {
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
        const result = await db_1.pool.query(`UPDATE pedidos 
       SET ${updateFields.join(", ")}, atualizado_em = NOW()
       WHERE id = $${paramIndex}
       RETURNING id, chave_pedido, data, status, ordem_remaneio, valor_total, valor_efetivado`, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }
        void enviarPushPedidos({
            titulo: "Pedido atualizado",
            corpo: `Pedido #${result.rows[0].id} alterado para ${result.rows[0].status}.`,
            data: {
                tipo: "pedido_status_atualizado",
                pedido_id: Number(result.rows[0].id),
                status: String(result.rows[0].status),
            },
        });
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error("Erro ao atualizar status do pedido:", error);
        res.status(500).json({ error: "Erro ao atualizar status do pedido" });
    }
});
app.delete("/pedidos/:id", requireRoles("admin"), async (req, res) => {
    const { id } = req.params;
    const pedidoId = Number(String(id));
    if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ error: "ID de pedido inválido" });
    }
    try {
        const result = await db_1.pool.query("DELETE FROM pedidos WHERE id = $1 RETURNING id", [pedidoId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }
        return res.status(204).send();
    }
    catch (error) {
        console.error("Erro ao excluir pedido:", error);
        return res.status(500).json({ error: "Erro ao excluir pedido" });
    }
});
// --------- TROCAS ----------
// Lista trocas de um pedido específico
app.get("/pedidos/:id/trocas", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.pool.query(`SELECT 
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
      ORDER BY t.criado_em DESC`, [parseInt(String(id), 10)]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Erro ao buscar trocas:", error);
        res.status(500).json({ error: "Erro ao buscar trocas" });
    }
});
// Cria uma nova troca
app.post("/trocas", async (req, res) => {
    var _a, _b, _c;
    const { pedido_id, item_pedido_id, produto_id, quantidade, valor_troca, motivo } = req.body;
    const usuarioId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null;
    if (!pedido_id || !produto_id || !quantidade) {
        return res.status(400).json({
            error: "pedido_id, produto_id e quantidade são obrigatórios",
        });
    }
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        // Verificar se o pedido existe
        const pedidoCheck = await client.query("SELECT id FROM pedidos WHERE id = $1", [pedido_id]);
        if (pedidoCheck.rows.length === 0) {
            throw new Error("Pedido não encontrado");
        }
        // Verificar se o produto existe
        const produtoCheck = await client.query("SELECT id FROM produtos WHERE id = $1", [produto_id]);
        if (produtoCheck.rows.length === 0) {
            throw new Error("Produto não encontrado");
        }
        // Inserir troca
        const result = await client.query(`INSERT INTO trocas (pedido_id, item_pedido_id, produto_id, quantidade, valor_troca, motivo, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, pedido_id, item_pedido_id, produto_id, quantidade, valor_troca, motivo, criado_em`, [
            pedido_id,
            item_pedido_id || null,
            produto_id,
            quantidade,
            valor_troca || 0,
            motivo || null,
            usuarioId,
        ]);
        // Buscar dados do produto para retornar completo
        const produtoResult = await client.query("SELECT id, codigo_produto, nome FROM produtos WHERE id = $1", [produto_id]);
        await client.query("COMMIT");
        const troca = result.rows[0];
        const produto = produtoResult.rows[0];
        res.status(201).json({
            ...troca,
            produto: produto,
        });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Erro ao criar troca:", error);
        if (error.message === "Pedido não encontrado") {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }
        if (error.message === "Produto não encontrado") {
            return res.status(404).json({ error: "Produto não encontrado" });
        }
        if (error.code === "23503") {
            if ((_b = error.constraint) === null || _b === void 0 ? void 0 : _b.includes("pedido_id")) {
                return res.status(400).json({ error: "Pedido não encontrado" });
            }
            if ((_c = error.constraint) === null || _c === void 0 ? void 0 : _c.includes("produto_id")) {
                return res.status(400).json({ error: "Produto não encontrado" });
            }
        }
        res.status(500).json({ error: "Erro ao criar troca" });
    }
    finally {
        client.release();
    }
});
// Exclui uma troca
app.delete("/trocas/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.pool.query(`DELETE FROM trocas
       WHERE id = $1
       RETURNING id`, [parseInt(String(id), 10)]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Troca não encontrada" });
        }
        return res.status(204).send();
    }
    catch (error) {
        console.error("Erro ao excluir troca:", error);
        return res.status(500).json({ error: "Erro ao excluir troca" });
    }
});
// Atualiza um pedido completo (incluindo itens)
app.put("/pedidos/:id", async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const { id } = req.params;
    const { rota_id, data, status, itens, usa_nf, nf_imagem_url, canhoto_imagem_url, nf_numero } = req.body;
    const usuarioId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null;
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        // Verificar se o pedido existe
        const pedidoCheck = await client.query("SELECT id, cliente_id FROM pedidos WHERE id = $1", [parseInt(String(id), 10)]);
        if (pedidoCheck.rows.length === 0) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }
        const clienteId = pedidoCheck.rows[0].cliente_id;
        // Atualizar campos do pedido (se fornecidos)
        const updateFields = [];
        const params = [];
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
        if (usa_nf !== undefined) {
            const usaNf = normalizarBoolean(usa_nf);
            const nfImagemUrl = normalizarImagemUrl(nf_imagem_url);
            const nfNumero = normalizarNfNumero(nf_numero);
            if (usaNf && !nfImagemUrl) {
                throw new Error("Informe a imagem da NF quando o checklist 'Usa NF' estiver ativo.");
            }
            if (usaNf && !nfNumero) {
                throw new Error("Informe o número da NF quando o checklist 'Usa NF' estiver ativo.");
            }
            updateFields.push(`usa_nf = $${paramIndex}`);
            params.push(usaNf);
            paramIndex++;
            updateFields.push(`nf_imagem_url = $${paramIndex}`);
            params.push(usaNf ? nfImagemUrl : null);
            paramIndex++;
            const canhotoImagemUrl = normalizarImagemUrl(canhoto_imagem_url);
            updateFields.push(`canhoto_imagem_url = $${paramIndex}`);
            params.push(usaNf ? canhotoImagemUrl : null);
            paramIndex++;
            updateFields.push(`nf_numero = $${paramIndex}`);
            params.push(usaNf ? nfNumero : null);
            paramIndex++;
            updateFields.push(`nf_status = $${paramIndex}`);
            params.push("PENDENTE");
            paramIndex++;
        }
        else if (nf_imagem_url !== undefined) {
            const nfImagemUrl = normalizarImagemUrl(nf_imagem_url);
            updateFields.push(`nf_imagem_url = $${paramIndex}`);
            params.push(nfImagemUrl);
            paramIndex++;
            updateFields.push(`nf_status = $${paramIndex}`);
            params.push("PENDENTE");
            paramIndex++;
        }
        else if (nf_numero !== undefined) {
            const nfNumero = normalizarNfNumero(nf_numero);
            updateFields.push(`nf_numero = $${paramIndex}`);
            params.push(nfNumero);
            paramIndex++;
        }
        if (canhoto_imagem_url !== undefined) {
            const canhotoImagemUrl = normalizarImagemUrl(canhoto_imagem_url);
            updateFields.push(`canhoto_imagem_url = $${paramIndex}`);
            params.push(canhotoImagemUrl);
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
                const produtoCheck = await client.query("SELECT id FROM produtos WHERE id = $1", [item.produto_id]);
                if (produtoCheck.rows.length === 0) {
                    throw new Error(`Produto com id ${item.produto_id} não encontrado`);
                }
            }
            // Antes de deletar itens, remover referências nas trocas
            // (setar item_pedido_id como NULL nas trocas que referenciam itens deste pedido)
            await client.query("UPDATE trocas SET item_pedido_id = NULL WHERE pedido_id = $1 AND item_pedido_id IS NOT NULL", [parseInt(String(id), 10)]);
            // Deletar itens antigos
            await client.query("DELETE FROM itens_pedido WHERE pedido_id = $1", [parseInt(String(id), 10)]);
            // Inserir novos itens
            let valorTotal = 0;
            for (const item of itens) {
                const valorTotalItem = parseFloat(item.quantidade) * parseFloat(item.valor_unitario);
                valorTotal += valorTotalItem;
                await client.query(`INSERT INTO itens_pedido 
           (pedido_id, produto_id, quantidade, embalagem, valor_unitario, valor_total_item, comissao)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                    parseInt(String(id), 10),
                    item.produto_id,
                    item.quantidade,
                    item.embalagem || null,
                    item.valor_unitario,
                    valorTotalItem,
                    item.comissao || 0,
                ]);
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
        const pedidoResult = await client.query(`SELECT 
        p.id,
        p.chave_pedido,
        p.data,
        p.status,
        p.usa_nf,
        p.nf_imagem_url,
        p.canhoto_imagem_url,
        p.nf_numero,
        p.nf_status,
        p.nf_efetivado_por_nome,
        p.valor_total,
        p.valor_efetivado,
        c.id as cliente_id,
        c.codigo_cliente,
        c.nome as cliente_nome,
        c.link as cliente_link,
        r.id as rota_id,
        r.nome as rota_nome
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rotas r ON p.rota_id = r.id
      WHERE p.id = $1`, [parseInt(String(id), 10)]);
        const pedido = pedidoResult.rows[0];
        // Buscar itens
        const itensResult = await client.query(`SELECT 
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
      ORDER BY ip.id`, [parseInt(String(id), 10)]);
        pedido.itens = itensResult.rows;
        void enviarPushPedidos({
            titulo: "Pedido atualizado",
            corpo: `Pedido #${pedido.id} de ${pedido.cliente_nome} foi atualizado.`,
            data: {
                tipo: "pedido_atualizado",
                pedido_id: Number(pedido.id),
            },
        });
        res.json(pedido);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Erro ao atualizar pedido:", error);
        if ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("Cada item deve ter")) {
            return res.status(400).json({ error: error.message });
        }
        if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("Informe a imagem da NF")) {
            return res.status(400).json({ error: error.message });
        }
        if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("Produto com id")) {
            return res.status(404).json({ error: error.message });
        }
        if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("Status inválido")) {
            return res.status(400).json({ error: error.message });
        }
        if (error.code === "23503") {
            if ((_f = error.constraint) === null || _f === void 0 ? void 0 : _f.includes("rota_id")) {
                return res.status(400).json({ error: "Rota não encontrada" });
            }
            if ((_g = error.constraint) === null || _g === void 0 ? void 0 : _g.includes("trocas_item_pedido_id_fkey")) {
                return res.status(400).json({
                    error: "Não é possível atualizar pedido: existem trocas vinculadas aos itens. Remova as trocas primeiro ou atualize-as."
                });
            }
        }
        res.status(500).json({
            error: "Erro ao atualizar pedido",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
    finally {
        client.release();
    }
});
// --------- RELATÓRIOS ----------
const parseDateParam = (value) => {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
        return null;
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
        const params = [];
        const filtros = [];
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
        const result = await db_1.pool.query(`SELECT
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
      ORDER BY pr.nome ASC`, params);
        return res.json(result.rows);
    }
    catch (error) {
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
        const params = [];
        const filtros = [];
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
        const result = await db_1.pool.query(`SELECT
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
      ORDER BY rota_nome ASC, c.nome ASC`, params);
        return res.json(result.rows);
    }
    catch (error) {
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
        const params = [];
        const filtros = [];
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
        const result = await db_1.pool.query(`WITH pedidos_filtrados AS (
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
       ORDER BY rota_nome ASC, c.nome ASC, pf.data DESC, pf.id DESC, pr.nome ASC NULLS LAST`, params);
        return res.json(result.rows);
    }
    catch (error) {
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
        const queryParams = [];
        const buildWhereParts = [];
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
        const result = await db_1.pool.query(`SELECT
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
      ORDER BY r.nome ASC NULLS LAST, pr.nome ASC`, queryParams);
        return res.json(result.rows);
    }
    catch (error) {
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
        const params = [];
        const filtros = [];
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
        const result = await db_1.pool.query(`SELECT
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
      LIMIT 10`, params);
        return res.json(result.rows);
    }
    catch (error) {
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
        const params = [];
        const filtros = [];
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
        const result = await db_1.pool.query(`SELECT
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
      ORDER BY p.data DESC, p.id DESC, t.criado_em DESC`, params);
        return res.json(result.rows);
    }
    catch (error) {
        console.error("Erro ao gerar relatório de trocas:", error);
        return res.status(500).json({ error: "Erro ao gerar relatório de trocas" });
    }
});
// Relatório de notas (NF)
app.get("/relatorios/notas", async (req, res) => {
    try {
        const dataInicio = parseDateParam(req.query.data_inicio);
        const dataFim = parseDateParam(req.query.data_fim);
        const status = req.query.status ? normalizarStatus(String(req.query.status)) : null;
        const nfStatus = req.query.nf_status ? normalizarNfStatus(req.query.nf_status) : null;
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
        const params = [];
        const filtros = [
            "p.usa_nf = true",
            "COALESCE(p.nf_imagem_url, '') <> ''",
            "p.status <> 'CANCELADO'",
        ];
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
        if (nfStatus) {
            params.push(nfStatus);
            filtros.push(`p.nf_status = $${params.length}`);
        }
        const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(" AND ")}` : "";
        const result = await db_1.pool.query(`SELECT
        p.id AS pedido_id,
        p.chave_pedido,
        p.data AS pedido_data,
        p.status AS pedido_status,
        p.valor_total AS pedido_valor_total,
        p.nf_numero,
        p.nf_imagem_url,
        p.canhoto_imagem_url,
        p.nf_status,
        c.id AS cliente_id,
        c.codigo_cliente,
        c.nome AS cliente_nome,
        r.id AS rota_id,
        r.nome AS rota_nome
      FROM pedidos p
      INNER JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN rotas r ON r.id = p.rota_id
      ${whereClause}
      ORDER BY p.data DESC, p.id DESC`, params);
        return res.json(result.rows);
    }
    catch (error) {
        console.error("Erro ao gerar relatório de notas:", error);
        return res.status(500).json({ error: "Erro ao gerar relatório de notas" });
    }
});
const startServer = async () => {
    try {
        await ensureImageColumns();
        await ensureDefaultAdminUser();
        app.listen(PORT, () => {
            console.log(`APPEMP backend ouvindo na porta ${PORT}`);
            iniciarMonitoramentoCloudinary();
        });
    }
    catch (error) {
        console.error("Falha ao inicializar backend:", error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=index.js.map