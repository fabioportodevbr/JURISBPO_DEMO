import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
function loadEnv(file){
  if(!fs.existsSync(file)) return {}
  const out={}
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if(!m || line.trim().startsWith('#')) continue
    let v=m[2]
    if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1)
    out[m[1]]=v
  }
  return out
}
const env={...loadEnv('.env'),...loadEnv('.env.local')}
const url=env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const key=env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if(!url || !key) throw new Error('Supabase URL/key ausente')
const sb=createClient(url,key,{auth:{persistSession:false}})
const tables=['processos','partes_crm','financeiro_processos','usuarios_escritorios','profiles']
const result={}
for(const t of tables){
  const {data,error}=await sb.from(t).select('*').limit(1)
  result[t]={ok:!error,error:error?.message||null,columns:data?.[0]?Object.keys(data[0]):[]}
}
const {data:processosCount,error:countError}=await sb.from('processos').select('id',{count:'exact',head:true})
result.processos_count={ok:!countError,error:countError?.message||null,count:processosCount}
console.log(JSON.stringify(result,null,2))