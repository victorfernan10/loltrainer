# Treino livre de skillshots contra LeBlanc

## Escopo

Uma adversária com o modelo completo e animações originais já convertidas da LeBlanc: repouso, corrida, Distorção, transição de aterrissagem e atordoamento. Sem sequência obrigatória de habilidades, sem responder ao cursor do jogador e sem acelerar a física nas dificuldades altas.

Este módulo implementa **uma política de adversária de treino**, não a IA original do League nem o kit de combate completo de LeBlanc. Ela não causa dano neste modo. O jogador pode usar qualquer ordem de habilidades, explorar a janela do dash e converter controles em acertos.

## Integração

- `aimTargets()` fornece `aim-leblanc`, 3500 HP, raio de combate 65, inicialmente na frente do jogador.
- `new AimEncounter({combat,random,difficulty})` recebe o motor do jogador. `AimView(scene).load()` reutiliza os recursos LeBlanc existentes.
- Por quadro: `aim.update(dt, position, {allowStart: session.state === 'running'})` **antes** de `combat.update(...)`. O relógio da adversária termina em `combat.time + dt` e publica `target.previousPosition` para colisão relativa dos projéteis.
- Depois do combate: `aim.observe(combatEvents)`; os eventos também continuam para os efeitos/animações do jogador.
- `aimView.update(dt, position, camera)` consome apenas `aim.drainViewEvents()`, sem retirar os eventos do combate.
- `stop()` não esconde o alvo nem transforma em alvo imóvel enquanto existirem habilidades visíveis já comprometidas. Não cria novos percursos/provocações, mas permite concluir movimento, respostas e dash. `pending` contém apenas o dash finito. O motor do jogador continua controlando a conclusão dos projéteis.

## Movimentação e dificuldade

Velocidade base 340 u/s; Distorção até 600 u a 1450 u/s. Recarga de 10 s em todas as dificuldades, correspondente ao W grau 5 em `src/leblanc-data.js` (snapshot original documentado em `tools/leblanc-abilities.md`). A velocidade usa as regras de softcap de `effectiveSpeed` quando há lentidão.

Políticas de treinamento:

| Dificuldade | Reação após sinal comprometido | Decisões de passos | Probabilidade de dash defensivo necessário |
|---|---:|---:|---:|
| Fácil | 360 ms | 1,20–1,95 s | 25% |
| Médio | 230 ms | 0,55–1,15 s | 70% |
| Difícil | 140 ms | 0,24–0,72 s | 100% |

Médio/difícil alternam direção, usam passos curtos e podem fazer paradas muito breves para contrariar extrapolações constantes. A adversária também usa ocasionalmente um W lateral durante a movimentação, criando uma janela visível para treinar a aterrissagem. Toda trajetória de dash é comprometida; o destino não acompanha o cursor. Raiz/atordoamento impedem novos movimentos e dashes; um dash comum já comprometido termina, e o controle restante vale na aterrissagem. Deslocamento forçado interrompe o dash do simulador.

## Informação visível e pontuação

Consome `spell-telegraph` somente após uma habilidade efetivamente comprometida. Carregar Q sem soltá-lo não revela direção nem gera tentativa. As formas são linhas/círculos/projéteis com origem, destino, dimensões e instante de impacto. O E pode usar a posição pública atual do projétil após a latência de reação.

`spell-resolved` encerra uma tentativa uma única vez. Relatório inclui acertos/erros/precisão de Q/W/E/R, centros do W, acertos durante dash, até 400 ms após a aterrissagem, melhor sequência e alvos abatidos. Habilidades ainda em voo não inflacionam a precisão. A morte renova o alvo após 1,8 s, limpando controles, histórico imediato de colisão e geração; nenhum respawn acontece depois de encerrar o bloco.

## Verificação

`node --test tests/aim.test.js`: dificuldade sem aumento de física, ausência de leitura de carga/cursor, latência de reação, compromisso e recarga do dash, controles e lentidão, contagem sem duplicatas, morte/respawn e término de habilidades em curso.
