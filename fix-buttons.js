const fs = require('fs');

function updateFile(path, replacer) {
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    let newContent = replacer(content);
    if (content !== newContent) {
      fs.writeFileSync(path, newContent, 'utf8');
      console.log(`Updated ${path}`);
    }
  }
}

// 1. Processos.jsx
updateFile('src/components/Processos.jsx', code => {
  code = code.replace(
    /style=\{\{background:C\.navy,color:'white',border:0,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  code = code.replace(
    /style=\{\{background:C\.white,color:C\.navy,border:'1px solid '\+C\.border,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center',cursor:'pointer'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  return code;
});

// 2. Contratos.jsx
updateFile('src/components/Contratos.jsx', code => {
  code = code.replace(
    /style=\{\{background:C\.navy,color:'white',border:0,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  code = code.replace(
    /style=\{\{background:C\.white,color:C\.navy,border:'1px solid '\+C\.border,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center',cursor:'pointer'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  return code;
});

// 3. PartesCrm.jsx
updateFile('src/components/PartesCrm.jsx', code => {
  code = code.replace(
    /style=\{\{background:C\.navy,color:'white',border:0,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  code = code.replace(
    /style=\{\{background:C\.white,color:C\.navy,border:'1px solid '\+C\.border,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center',cursor:'pointer'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  return code;
});

// 4. Acervo.jsx
updateFile('src/components/Acervo.jsx', code => {
  code = code.replace(
    /background: C\.primary, color: 'white'/g,
    "background: C.navy, color: 'white'"
  );
  code = code.replace(
    /background: active \? C\.primary : C\.white/g,
    "background: active ? C.navy : C.white"
  );
  code = code.replace(
    /border: '1px solid ' \+ \(active \? C\.primary : C\.border\)/g,
    "border: '1px solid ' + (active ? C.navy : C.border)"
  );
  return code;
});

// 5. Atividades.jsx
updateFile('src/components/Atividades.jsx', code => {
  code = code.replace(
    /style=\{\{background:C\.navy,color:'white',border:0,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  return code;
});

// 6. Calendario.jsx
updateFile('src/components/Calendario.jsx', code => {
  code = code.replace(
    /background: 'black'/g,
    "background: C.navy"
  );
  code = code.replace(
    /background:'black'/g,
    "background:C.navy"
  );
  code = code.replace(
    /background: '#000'/g,
    "background: C.navy"
  );
  code = code.replace(
    /background:C\.text,color:'white'/g,
    "background:C.navy,color:'white'"
  );
  code = code.replace(
    /style=\{\{background:C\.navy,color:'white',border:0,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  return code;
});

// 7. IaJuridica.jsx
updateFile('src/components/IaJuridica.jsx', code => {
  code = code.replace(
    /background:t\.id===activeTool\?C\.purple:C\.white/g,
    "background:t.id===activeTool?C.navy:C.white"
  );
  code = code.replace(
    /background: t\.id === activeTool \? C\.purple : C\.white/g,
    "background: t.id === activeTool ? C.navy : C.white"
  );
  code = code.replace(
    /background:t\.id===activeTool\?C\.primary:C\.white/g,
    "background:t.id===activeTool?C.navy:C.white"
  );
  code = code.replace(
    /border:'1px solid '\+\(t\.id===activeTool\?C\.purple:C\.border\)/g,
    "border:'1px solid '+(t.id===activeTool?C.navy:C.border)"
  );
  code = code.replace(
    /border: '1px solid ' \+ \(t\.id === activeTool \? C\.purple : C\.border\)/g,
    "border: '1px solid ' + (t.id === activeTool ? C.navy : C.border)"
  );
  return code;
});

// 8. Equipe.jsx
updateFile('src/components/Equipe.jsx', code => {
  code = code.replace(
    /background:C\.primary/g,
    "background:C.navy"
  );
  code = code.replace(
    /background: C\.primary/g,
    "background: C.navy"
  );
  code = code.replace(
    /style=\{\{background:C\.navy,color:'white',border:0,borderRadius:8,padding:'[^']+',fontWeight:800,display:'flex',gap:8,alignItems:'center'\}\}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}"
  );
  return code;
});
