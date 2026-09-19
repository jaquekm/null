-- Pipeline de transcrição (2.6): "enfileirar summarize_transcript se o item
-- for do tipo Reunião ou se o usuário marcou 'resumir'" — o enunciado da 2.1
-- não previa uma coluna pra esse segundo caso (itens que não são Reunião mas
-- o dono quer resumo mesmo assim). Opt-in explícito no momento de pedir a
-- transcrição (`requestTranscription`, 2.5/2.6); item do tipo Reunião sempre
-- resume, com ou sem essa flag.
alter table public.transcripts
  add column summarize boolean not null default false;
