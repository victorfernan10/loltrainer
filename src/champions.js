// LeBlanc data: tools/leblanc-original/character.json. Gameplay radius remains
// the existing trainer calibration; selection/pathfinding radii are not hitboxes.
export const champions={
  caitlyn:{name:'Caitlyn',moveSpeed:325,missileSpeed:2500,windupFraction:.17708333135,castFrame:7},
  xerath:{name:'Xerath',moveSpeed:340,missileSpeed:2000,windupFraction:.2,castFrame:10},
  quinn:{name:'Quinn',moveSpeed:330,missileSpeed:2000,windupFraction:.17543860077858,castFrame:5.2},
  kayle:{name:'Kayle',moveSpeed:335,missileSpeed:2250,windupFraction:.3/1.55,castFrame:8},
  leblanc:{name:'LeBlanc',moveSpeed:340,missileSpeed:1700,windupFraction:.32575*.658,castFrame:8},
  syndra:{name:'Syndra',moveSpeed:330,missileSpeed:1800,windupFraction:.1875,castFrame:15.075},
};
export function championRange(id='kayle',level=6){return id==='caitlyn'?650:id==='syndra'?550:(id==='xerath'||id==='leblanc'||id==='quinn')?525:level>=16?625:level>=6?525:150;}

export const leblancClipLabels={
  idle1:'Repouso',idle3:'Repouso alternativo',idle_in:'Entrada em repouso',run1:'Corrida',run_homeguard:'Corrida acelerada',run_homeguard_in:'Entrada na corrida acelerada',
  attack1:'Autoattack 1',attack2:'Autoattack 2',spell1:'Q · conjuração',spell1_run:'Q · corrida',spell2:'W · deslocamento',spell2_recast:'W · retorno',spell2_recast2:'W · retorno alternativo',spell2_recast_idle:'W · retorno em repouso',spell2_toidle:'W → repouso',spell2_torun:'W → corrida',spell3:'E · conjuração',spell3_channel:'E · canalização',spell3_run:'E · corrida',
  channel:'Canalização',channel_wndup:'Entrada em canalização',dance:'Dança',death:'Morte',joke:'Piada',knockup:'Arremessada ao ar',laugh:'Risada',recall:'Retorno à base',respawn:'Renascimento',stunned:'Atordoamento',taunt:'Provocação',weaponspin:'Giro do cajado',
};
