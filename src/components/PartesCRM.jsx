import { useEffect, useMemo, useState } from 'react'
import { Building2, Plus, Search, X, Save, Trash2 } from 'lucide-react'
import { supabase, can, fetchAllRows } from '../lib/supabase.js'

import { C } from '../lib/theme'
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const TIPOS=[['empresa_grupo','Empresa do grupo'],['cliente','Cliente'],['fornecedor','Fornecedor/prestador'],['parte_contraria','Parte contrária'],['terceiro','Terceiro']]
const STATUS=[['ativo','Ativo'],['inativo','Inativo']]
const tipoKind={empresa_grupo:'blue',cliente:'green',fornecedor:'amber',parte_contraria:'red',terceiro:'gray'}
const tipoIcon={empresa_grupo:'🏢',cliente:'⭐',fornecedor:'🔧',parte_contraria:'⚖️',terceiro:'👤'}

function label(arr,v){return arr.find(x=>x[0]===v)?.[1]||v||'—'}
function F({label:lbl,children}){return <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>{lbl}</label>{children}</div>}
function Modal({title,onClose,children}){return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:820,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{display:'flex',justifyContent:'space-between',padding:18,borderBottom:'1px solid '+C.border,alignItems:'center'}}><b style={{fontSize:15}}>{title}</b><button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',display:'flex'}}><X size={18}/></button></div><div style={{padding:18,overflow:'auto',flex:1}}>{children}</div></div></div>}
function Chip({children,kind='gray'}){const m={blue:[C.blueBg,C.blue],green:[C.greenBg,C.green],red:[C.redBg,C.red],amber:[C.amberBg,C.amber],purple:[C.purpleBg,C.purple],gray:[C.grayBg,C.muted]};const[bg,color]=m[kind]||m.gray;return <span style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:20,background:bg,color,textTransform:'uppercase',whiteSpace:'nowrap'}}>{children}</span>}

