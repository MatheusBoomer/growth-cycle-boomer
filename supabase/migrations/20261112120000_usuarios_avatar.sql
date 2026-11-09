-- Foto do Google de cada pessoa (gravada no login, já validada pelo app). Só uma coluna nova:
-- RLS, revoke e grant da tabela vêm da migração 20261107120000_usuarios.sql e continuam valendo.

alter table planejamento.usuarios add column if not exists avatar_url text;
