const FIELDS=[['hunger','饱食'],['thirst','水分'],['cleanliness','清洁'],['happiness','心情'],['health','健康'],['energy','精力']];
const STAGES=['种子期','初级拉姆','中级拉姆','高级拉姆','神力拉姆'];
function trayStatusText(status){
 if(status===null)return '拉姆 · 等待领养';
 if(!status||typeof status.name!=='string'||!status.name.trim()||Array.from(status.name).length>16||/[\u0000-\u001f\u007f]/.test(status.name)
  ||!Number.isInteger(status.stage)||!STAGES[status.stage]||typeof status.sleeping!=='boolean'
  ||!status.stats||FIELDS.some(([key])=>typeof status.stats[key]!=='number'||!Number.isFinite(status.stats[key])||status.stats[key]<0||status.stats[key]>100)
  ||status.activity!==undefined&&!['course','restaurant','outing'].includes(status.activity))throw new TypeError('Invalid tray pet status');
 const activity=status.sleeping?'睡觉中':({course:'上课中',restaurant:'打工中',outing:'外出中'})[status.activity]??'陪伴中';
 return `${status.name} · ${STAGES[status.stage]} · ${activity}\n`+FIELDS.map(([key,label])=>`${label} ${Math.round(status.stats[key])}/100`).join('\n');
}
module.exports={trayStatusText};