const empty={nome:'',nome_fantasia:'',cnpj:'',tipo:'parte_contraria',grupo_economico:'',email:'',telefone:'',contato_principal:'',endereco:'',observacoes:'',status:'ativo'}
function normalizeParteNome(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function compactParteNome(s){return normalizeParteNome(s).replace(/[^a-z0-9]/g,'')}
function processoVinculadoParte(processo,parte){
  const parteId=String(parte?.id||'')
  const rows=Array.isArray(processo?.partes_contrarias)?processo.partes_contrarias:[]
  if(parteId&&rows.some(r=>String(r?.id||r?.parte_contraria_id||'')===parteId))return true
  if(parteId&&String(processo?.parte_contraria_id||'')===parteId)return true
  const nomes=[parte?.nome,parte?.nome_fantasia].map(normalizeParteNome).filter(Boolean)
  const procNomes=rows.map(r=>r?.nome||r?.parte_contraria).filter(Boolean)
  if(!procNomes.length&&processo?.parte_contraria)procNomes.push(...String(processo.parte_contraria).split(/\s+\|\s+|;\s*/))
  return procNomes.some(pn=>{
    const norm=normalizeParteNome(pn),pc=compactParteNome(pn)
    return nomes.some(en=>{
      const ec=compactParteNome(en)
      return norm===en || (pc&&ec&&(pc===ec||(pc.length>=12&&ec.length>=12&&(pc.includes(ec)||ec.includes(pc)))))
    })
  })
}

/* ── Card clicável de parte ── */
function ParteCard({p,s,onOpen}){
  const[hov,setHov]=useState(false)
  const inativo=p.status==='inativo'
  const kind=tipoKind[p.tipo]||'gray'
  const fmtBRL=v=>v>0?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}):'—'

  return(
    <button
      onClick={()=>onOpen(p)}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'inherit',
        background:hov?C.grayBg:C.white,
        border:'1px solid '+(hov?C.muted:C.border),
        borderRadius:12,padding:'14px 16px',
        display:'flex',flexDirection:'column',gap:10,
        opacity:inativo?0.72:1,
        transition:'all .12s',
        boxShadow:hov?'0 2px 8px rgba(0,0,0,0.08)':'none',
      }}
    >
      {/* Linha 1: tipo + status */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <Chip kind={kind}>{tipoIcon[p.tipo]} {label(TIPOS,p.tipo)}</Chip>
        <span style={{
          fontSize:10,fontWeight:700,
          color:inativo?C.muted:C.green,
          display:'flex',alignItems:'center',gap:4,
        }}>
          <span style={{width:6,height:6,borderRadius:'50%',background:inativo?C.muted:C.green,display:'inline-block'}}/>
          {inativo?'Inativo':'Ativo'}
        </span>
      </div>

      {/* Linha 2: nome */}
      <div>
        <div style={{fontSize:14,fontWeight:800,color:C.text,lineHeight:1.3,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
          {p.nome}
        </div>
        {p.nome_fantasia&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{p.nome_fantasia}</div>}
        {p.cnpj&&<div style={{fontSize:11,color:C.muted,marginTop:3,fontFamily:'monospace,monospace',letterSpacing:'0.02em'}}>{p.cnpj}</div>}
        {p.grupo_economico&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>Grupo: {p.grupo_economico}</div>}
      </div>

      {/* Linha 3: stats compactas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
        {[
          {v:s.qtd,  label:'processos', color:s.qtd>0?C.blue:C.muted},
          {v:s.ativos,label:'ativos',   color:s.ativos>0?C.green:C.muted},
          {v:fmtBRL(s.economia),label:'economia',color:s.economia>0?C.green:C.muted,small:true},
        ].map(({v,label:lbl,color,small})=>(
          <div key={lbl} style={{background:C.bg,borderRadius:8,padding:'7px 8px',border:'1px solid '+C.border}}>
            <div style={{fontSize:small?11:15,fontWeight:800,color,lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Linha 4: contato (só se existir) */}
      {(p.contato_principal||p.email||p.telefone)&&(
        <div style={{borderTop:'1px solid '+C.border,paddingTop:8,display:'flex',flexDirection:'column',gap:3}}>
          {p.contato_principal&&<span style={{fontSize:11,color:C.muted}}>👤 {p.contato_principal}</span>}
          {p.email&&<span style={{fontSize:11,color:C.muted}}>✉ {p.email}</span>}
          {p.telefone&&<span style={{fontSize:11,color:C.muted}}>📞 {p.telefone}</span>}
        </div>
      )}
    </button>
  )
}

/* ── Componente principal ── */
export default function PartesCRM({profile}){
  const[partes,setPartes]=useState([])
  const[processos,setProcessos]=useState([])
  const[q,setQ]=useState('')
  const[tipo,setTipo]=useState('empresa_grupo')
  const[modal,setModal]=useState(false)
  const[form,setForm]=useState(empty)
  const[loading,setLoading]=useState(true)
  const[loadError,setLoadError]=useState('')
  const[saving,setSaving]=useState(false)

  const canEditPartes=can(profile,'processos.editar')

  const load=async()=>{
    const eid=profile.escritorio_id
    if(!eid){setLoading(false);return}
    setLoading(true)
    setLoadError('')
    try{
      const[p,proc]=await Promise.all([
        fetchAllRows(()=>supabase.from('partes_crm').select('*').eq('escritorio_id',eid).order('nome')),
        fetchAllRows(()=>supabase.from('processos').select('*').eq('escritorio_id',eid))
      ])
      setPartes(p||[])
      setProcessos(proc||[])
    }catch(error){
      console.error('[PartesCRM] Erro ao carregar dados:',error)
      setLoadError(error?.message||'Nao foi possivel carregar as partes.')
      setPartes([])
      setProcessos([])
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{load()},[profile?.escritorio_id])

  const filtradas=useMemo(()=>{
    const term=q.trim().toLowerCase()
    return partes.filter(p=>(tipo==='todos'||p.tipo===tipo)&&(!term||[p.nome,p.nome_fantasia,p.cnpj,p.grupo_economico,p.email,p.contato_principal].some(v=>String(v||'').toLowerCase().includes(term))))
  },[partes,q,tipo])

  const stats=(p)=>{
    const vinculados=processos.filter(x=>processoVinculadoParte(x,p))
    return{
      qtd:vinculados.length,
      ativos:vinculados.filter(x=>x.status!=='encerrado').length,
      valorCausa:vinculados.reduce((s,x)=>s+Number(x.valor_acao||0),0),
      gasto:vinculados.reduce((s,x)=>s+Number(x.valor_gasto||0),0),
      economia:vinculados.reduce((s,x)=>s+Number(x.valor_economizado||0),0),
    }
  }

  const open=(p=null)=>{
    if(!canEditPartes)return alert('Visitante possui acesso somente leitura.')
    setForm(p?{...empty,...p}:empty)
    setModal(true)
  }

  const save=async()=>{
    if(!canEditPartes)return alert('Visitante possui acesso somente leitura.')
    if(!form.nome.trim())return alert('Informe o nome da parte.')
    setSaving(true)
    const payload={...form,nome:form.nome.trim(),escritorio_id:profile.escritorio_id,created_by:form.created_by||profile.id}
    const r=form.id
      ?await supabase.from('partes_crm').update(payload).eq('id',form.id)
      :await supabase.from('partes_crm').insert(payload)
    setSaving(false)
    if(r.error)return alert(r.error.message)
    setModal(false);load()
  }

  const del=async(p)=>{
    if(!can(profile,'processos.editar'))return alert('Sem permissão.')
    const s=stats(p)
    if(s.qtd>0)return alert('Esta parte possui '+s.qtd+' processo(s) vinculado(s).\nInative-a em vez de excluir.')
    if(!confirm('Excluir "'+p.nome+'" do CRM? Esta ação não pode ser desfeita.'))return
    const{error}=await supabase.from('partes_crm').delete().eq('id',p.id)
    if(error)return alert(error.message)
    setModal(false);load()
  }

  /* contagens por tipo para o filtro */
  const countPorTipo=useMemo(()=>partes.reduce((acc,p)=>{acc[p.tipo]=(acc[p.tipo]||0)+1;return acc},{}),[partes])

  if(loading)return <div style={{padding:40,color:C.muted}}>Carregando partes...</div>
  if(loadError)return <div style={{padding:40,color:C.red}}>
    <b>Nao foi possivel carregar Partes / CRM.</b>
    <div style={{marginTop:6,fontSize:13}}>{loadError}</div>
  </div>

  return(
    <div style={{padding:24}}>

      {/* ── Cabeçalho ── */}
      <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'flex-start',marginBottom:20}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:900,display:'flex',alignItems:'center',gap:10}}>
            <Building2 size={20} color={C.navy}/>Partes / CRM Jurídico
          </h1>
          <p style={{color:C.muted,margin:'5px 0 0',fontSize:13}}>Empresas do grupo, clientes, fornecedores e partes contrárias recorrentes.</p>
        </div>
        {can(profile,'processos.criar')&&(
          <button onClick={()=>open()} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',border:'none',borderRadius:8,background:C.navy,color:'white',cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit',whiteSpace:'nowrap'}}>
            <Plus size={14}/>Nova Parte
          </button>
        )}
      </div>

      {/* ── Filtros ── */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        {/* busca */}
        <div style={{position:'relative',flex:1,minWidth:240}}>
          <Search size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:C.muted,pointerEvents:'none'}}/>
          <input
            style={{...INP,paddingLeft:34,background:C.bg}}
            placeholder="Buscar por nome, CNPJ, grupo, contato ou e-mail…"
            value={q}
            onChange={e=>setQ(e.target.value)}
          />
          {q&&<button onClick={()=>setQ('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',border:0,background:'none',cursor:'pointer',color:C.muted,display:'flex'}}><X size={13}/></button>}
        </div>

        {/* filtro tipo — chips horizontais */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {[['todos','Todos',partes.length],...TIPOS.map(([v,l])=>[v,l,countPorTipo[v]||0])].map(([v,l,ct])=>(
            <button
              key={v}
              onClick={()=>setTipo(v)}
              style={{
                border:'1px solid '+(tipo===v?C.navy:C.border),
                borderRadius:20,padding:'6px 12px',
                background:tipo===v?C.navy:C.white,
                color:tipo===v?'white':C.text,
                fontWeight:700,fontSize:12,cursor:'pointer',
                display:'flex',alignItems:'center',gap:5,
                transition:'all .12s',whiteSpace:'nowrap',
              }}
            >
              {l}
              {ct>0&&<span style={{fontSize:10,fontWeight:900,background:tipo===v?'rgba(255,255,255,0.25)':'#e2e8f0',color:tipo===v?'white':C.muted,borderRadius:999,padding:'0 6px'}}>{ct}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de cards ── */}
      {filtradas.length>0
        ?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
            {filtradas.map(p=><ParteCard key={p.id} p={p} s={stats(p)} onOpen={open}/>)}
          </div>
        ):(
          <div style={{background:C.white,border:'1px dashed '+C.border,borderRadius:12,padding:40,textAlign:'center',color:C.muted}}>
            <Building2 size={28} style={{marginBottom:8,opacity:0.3}}/>
            <p style={{margin:0,fontSize:14}}>Nenhuma parte encontrada.</p>
          </div>
        )
      }

      {/* ── Modal ── */}
      {modal&&(
        <Modal title={form.id?'Editar parte':'Nova parte'} onClose={()=>setModal(false)}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
            <F label="Nome / razão social"><input style={INP} value={form.nome||''} onChange={e=>setForm({...form,nome:e.target.value})}/></F>
            <F label="Nome fantasia"><input style={INP} value={form.nome_fantasia||''} onChange={e=>setForm({...form,nome_fantasia:e.target.value})}/></F>
            <F label="CNPJ / CPF"><input style={INP} value={form.cnpj||''} onChange={e=>setForm({...form,cnpj:e.target.value})}/></F>
            <F label="Tipo">
              <select style={INP} value={form.tipo||'parte_contraria'} onChange={e=>setForm({...form,tipo:e.target.value})}>
                {TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </F>
            <F label="Grupo econômico"><input style={INP} value={form.grupo_economico||''} onChange={e=>setForm({...form,grupo_economico:e.target.value})}/></F>
            <F label="Status">
              <select style={INP} value={form.status||'ativo'} onChange={e=>setForm({...form,status:e.target.value})}>
                {STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </F>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:4}}>
            <F label="Contato principal"><input style={INP} value={form.contato_principal||''} onChange={e=>setForm({...form,contato_principal:e.target.value})}/></F>
            <F label="E-mail"><input style={INP} value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></F>
            <F label="Telefone"><input style={INP} value={form.telefone||''} onChange={e=>setForm({...form,telefone:e.target.value})}/></F>
          </div>
          <F label="Endereço"><input style={INP} value={form.endereco||''} onChange={e=>setForm({...form,endereco:e.target.value})}/></F>
          <F label="Observações"><textarea style={{...INP,minHeight:80,resize:'vertical',fontFamily:'inherit'}} value={form.observacoes||''} onChange={e=>setForm({...form,observacoes:e.target.value})}/></F>

          {/* Rodapé: excluir + salvar */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginTop:16,paddingTop:14,borderTop:'1px solid '+C.border,flexWrap:'wrap'}}>
            <div>
              {form.id&&canEditPartes&&(
                <button
                  type="button"
                  onClick={()=>del(form)}
                  style={{display:'flex',alignItems:'center',gap:6,border:'1px solid '+C.red,background:C.redBg,borderRadius:8,padding:'8px 14px',fontWeight:700,cursor:'pointer',color:C.red,fontSize:13}}
                >
                  <Trash2 size={14}/>Excluir parte
                </button>
              )}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setModal(false)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px',cursor:'pointer',fontWeight:700,fontSize:14}}>Cancelar</button>
              <button onClick={save} disabled={saving} style={{background:saving?C.muted:C.navy,color:'white',border:0,borderRadius:8,padding:'10px 18px',fontWeight:800,fontSize:14,cursor:saving?'default':'pointer',display:'flex',alignItems:'center',gap:7}}>
                <Save size={15}/>{saving?'Salvando…':'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
