# Mechanics Lab · Kayle e LeBlanc

Treino local de precisão de clique, esquiva e mudança de direção. Usa a Kayle e os adversários animados extraídos do jogo, com sessões curtas, revisão de trajetórias e histórico no navegador.

Selecione **Kayle** ou **LeBlanc** no cabeçalho antes de iniciar um bloco. A LeBlanc usa seu modelo/texturas originais, repouso, corrida em360°, dois autoattacks e giro/encaixe do cajado. A velocidade padrão é340 e o alcance de ataque525 em todos os níveis. Os resultados ficam separados por campeão.

Com LeBlanc selecionada, **Ajustes do treino → Animações originais** permite visualizar os31 clipes extraídos da skin base: movimento, ataques, habilidades, retornos, canalizações, recall, morte e emotes. Q/W/E/R ainda não possuem mecânicas de combate; o catálogo mostra seus movimentos. E/W simplificados da Kayle não são aplicados à LeBlanc. Proveniência e limites: `tools/leblanc-integration.md`. Verificação: `node tools/check-leblanc-browser.mjs`.

## Executar

Abra **Iniciar Treino.cmd**, ou use `npm install` e `npm run dev`. Acesse http://127.0.0.1:5173. O projeto usa Three.js e Vite; não precisa de conexão com uma partida.

## Uma rotina com feedback

1. Escolha **Passos curtos**, **Quebra de ritmo** ou **Pressão dupla**. Selecione 60, 90 ou 120 segundos e a pressão desejada.
2. Mova a Kayle com o botão direito. A meta de clique perto é configurável (150 unidades por padrão). Um clique distante continua sendo executado normalmente.
3. Ao terminar, examine as tentativas em que foi atingido. O desenho superior mostra a trajetória, o corpo da Kayle, o caminho percorrido e os destinos dos cliques. Arraste a linha do tempo para inspecionar a tentativa.
4. Use **Repetir esta habilidade** para isolar uma tentativa. A posição inicial, o destino de movimento anterior e a mira são restaurados. As outras habilidades simultâneas são omitidas nessa repetição.
5. Use **Repetir sequência e ajustes** para um novo bloco com a mesma semente. As decisões das ondas são reproduzidas; suas ações continuam alterando aproximação, mira e resultado. Isso não é reprodução automática da partida.

| Modo | Comportamento |
| --- | --- |
| Passos curtos | Um adversário, mirando a posição atual. Pratique ler a linha e escolher um comando lateral. |
| Quebra de ritmo | Um adversário; 70% das miras extrapolam a velocidade atual da Kayle, 30% miram a posição atual. |
| Pressão dupla | Dois adversários diferentes, uma habilidade por adversário, com lançamentos espaçados conforme a pressão. 45% das miras são antecipadas. |

A pressão altera a pausa entre ondas e a separação entre lançamentos, preservando os parâmetros das habilidades. Os ajustes relevantes ficam bloqueados durante o bloco para manter a comparação coerente. Pelo menos duas habilidades devem estar habilitadas para Pressão dupla.

## O que é medido

- **Esquivas:** tentativas concluídas sem colisão. Uma habilidade ainda em voo não entra no resultado; ao acabar o tempo, o bloco espera as habilidades pendentes terminarem.
- **Cliques curtos:** porcentagem dos cliques de movimento cujo destino fica dentro da distância configurada em relação à Kayle no momento do comando. A medição é em unidades do mundo, não em pixels. Muitos cliques, por si só, não geram uma pontuação adicional.
- **Primeiro comando:** mediana do tempo entre o aviso e a primeira ordem de movimento ou parada. Inclui apenas tentativas iniciadas com a Kayle dentro do corredor de colisão e que receberam um novo comando. Não é uma medição pura de tempo de reação humano, nem inclui tentativas sem comando como zero.
- **Sequência:** esquivas consecutivas, em ordem de conclusão das habilidades.
- **Por habilidade:** quantas foram desviadas e quantas foram concluídas. As sugestões são heurísticas sobre os dados do bloco, não um diagnóstico de habilidade ou previsão de elo.

Os últimos 20 blocos ficam em `localStorage` deste navegador. Repetições isoladas não entram no histórico de pontuação. A comparação com o bloco anterior só usa configurações equivalentes de modo, pressão, duração, velocidade, meta de clique, intervalo e habilidades ativas. Apagar os dados do site remove o histórico. Não há envio de dados a um servidor.

## Controles

