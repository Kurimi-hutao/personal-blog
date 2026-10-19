// Cache only the Bilibili cover (never its video stream) in public Supabase Storage.
const OWNER="35bd70b7-54c4-4238-b583-e4fbcd2fea52";
const BASE=Deno.env.get("SUPABASE_URL")||"";
const ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const ANON=Deno.env.get("SUPABASE_ANON_KEY")||ROLE;
const BUCKET="article-attachments";
const ORIGINS=new Set(["https://joestarzhang.cn","https://www.joestarzhang.cn","https://kurimi-hutao.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5173","http://127.0.0.1:5173"]);
const MAX=3*1024*1024;
function respond(data:unknown,status:number,headers:Record<string,string>){
  return new Response(JSON.stringify(data),{status,headers:{...headers,"Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store"}});
}
function bv(v:unknown):v is string{return typeof v==="string"&&/^BV[a-zA-Z0-9]{10}$/.test(v);}
function pic(raw:unknown):URL|null{
  if(typeof raw!=="string")return null;
  try{
    const u=new URL(raw);
    if(!["https:","http:"].includes(u.protocol)||!/^i\d{1,2}\.hdslb\.com$/.test(u.hostname)||!/^\/bfs\/archive\/[a-zA-Z0-9._@!-]+$/.test(u.pathname))return null;
    u.protocol="https:";u.search="";return u;
  }catch{return null;}
}
function serviceHeaders(more:Record<string,string>={}){
  return {apikey:ROLE,authorization:"Bearer "+ROLE,...more};
}
async function authorized(req:Request){
  const authorization=req.headers.get("authorization")||"";
  if(!/^Bearer [^\s]+\.[^\s]+\.[^\s]+$/.test(authorization))return false;
  const r=await fetch(BASE+"/auth/v1/user",{headers:{authorization,apikey:ANON},signal:AbortSignal.timeout(8000)});
  if(!r.ok)return false;
  return (await r.json())?.id===OWNER;
}
type Row={id:string;video_url:string;video_poster:string|null;attachments:Record<string,unknown>[]};
async function published(id:string):Promise<Row|null>{
  const query=new URLSearchParams({select:"id,video_url,video_poster,attachments",content_type:"eq.video",published:"eq.true",deleted_at:"is.null",video_url:"ilike.*"+id+"*",limit:"5"});
  const r=await fetch(BASE+"/rest/v1/articles?"+query,{headers:serviceHeaders(),signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error("Database read failed: "+r.status);
  const rows=await r.json();
  return rows.find((row:Row)=>row.video_url.includes(id))||null;
}
async function metadata(id:string){
  const r=await fetch("https://api.bilibili.com/x/web-interface/view?bvid="+id,{
    headers:{Accept:"application/json",Referer:"https://www.bilibili.com/","User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(12000)
  });
  if(!r.ok)throw Error("Bilibili metadata HTTP "+r.status);
  const v=await r.json();
  if(v?.code!==0||v?.data?.bvid!==id)throw Error("Bilibili video metadata unavailable");
  const u=pic(v.data.pic);
  if(!u)throw Error("Invalid original Bilibili thumbnail URL");
  return u;
}
async function imageBytes(source:URL){
  const formats:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
  for(const host of new Set([source.hostname,"i0.hdslb.com","i1.hdslb.com","i2.hdslb.com"])){
    try{
      const u=new URL(source.toString());u.hostname=host;
      const r=await fetch(u,{headers:{Accept:"image/jpeg,image/png,image/webp,image/*",Referer:"https://www.bilibili.com/","User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(8000)});
      if(!r.ok||Number(r.headers.get("content-length")||0)>MAX)continue;
      const type=(r.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
      if(!formats[type])continue;
      const bytes=new Uint8Array(await r.arrayBuffer());
      if(bytes.byteLength<150||bytes.byteLength>MAX)continue;
      return {bytes,type,ext:formats[type]};
    }catch{/* try the next official Bilibili CDN hostname */}
  }
  throw Error("Cannot fetch Bilibili cover from CDN");
}
async function upload(id:string,data:{bytes:Uint8Array;type:string;ext:string}){
  const path="bilibili-covers/"+id+"."+data.ext;
  const r=await fetch(BASE+"/storage/v1/object/"+BUCKET+"/"+path,{
    method:"POST",headers:serviceHeaders({"Content-Type":data.type,"x-upsert":"true","cache-control":"public, max-age=86400"}),
    body:data.bytes,signal:AbortSignal.timeout(15000)
  });
  if(!r.ok)throw Error("Supabase cover upload failed HTTP "+r.status+" "+(await r.text()).slice(0,120));
  return BASE+"/storage/v1/object/public/"+BUCKET+"/"+path;
}
async function backfill(row:Row,publicUrl:string){
  if(row.video_poster&&!pic(row.video_poster))return;
  const existing=Array.isArray(row.attachments)?row.attachments:[];
  const former=existing.find(x=>x.role==="cover");
  if(former&&typeof former.url==="string"&&!pic(former.url))return;
  const attachments=[{name:"B站原始封面",role:"cover",url:publicUrl,type:"image/jpeg"},...existing.filter(x=>x.role!=="cover")];
  const r=await fetch(BASE+"/rest/v1/articles?id=eq."+encodeURIComponent(row.id),{
    method:"PATCH",headers:serviceHeaders({"Content-Type":"application/json",Prefer:"return=minimal"}),
    body:JSON.stringify({video_poster:publicUrl,attachments,updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(8000)
  });
  if(!r.ok)throw Error("Database poster update failed HTTP "+r.status);
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin");
  const cors:Record<string,string>={Vary:"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
  if(origin&&!ORIGINS.has(origin))return respond({error:"Origin not allowed"},403,cors);
  if(origin)cors["Access-Control-Allow-Origin"]=origin;
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="GET"&&req.method!=="POST")return respond({error:"Method not allowed"},405,cors);
  if(!BASE||!ROLE)return respond({error:"Storage service not configured"},503,cors);
  let id:unknown;
  if(req.method==="GET")id=new URL(req.url).searchParams.get("bvid");
  else {
    try{if(!(await authorized(req)))return respond({error:"Owner authorization required"},401,cors);}
    catch{return respond({error:"Authentication failed"},503,cors);}
    try{id=(await req.json()).bvid;}catch{return respond({error:"Malformed JSON"},400,cors);}
  }
  if(!bv(id))return respond({error:"Invalid Bilibili BV number"},400,cors);
  try{
    const row=await published(id);
    if(req.method==="GET"&&!row)return respond({error:"Not a published video"},404,cors);
    const prefix=BASE+"/storage/v1/object/public/"+BUCKET+"/bilibili-covers/";
    if(row?.video_poster?.startsWith(prefix))return respond({bvid:id,coverUrl:row.video_poster,cached:true},200,cors);
    if(row?.video_poster&&!pic(row.video_poster))return respond({bvid:id,coverUrl:row.video_poster,custom:true},200,cors);
    const source=pic(row?.video_poster)||await metadata(id);
    const bytes=await imageBytes(source);
    const coverUrl=await upload(id,bytes);
    if(row)await backfill(row,coverUrl);
    return respond({bvid:id,coverUrl,cached:false},200,cors);
  }catch(err){return respond({error:String(err instanceof Error?err.message:err)},502,cors);}
});
