/** Bounds retained decoded pixels. A running renderer holds its own reference. */
export class DecodedAssetCache<T> {
 private readonly inFlight=new Map<string,Promise<T>>();
 private readonly ready=new Map<string,{value:T;bytes:number}>();
 private retainedBytes=0;

 constructor(private readonly budget:()=>number,private readonly size:(asset:T)=>number){}

 get(key:string,load:()=>Promise<T>):Promise<T>{
  const cached=this.ready.get(key);
  if(cached){
   this.ready.delete(key);
   this.ready.set(key,cached);
   return Promise.resolve(cached.value);
  }
  const loading=this.inFlight.get(key);
  if(loading)return loading;

  const pending=Promise.resolve().then(load).then(value=>{
   const bytes=this.size(value),limit=this.budget();
   if(bytes<=limit){
    for(const [oldest,entry] of this.ready){
     if(this.retainedBytes+bytes<=limit)break;
     this.ready.delete(oldest);
     this.retainedBytes-=entry.bytes;
    }
    this.ready.set(key,{value,bytes});
    this.retainedBytes+=bytes;
   }
   return value;
  }).finally(()=>this.inFlight.delete(key));
  this.inFlight.set(key,pending);
  return pending;
 }
}