- Botão direito: movimento imediato e indicador breve do clique.
- S: parar.
- Espaço: recentralizar a câmera uma vez, deixando-a livre.
- Y: alternar câmera travada.
- Esc ou **Pausar treino**: congelar movimento, habilidades, relógio e animações. Perder o foco da janela também pausa; retome pelo botão ou Esc.
- **Encerrar e revisar**: interromper novas ondas, concluir as habilidades em voo e abrir a revisão.
- **Preparar novo bloco**: descartar o bloco em curso e voltar à seleção.

## Fidelidade e regras do simulador

As malhas, texturas, esqueletos e animações vêm dos arquivos locais anteriormente extraídos do League. A Lux agora usa `lux_spell4.anm` para o R, mapeado como `Spell4` no recurso de animações extraído; o GLB correspondente é `public/assets/dodge/models/lux_r_cast.glb`. A âncora do Nautilus tem a geometria centralizada antes do redimensionamento, evitando o deslocamento do pivô em relação à corrente.

A câmera inicia em altura 1510 e inclinação 56°, conforme a calibração escolhida neste projeto. Movimento padrão: 335 u/s; raio corporal: 65 u. Esses valores e os parâmetros abaixo pertencem à simulação, sem afirmar equivalência de motor ou validação contra o patch atual.

| Habilidade | Alcance | Largura de colisão | Velocidade |
| --- | ---: | ---: | ---: |
| Xerath Q | 1450 | 145 | Feixe instantâneo após o aviso |
| Nautilus Q | 1100 | 140 | 2000 u/s |
| Thresh Q | 1100 | 140 | 1900 u/s |
| Lux R | 3340 | 60 | Feixe instantâneo após o aviso |
| Ezreal Q | 1200 | 120 | 2000 u/s |

A colisão soma metade da largura ao raio corporal. O R da Lux mantém a tolerância de treino mais estreita solicitada anteriormente; seu feixe visual usa largura 190 e camadas de brilho. O aviso uniforme de 0,5 s é uma regra deste treino. Tempos, efeitos, colisões e shaders não são uma reprodução exata do cliente original. Não se simulam latência, obstáculos, minions, controle de grupo ou itens. Vida e dano existem apenas no modo de combate, com valores fixos de treino.

As habilidades percorrem o alcance completo após escolher a direção: não desaparecem ao chegar ao ponto originalmente mirado. A colisão dos projéteis considera o movimento relativo dos dois corpos ao longo do frame, inclusive cruzamentos rápidos. A revisão amostra o caminho em aproximadamente 20 Hz; o teste de colisão ocorre a cada frame.

## Recursos e REA

A skill REA foi consultada nesta revisão. `rea-agents@6.4.0 doctor --client codex --json` identificou ausência de registro ativo do servidor e de motores nativos disponíveis. Nenhuma configuração global foi modificada e nenhuma análise nativa do executável foi reivindicada. A conversão de Lux e a correção do pivô usaram os arquivos extraídos e o conversor `tools/lol2gltf.exe` existentes. Fontes, observações e limites estão em `tools/training-evidence.md`.

## Verificação

- `npm test`: configuração importável, movimento, alcance completo, colisão relativa, relógio, métricas, semente e equivalência de histórico.
- `npm run build`: build de produção.
- Com o servidor aberto, `node tools/check-dodge-browser.mjs`: modelos, idle, conjuração, Lux R correto, acertos e esquivas, desaparecimento após conjuração.
- `node tools/check-training-browser.mjs`: sessão pela interface, clique direito, pausa total, encerramento, revisão, repetição isolada, histórico após reload e término por tempo.

As verificações do navegador salvam capturas em `tools/training-setup.png`, `tools/training-live.png` e `tools/training-review.png`. Para regenerar os GLBs a partir dos arquivos extraídos, `tools/convert-dodge-idles.py` usa o conversor e o runtime .NET locais.

## Combate e circuito de APM

Escolha **Kiting sob pressão**. A rotina padrão é **Circuito APM**: dispare duas vezes no Ryze marcado, depois troque para a nova marca. O prazo é 5 / 3,5 / 2,5 segundos conforme a pressão. Ambos são alvos imóveis com idle animado, 600 de vida e reaparecimento após 1,2 s; os cinco conjuradores continuam sendo as ameaças de esquiva. A rotina Livre e a opção de desabilitar habilidades permitem aquecer separadamente.

