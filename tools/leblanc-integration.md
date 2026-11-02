# LeBlanc jogável e biblioteca da skin base

## Proveniência

Extração read-only de `E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Leblanc.wad.client` por CDTB 1.3.0. SHA-256 do pacote: `b49e087f1943e7b659fe251b6cd3eb57ad1f8ee82813a6f1929ea16258058dfc`.

`extract-leblanc.py` reproduz extração e conversão com lol2gltf, usando o runtime .NET já presente. `leblanc-original/manifest.json` contém 265 recursos conhecidos da skin base/dados da personagem, offsets, tamanhos e hashes. As 31 entradas ANM do diretório base foram convertidas e correspondem às 31 animações de `public/assets/leblanc/leblanc.glb`. Este inventário não afirma cobrir animações de outras skins nem membros desconhecidos ao dicionário de hashes.

O formato WAD já foi rejeitado como não suportado pelo CLI REA durante a investigação anterior da Kayle. Esta extração usou o parser específico; não é evidência de execução do motor original nem captura de runtime por REA. A skill orientou a investigação dos recursos, com análise independente do mapa de animações. Nenhum arquivo da instalação do jogo foi alterado.

## Material e esqueleto

- Corpo/pernas usam `leblanc_base_tx_cm`; cajado/capa usam `leblanc_base_weapon_tx_cm` conforme o skin record.
- Mantidas as quatro malhas/material slots Body, Legs, Cape e Weapon. Não foi encontrado um conjunto de props extras a esconder.
- `skinScale` não foi declarado: escala1 é o default do simulador, não um valor extraído explícito.
- O skin record usa `defaultAnimations=[WeaponSpin]`. A máscara tem175 entradas e só o joint174/WeaponTip está ativo. O simulador toca sua rotação separadamente e remove esse joint da trilha principal para não misturar a rotação com chaves estáticas.
- Idle1/Death declaram JointSnap de Weapon para Buffbone_Cstm_WeaponSnap. O simulador aplica essa transformação no espaço do pai apenas nesses clipes; corrida/ataques mantêm os movimentos do ANM.
- O material customizado da capa inclui energia em scroll e um modificador conform-to-path. Seus shaders/deformações dinâmicas completos não foram reconstruídos; a malha e a animação esquelética são originais, com material difuso aproximado.
- `spell3_channel` e `idle3` têm tracks parciais. Na visualização isolada, ossos não animados usam a trilha de repouso para evitar expor bind pose. Essa composição é uma decisão do visualizador.

O decode integral de skin0.bin falha no nome de64bits de um StaticMaterialDef que o CDTB lê como32bits. O primeiro SkinCharacterDataProperties foi lido separadamente, com tamanho validado; o material da capa foi recuperado delimitando sua entrada. Evidências: `leblanc-animation-evidence.json`, `leblanc-skin0-record.json`, `leblanc-cape-material-partial.json`.

## Jogo e catálogo

Selecionar LeBlanc no cabeçalho habilita corrida, repouso, autoattacks alternados, ataque-movimento, prioridade por cursor/campeão, S e câmera. Funciona nos quatro modos. Troca de campeão fica bloqueada durante o bloco, e o histórico distingue os campeões.

Dados observados: velocidade340, range525, projétil1700 e castFrame8. O tempo observado de preparação é0,32575, com base AS0,658; sua escala inversa com AS é uma calibração do simulador, pois a fórmula nativa exata não foi recuperada. Raio65 e dano60 continuam regras comuns do treino; selectionRadius100 e pathfindingRadius35 não foram usados como hitbox.

O catálogo em Ajustes toca todas as31 animações antes do bloco. Q/RQ compartilham Spell1; E/RE compartilham Spell3. Os arquivos da família W são Spell2/retornos/transições, embora a declaração de spell W/RW referencie Spell4, ausente no grafo base: o remapeamento de script não foi confirmado. R não tem um ANM independente nesse conjunto.

Q/W/E/R agora funcionam no modo de combate, com marcas, dash/retorno, corrente, dano e Mímica. Veja `leblanc-abilities.md` para valores, controles, testes e limites da reconstrução. A passiva de clone ainda não está simulada. E/W simplificados da Kayle são explicitamente bloqueados na LeBlanc. Projéteis e partículas usam visuais reconstruídos do treino.

## Verificação

- `tests/leblanc.test.js`: inventário31/31, identidade do joint mascarado, range em todos os níveis, projétil próprio, isolamento de E/W e comparações de histórico.
- `check-leblanc-browser.mjs`: seleção pela UI, os31 clipes, giro/movimento em quatro direções, S, combate ranged no nível1, pausa (inclusive WeaponSpin), histórico e troca de volta para Kayle com W original. Sem erros JavaScript/PropertyBinding observados.
- Capturas: `leblanc-idle.png`, `leblanc-spell1.png`, `leblanc-spell2.png`, `leblanc-spell3.png`, `leblanc-recall.png`, `leblanc-combat.png`.
