# Fase 10 — Vida em um lugar só (rotina, saúde, alimentação)

Ideias vindas de prints de um app de organização pessoal que a dona mostrou (30/09): juntar o
dia a dia do corpo e da rotina numa tela só, com um toque pra marcar. Ordem aprovada pela dona:
Rotina → Saúde → Hoje como painel → Alimentação → Finanças → Pacotes e revisão.

Regras de sempre: regra de negócio em função pura com teste; migration só quando precisar
(e aplicada em produção só com o pedido da dona); dado de saúde não vai pra IA sem o módulo
ligado, igual finanças.

## 10.1 — Hábitos da semana e consistência ✅

- Página **Rotina** (`/rotina`, no menu): grade da semana — hábitos nas colunas, dias nas linhas,
  um toque pra marcar. Semana anterior/próxima. "+ Hábito" cria na hora.
- Usa os itens do tipo **Hábito** que já existem (registro em `properties.log`, 5.12) — sem tabela
  nova. Sem o tipo, um botão cria.
- Frequência ("todo dia", "seg, qua e sex"): dia fora da frequência aparece apagado (dá pra marcar
  mesmo assim).
- **Consistência:** mapa de calor das últimas 16 semanas e sequência de dias ("12 dias seguidos"),
  geral e por hábito.

## 10.2 — Rotina por horário ✅

- Blocos fixos da semana (6h acordar, 8h academia, 13h almoço), editáveis numa grade de horário.
- Aparecem na Agenda e no Hoje ("agora: Academia"), sem virar evento do Google.

## 10.3 — Modo foco ✅

- Cronômetro (pomodoro 25/5 ou livre) ligado a uma tarefa ou projeto; guarda o tempo gasto.
- Resumo "onde foi meu tempo" na semana.

## 10.4 — Água ✅

- Meta diária e "+250 ml" no Hoje; histórico da semana.

## 10.5 — Vitaminas e remédios

- Nome, dose, horários e estoque. Lembrete no horário (notificação ou WhatsApp, 9.8).
- Marcar que tomou desconta do estoque; aviso "acaba em 5 dias" (e vai pra lista de compras).

## 10.6 — Peso, medidas e IMC

- Registro e gráfico de evolução; junta com o semanal do Treinos (peso e cintura) em vez de duplicar.

## 10.7 — Log médico

- Consultas, exames e receitas (anexo + OCR + validade da 9.5), sintomas por data.
- "Resumo pra levar ao médico" (PDF ou link com validade).

## 10.8 — Hoje como painel

- Água, remédios, hábitos do dia, treino e refeições marcáveis direto no Hoje.

## 10.9 — Cardápio da semana

- Dias × refeições (café, almoço, lanche, janta, ceia), copiar dia, repetir semana.

## 10.10 — Lista de compras do cardápio e receitas

- Soma os ingredientes do cardápio numa lista "Riscar" compartilhável (9.7).
- Receitas com ingredientes e porções; ajustar pra N pessoas.

## 10.11 — Jejum

- Cronômetro de jejum com histórico.

## 10.12 — Patrimônio

- Investimentos e dívidas no mesmo painel, evolução mês a mês.

## 10.13 — Desejos e caixinhas

- Coisas que a dona quer comprar, meta, quanto já guardou, "em quantos meses dá".

## 10.14 — Plano de quitação de dívidas

- Ordem sugerida (menor saldo ou maior juro primeiro) e data prevista de quitar.

## 10.15 — Pacotes prontos

- "Rotina", "Saúde", "Alimentação", "Finanças pessoais": tipos, visões, receitas e modelos com um toque.

## 10.16 — Revisão da semana automática

- Consistência dos hábitos, gastos x orçamento, treinos, peso e remédios esquecidos, com uma frase
  de resumo da IA.
