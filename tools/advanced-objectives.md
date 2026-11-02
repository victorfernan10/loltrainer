# Objetivos avançados — ruleset 6

Selecione o perfil **Avançado**. A pressão 3 exige mais decisões; o perfil Assistido mantém a progressão anterior. São regras pedagógicas e políticas de IA do simulador, não uma reprodução comprovada da IA do League.

- **Circuito APM:** três alvos, próximo alvo aleatório entre os vivos, dois disparos válidos por objetivo (três na pressão 3). Entre disparos pontuáveis, exigir deslocamento de 45 / 70 / 95 unidades. Ataques estacionários e fora do alvo continuam causando dano normalmente, mas não pontuam. A janela respeita um mínimo calculado pela cadência configurada. HUD e relatório distinguem esses erros.
- **Lane:** manter farm próprio enquanto pune o last hit inimigo. Contagem de last hits, oportunidades perdidas e catapultas; minions vivos removidos na renovação da wave não são perdas. O inimigo pode responder a uma habilidade gasta fora da janela, respeitando suas decisões de farm, desvio e recarga. Permanecem sete minions por lado e renovação após três mortes vermelhas.
- **Quinn × LeBlanc:** 20% / 30% de aproximações sem W nas pressões 2 / 3. Apenas caminhada e repouso, sem simular falsamente uma conjuração. Guardar E pontua decisão correta; gastar E nessa aproximação pontua precipitação. Interrupções reais continuam dependendo de contato antes do fim do avanço. Tentativas parciais encerradas não contam como sucesso.
- **Ahri:** menor intervalo entre habilidades conforme a pressão, reposicionamento durante a volta do orbe baseado na posição observada com atraso. Relatório de sequências inteiras limpas e voltas do Q evitadas.
- **Locke:** espera variável antes do terceiro Q, até 650 ms na pressão 3. Velocidade e preparação do projétil preservadas. Relatório separado de terceiros Q evitados e sequências limpas.
- **Yone:** aproximação lateral variável, decisão de segurar Q3 até 120 / 320 ms nas pressões 2 / 3, abertura Q/W variável no kit completo. Sem acelerar a física das habilidades. Q continua em 3,12 / 2,40 / 1,54 s, R em 0,75 s, E em cinco segundos com a regra existente para excluir o tempo do R.

Ruleset incrementado para não comparar automaticamente blocos com regras diferentes.

## Verificação

- `tests/advanced-objectives.test.js`: objetivos de espaçamento e cadência, contabilização do farm, decisões sem W, terceiro Q, tentativas parciais e constantes de Yone.
- `tools/check-advanced-objectives.mjs`: seis modos no navegador, HUDs e relatórios, conclusão natural de sequências Ahri/Locke e aproximação sem W, ausência de erros de página e PropertyBinding. A verificação de farm injeta dano pelo motor de combate; não mede habilidade humana de last hit.
- Capturas: `advanced-circuit-goals.png`, `advanced-yone-pressure.png`.
