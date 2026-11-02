# Duelo contra Yone

Selecione **05 · Duelo · Yone**. Funciona com Kayle ou LeBlanc, inclusive
autoattacks e habilidades do jogador. A configuração inicial é E + Q/Q3 + AA,
com duas cargas de Q e dificuldade Fácil (AS base). Médio usa Grevas (+30% AS) e Difícil usa Grevas + Ritmo Fatal completo (+66% AS). A dificuldade fica no seletor à esquerda. O preset completo inclui W e R.

## Comportamento implementado

- Corpo fica na origem do E, espírito avança e persegue durante pelo menos 5 s, excluindo a preparação e recuperação do R (1,20 s adicionais por ultimate, regra de treino); velocidade
  cresce de +10% a +30%, com soft caps de movimento. Volta obrigatoriamente e
  repete 30% do dano causado (E rank 3 de treino).
- Q usa recargas calibradas pelo usuário e preparação por AS. Fácil: 3,12 s / 0,35 s; Médio: 2,40 s /
  0,30625 s; Difícil: 1,54 s / 0,25375 s. Q só acumula cargas ao acertar. Duas cargas armam Q3,
  que avança, lança tornado e arremessa o jogador por 0,75 s, sem acertar duas
  vezes pelo corpo/projétil. Cargas expiram em 6 s.
- AA interrompe a caminhada, tem preparação e intervalo, e não reinicia a
  animação ao cruzar o alcance. W aplica cone e escudo; R fixa uma linha,
  acerta/arremessa e reposiciona Yone além do alvo ou no fim da trajetória.
- IA alterna mira na posição observada e antecipação. A direção fica fixa
  quando começa a conjuração. Há atraso perceptivo simulado de 160/100/55 ms
  conforme pressão, evitando a mira instantânea perfeita de um bot.
- Aviso no chão é opcional e dura somente a preparação real configurada:
  não acrescenta 500 ms. O Q3 mostra a faixa do tornado e o trecho mais largo
  percorrido pelo corpo. Nenhuma hitbox de depuração dos campeões é mostrada.
- Ataques e habilidades do jogador afetam o Yone, incluindo a corrente da
  LeBlanc. Dano usa 1800 HP no inimigo, AA55/Q90/W70/R140 recebidos e valores
  de treino no escudo. Não simula builds, armadura/MR, crítico ou passiva.
- Repetições reiniciam Yone após 2,5 s, sem aguardar a recarga oficial do E.
  Pausa congela tudo. Encerrar conclui efeitos pendentes e retorno, sem iniciar
  outra investida. Histórico separa AS, preset, cargas iniciais e aviso visual.
- Revisão permite repetir a linha/cone registrada, sem a perseguição seguinte.

## Recursos originais e limites

`yone-export-combat.py` extrai em modo somente leitura do WAD instalado atual,
decodifica texturas e converte 57 clips de combate/locomoção para
`public/assets/yone/yone-combat.glb`. Manifesto com hashes/offsets:
`tools/yone-combat-original/manifest.json`.

Foi mantido skinScale 0,93. Props Bow_Smear/Fish/Sushi/Instrument/Azakana são
removidos conforme a lista inicial de visibilidade da skin; a geometria de
Azakana inclui a cabeça e mãos que antes apareciam flutuando. Katana,
GhostKatana e Sheath usam a textura original de espadas antes ausente,
`yone_base_swords_tx_cm`. Body/Skirt usam a textura de corpo; smears usam
streak_white/streak_red e aparecem apenas durante golpes. O corpo do E é
uma segunda instância do mesmo esqueleto com bodyin/bodyloop.

Os clipes e texturas são originais; seleção, blends e sincronização são do
simulador. Partículas de Q/W/R/tornado, tom do espírito e transparência do
corpo são representações de treino, não o renderer de partículas da Riot.
Q3 corpo usa raio 100 e projétil raio 80; interpretação de campos de largura
e demais limites estão em `yone-mechanics-evidence.md`. A curva linear de
velocidade do E, retorno e preparação do R são calibrações, não captura de
execução do motor oficial. O modo não é um port integral de League of Legends.

## Verificação

- `tests/yone.test.js`: AS/caps, E perseguição/retorno/repetição, Q cargas,
  direção fixa, Q3 sem dano duplicado, AA sem reinício, root, pausa, morte,
  encerramento, escudo e separação de histórico.
- `tests/yone-effects.test.js`: avisos alinhados em oito direções; cone de W
  na direção correta; desativar avisos mantém projéteis visíveis.
- `tools/check-yone-duel.mjs`: navegador com modelo completo, E/Q3/W/R,
  pausa/retomada, retorno, segunda investida, relatório, repetição de tentativa
  e saída para o combate comum, sem erros JavaScript ou PropertyBinding.

Fontes públicas primárias para o comportamento geral:
https://www.leagueoflegends.com/en-us/champions/yone/
https://www.leagueoflegends.com/en-us/news/dev/champion-insights-yone/

Atualização de 2026-10-28: presets pesquisados e R sincronizado; ver `yone-ratings-research.md`. Referência sem bônus de AS por nível ou fragmentos.
