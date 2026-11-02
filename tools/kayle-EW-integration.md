# E/W originais da Kayle — 2026-10-27

## Origem e limite do REA

A skill `C:/Users/vicfe/.agents/skills/reverse-engineer-anything/SKILL.md` foi aplicada. O CLI público REA 6.4.0 executou doctor e inspect-artifact sobre o pacote instalado. Não há ferramentas MCP REA conectadas. O resultado de inspect-artifact foi `target_unavailable: unsupported binary format`, preservado em `rea-kayle-artifact.json`. Não houve captura do processo, decompilação nativa nem Evidence ID de animação do REA.

O trabalho prosseguiu com o parser específico CDTB 1.3.0 e o conversor existente lol2gltf. Nenhum arquivo da instalação do League foi alterado.

- Pacote: `E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Kayle.wad.client`.
- SHA-256: `b7135b8ce08c062601601766fb1e9c2a058d95570452a5c487f47d6d3c4292df`.
- Extração reproduzível: `extract-kayle-spells.py`; depende de CDTB em `tools/python-deps`.
- Manifesto com paths, offsets e hashes por arquivo: `kayle-spells-original/manifest.json`.
- Os bytes extraídos agora coincidem com os recursos anteriormente extraídos; o mapa de animações corresponde ao hash registrado em `kayle-spell-map-evidence.json`.
- Saída: `public/assets/kayle-spells.glb`, com 12 clipes de 489 tracks cada. SKN/SKL possuem os mesmos nomes de ossos e transformações de repouso do modelo aprovado.

## Observações do mapa original

`Spell2` usa cinco clipes direcionais, com um atualizador de ângulo relativo ao alvo. `Spell3` possui os ramos L/R; `Spell3melee` usa seu próprio clipe. Há também os recursos enraged, sem um predicado de gameplay recuperado que prove quando selecioná-los. Todos usam a trilha Default; não foi inferida uma máscara fictícia de tronco.

As transições do grafo associam W→idle a `kayle_spell2_transidle`; E direita→corrida a `kayle_spell3runtransition`; E esquerda/melee→corrida a `kayle_spell3runtransitionleft`. Essa leitura dos pares compactados é inferência apoiada nos nomes e destinos, discriminada no JSON de evidências.

## Integração e escolhas do simulador

- E preparado troca a animação do próximo ataque, mantendo o dano/cadência do treino. Ativação durante uma preparação existente troca o clipe conservando o tempo de preparação já decorrido.
- O alinhamento de disparo usa castFrame 9,5 melee / 11 ranged observado em `kayle-root.json`, com a velocidade de reprodução escalada à preparação do treino.
- O sinal do ângulo relativo seleciona E esquerda/direita. É uma política de integração; a semântica exata da condição nativa não foi observada. Não se seleciona enraged apenas pelo nível.
- W é autocast neste treino, usando a direção central. As outras quatro direções permanecem no recurso convertido para futura seleção de alvo aliado.
- W usa o corpo completo enquanto a simulação continua movendo a Kayle. Quando ativado durante windup, somente a reprodução visual espera o disparo; a cura e a aceleração continuam imediatas. Um novo ataque pode interromper W/transições. Esse agendamento é uma escolha do treino, não comportamento nativo comprovado.
- Não há bloqueio adicional de input para completar um clipe. Transições saem para locomoção, e reset limpa ações pendentes. Pausa congela animação e gameplay.
- Efeitos de partículas, números de cura/dano e recargas continuam simplificados. Esta alteração recupera o movimento esquelético original, não o motor de partículas do League.

## Validação

`tests/kayle-animation.test.js` cobre seleção melee/direcional, progresso de windup, W em movimento, retorno à locomoção, prioridade de novo ataque e reset. `check-kayle-spells-browser.mjs` verifica os 12 clipes, toca W/E pela entrada real de teclado, observa pausa e retorno a idle, e verifica E nos níveis 1/6/11. Não foram observados erros PropertyBinding ou ossos ausentes. Capturas: `kayle-W-original.png`, `kayle-W-moving.png`, `kayle-E-original-level1.png`, `kayle-E-original-level6.png`, `kayle-E-original-level11.png`.
