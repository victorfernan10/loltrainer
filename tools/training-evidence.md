# Evidências da revisão do treino — 2026-10-26

## Escopo

Tornar o projeto existente um treino mensurável de esquiva e comando de movimento. Preservar os recursos locais e corrigir problemas que invalidavam o feedback. Nenhuma inspeção do processo do League em execução foi necessária.

## REA

- Skill lida: `C:/Users/vicfe/.agents/skills/reverse-engineer-anything/SKILL.md` e guia de recuperação.
- Diagnóstico pelo CLI público: `npx -y rea-agents@6.4.0 doctor --client codex --json`.
- Resultado observado: registro Codex ausente (`config_drift`); Ghidra e IDA não disponíveis no ambiente informado. Não havia ferramentas REA conectadas nesta sessão.
- Limite: não houve decompilação nem evidência de runtime do motor original. O diagnóstico não estabelece nada sobre as mecânicas do League. Nenhuma mudança de configuração global foi feita.

## Observações locais (ferramentas comuns, não Evidence IDs do REA)

1. `tools/lux-animations.txt`, bloco `Spell4`: aponta para `assets/characters/lux/skins/base/animations/lux_spell4.anm`. O arquivo existe sob `tools/game-extract/lux/`. O código anterior selecionava `lux_spell1` para `luxR`.
   - Ação: conversão do SKN/SKL com esse ANM por `tools/lol2gltf.exe`, gerando `public/assets/dodge/models/lux_r_cast.glb`.
   - Verificação no navegador: `lux_spell4`, 237 tracks, duração de 2 s; ação executada e retorno a idle ativo. O instante exato do evento de disparo do cliente original não foi recuperado.
2. O OBJ do Nautilus era normalizado aplicando escala e translação na raiz, depois recebia uma nova escala em X/Z mantendo a translação antiga.
   - Consequência geométrica: o pivô visual se deslocava em relação à posição numérica do projétil. Não era apenas uma questão de sinal da rotação.
   - Ação: centralizar os vértices antes do redimensionamento e manter a cabeça (-Y no OBJ) alinhada ao avanço local +Z. Corrente termina no lado da haste.
   - Verificação: captura `nautilus-q-axis-forward-preview.png` mostra a corrente conectada à haste.
3. O endpoint das habilidades era limitado à distância até a mira, mesmo quando abaixo do alcance configurado. Isso permitia escapar recuando para além do ponto mirado.
   - Ação: usar o ponto mirado para direção e estender até o alcance configurado. Teste unitário com mira a 10 u e alcance 1200 u; verificação de acerto/esquiva no navegador.
4. A pausa interrompia apenas o agendamento de ondas; projéteis e animações continuavam.
   - Ação: estado de pausa congela o tempo de simulação, sem acumular delta ao retornar. Teste compara relógio, avisos, projéteis, posição e tempos das animações antes/depois da pausa.
5. A colisão comparava a posição final da Kayle com o segmento percorrido pelo projétil.
   - Ação: segmento em coordenadas relativas, interpolando também o movimento da Kayle. Testes cobrem cruzamento entre frames e ocupação de uma posição em momentos diferentes.

## Decisões de treino, não dados extraídos do jogo

Sessões de 60/90/120 s; modos e probabilidades de mira; pressão e intervalo; meta de clique próximo; heurísticas de revisão; histórico e repetição com semente. O aviso uniforme de 0,5 s e a colisão estreita da Lux foram preservados como calibração do projeto. Não foram validados como valores do patch atual do League.


## Combate e circuito (27/10/2026)

Reutilizados public/assets/kayle.glb (clipes de ataque melee/ranged/fast) e targets/ryze.glb + ryze_base.png (idle); sem nova extração ou análise nativa REA. tools/kayle-root.json: basicAttack.castTime=.3, totalTime=1.55; usadas como proporção de preparação. Frames de referência 9,5 melee / 8 ranged ajustam a velocidade visual para alinhar o disparo. Missile speed=2250. Ranges de passiva525/625; melee150 preserva calibração solicitada, embora snapshot local contenha175. E/W, dano60/120, cura60, HP1000/600, raio65, meta60u e prazos são decisões do treino. Não se afirmam como réplica exata das habilidades atuais. Nenhuma alteração nos arquivos instalados do jogo.
