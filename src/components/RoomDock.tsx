type Destination='status'|'food'|'shop'|'games'|'school'|'growth'|'memories'|'wardrobe'|'settings';
const destinations:{id:Destination;label:string;name:string;image:string}[]=[
 {id:'status',label:'状态',name:'我的拉姆',image:'ui/status-health'},
 {id:'food',label:'背包',name:'打开背包',image:'ui/toolbar-bag-normal'},
 {id:'shop',label:'商店',name:'进入商店',image:'room-icons/shop'},
 {id:'games',label:'游戏',name:'游乐时光',image:'items/180004'},
 {id:'school',label:'学院',name:'进入拉姆学院',image:'room-icons/school'},
 {id:'growth',label:'成长',name:'成长手册',image:'ui/sprout'},
 {id:'memories',label:'回忆',name:'照料回忆',image:'ui/icon-book-large'},
 {id:'wardrobe',label:'衣橱',name:'拉姆小衣橱',image:'wardrobe/party-cap'},
 {id:'settings',label:'设置',name:'陪伴设置',image:'room-icons/settings'},
];
export default function RoomDock({onSelect}:{onSelect:(destination:Destination)=>void}){
 return <nav className="classic-dock room-dock" aria-label="小屋功能">
  {destinations.map(({id,label,name,image})=><button key={id} aria-label={name} onClick={()=>onSelect(id)}><img className="original-ui-art" src={`./assets/original/${image}.png`} alt=""/><b>{label}</b></button>)}
 </nav>;
}