- Direito no chão move; direito no modelo ataca diretamente. Esquerdo faz ataque-movimento quando vinculado; alternativamente A prepara o alcance até o próximo esquerdo. Prioridade por cursor ou pela Kayle configurável.
- O ataque pronto começa imediatamente e espera somente sua preparação. Mover antes do disparo cancela; depois do disparo o projétil continua. Repetir a ordem no mesmo alvo não reinicia a preparação. Os botões funcionam mesmo com pressionamentos sobrepostos.
- **E** prepara o próximo ataque com 120 de dano e reinicia a recarga do autoattack; recarga do E de 5 s. Uma preparação cancelada preserva o fortalecimento. O E pode ser usado durante a preparação, sem reiniciá-la.
- **W** cura 60, limitado a 1000 de vida, e aumenta o movimento em 30% por 2 s; recarga de 10 s. Não interrompe o autoattack. E/W são recursos simplificados de treino, sem reprodução dos efeitos ou dos números atuais dessas habilidades no LoL.
- Ataques normais causam 60 e habilidades inimigas causam 100. Vida zero encerra o bloco após concluir projéteis pendentes. E/W e prazos congelam na pausa.
- Alcance por nível: 150 / 525 / 625. O teste de alcance soma os raios dos dois corpos uma vez. AS ajustável de 0,5 a 3; preparação proporcional a 0,3/1,55 do período. A animação usa os clipes melee/ranged/fast de Kayle já extraídos. O projétil tem velocidade 2250 u/s; seu efeito é reconstruído.

O relatório guarda dano, DPS sobre o tempo ativo, vida, cancelamentos, trocas completas, prazos perdidos, usos de E/W e reinícios efetivos da recarga. A meta de passo exige deslocamento líquido de pelo menos 60 unidades entre dois disparos; clicar sem se deslocar não conta. A marca é avaliada no disparo, de modo que um projétil em voo não é penalizado quando ela muda.

**APM** conta ordens de movimento, ataque, parada e usos aceitos de E/W por minuto ativo. **Comandos distintos/min** ignora repetição consecutiva da mesma ordem/alvo e mudanças de destino menores que 30 unidades. É uma heurística de variedade de comandos, não uma medida universal de utilidade. Cliques repetidos não rendem trocas ou passos extras. Compare dano, vida, esquiva e cancelamentos junto com APM.

Verificação adicional: `node tools/check-combat-browser.mjs` cobre mouse com botões sobrepostos, jitter, pausa, alcance com A, ataque direto, melee, dano recebido e histórico. `node tools/check-circuit-browser.mjs` verifica a rotina com E/W pelo teclado e a troca do alvo marcado. `npm test` cobre reset, fortalecimento, cura, aceleração, trocas e métricas.

## Animações originais de E/W

O E usa os clipes originais `kayle_spell3`, `kayle_spell3_l` e `kayle_spell3melee`, conforme direção e ataque corpo a corpo/à distância. Ao voltar a andar, usa a transição original de E para corrida. O W usa `kayle_spell2` e sua transição para idle, permitindo continuar o movimento. Novos ataques podem interromper a animação; não há bloqueio de comandos para esperar o clipe terminar.

Foram extraídos 12 clipes diretamente do Kayle.wad.client instalado e convertidos em `public/assets/kayle-spells.glb`. O REA foi chamado, mas rejeitou o WAD como formato não suportado; a extração efetiva usou CDTB/lol2gltf. Proveniência, hashes, escolhas de agendamento e limites estão em `tools/kayle-EW-integration.md`. Os efeitos de partículas e valores de E/W ainda são simplificações do treino. Teste visual: `node tools/check-kayle-spells-browser.mjs`.


## Publicar no GitHub Pages

O workflow `.github/workflows/pages.yml` instala as dependências, executa os testes e publica `dist` a cada push na branch `main`. Em **Settings → Pages**, selecione **GitHub Actions** como fonte.

O caminho público é obtido automaticamente do GitHub Pages. Para reproduzir uma publicação em subpasta localmente, configure `PAGES_BASE_PATH=/loltrainer/` antes de `npm run build`. O desenvolvimento local continua usando `/`.

O repositório contém o código, testes e recursos de runtime em `public/assets`. Dependências, dados pessoais de configuração e extrações intermediárias ficam fora do Git. Não é necessário instalar League of Legends para acessar o treino publicado. O progresso é salvo no navegador de cada visitante.

Projeto educacional independente, sem afiliação ou endosso da Riot Games. League of Legends, campeões e recursos originais pertencem à Riot Games; este repositório não concede uma licença sobre esses recursos.
