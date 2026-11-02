// Installed Ahri/Locke character BINs; provenance and reconstruction limits:
// tools/matchup-evidence.md. Width here is full diameter (BIN missile width is radius).
export const matchupSkills={
  ahriQ:{id:'ahriQ',champion:'Ahri',key:'Q · ida',name:'Orbe da Ilusão',kind:'missile',range:970,width:200,speed:2500,warning:.25,color:'#79ddff'},
  ahriQReturn:{id:'ahriQReturn',champion:'Ahri',key:'Q · volta',name:'Retorno do orbe',kind:'missile',range:970,width:200,speed:60,warning:0,color:'#a7ecff'},
  ahriE:{id:'ahriE',champion:'Ahri',key:'E',name:'Charme',kind:'missile',range:975,width:120,speed:1550,warning:.25,color:'#ff8bc4'},
  ...Object.fromEntries([1,2,3].map(n=>[`lockeQ${n}`,{id:`lockeQ${n}`,champion:'Locke',key:`Q${n}`,name:'Pregos Rituais',kind:'missile',range:950,width:120,speed:1650,warning:.25,color:'#efae83'}])),
};
export const matchupProfiles={
  ahri:{name:'Ahri',speed:330,skills:['ahriQ','ahriQReturn','ahriE'],idle:'idle1',run:'run',textures:['ahri_base_tx_cm','ahri_base_tails_tx_cm'],hidden:['Tail_Large','Body_Proxy']},
  locke:{name:'Locke',speed:340,skills:['lockeQ1','lockeQ2','lockeQ3'],idle:'idle_base',run:'run',textures:['locke_base_main_tx_cm','locke_base_hair_tx_cm','locke_base_weapon_tx_cm'],hidden:['Nail','Weaponsmear','VFX_Head','VFX_Hair','VFX_Smoke']},
};
