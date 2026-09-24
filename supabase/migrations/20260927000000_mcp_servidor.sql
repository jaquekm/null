-- 6.9: Servidor MCP — aviso de expiração de tokens (`check_mcp_token_expiry`,
-- roda diário): carimbo de "já avisado" por token, pra não empurrar o mesmo
-- aviso todo dia enquanto o token continua perto de expirar.
alter table public.api_tokens add column expiry_warned_at timestamptz;
