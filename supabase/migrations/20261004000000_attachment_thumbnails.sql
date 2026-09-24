-- 7.9: miniatura gerada no navegador antes do upload (redimensionamento client-side,
-- sem depender de transformação de imagem do Storage, que não é garantida em todo plano).
alter table public.attachments add column thumbnail_path text;
