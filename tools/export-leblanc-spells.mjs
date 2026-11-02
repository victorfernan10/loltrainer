import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync(new URL('./leblanc-original/character.json',import.meta.url),'utf8'));
const data={};
for(const key of ['Q','W','E','R']){
  const spell=Object.entries(source).find(([path])=>path.endsWith('/Leblanc'+key))?.[1].mSpell;
  if(!spell)throw new Error(`Missing LeBlanc ${key}`);
  data[key]={cooldown:spell.cooldownTime,mana:spell.mana??[0,0,0],values:Object.fromEntries((spell.DataValues??[]).map(v=>[v.name,v.values]))};
}
fs.writeFileSync(new URL('../src/leblanc-data.js',import.meta.url),'// Generated from tools/leblanc-original/character.json (installed game snapshot).\nexport const spellData='+JSON.stringify(data,null,2)+';\n');
console.log('Exported normal-mode LeBlanc Q/W/E/R values.');
