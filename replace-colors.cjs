const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.js') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);

files.forEach(file => {
  if (file.endsWith('Auth.jsx')) return; // skip Auth.jsx, we will restore it from backup
  
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Replace #064e3b with #10b981
  content = content.replace(/'#064e3b'/g, "'#10b981'");
  content = content.replace(/"#064e3b"/g, '"#10b981"');
  
  // Replace #050505 with #022c22
  content = content.replace(/'#050505'/g, "'#022c22'");
  content = content.replace(/"#050505"/g, '"#022c22"');
  content = content.replace(/#050505/g, '#022c22'); // For css
  
  // App.jsx specific adjustments
  if (file.endsWith('App.jsx')) {
      content = content.replace(/navyL: '#111827'/, "navyL: '#064e3b'");
      content = content.replace(/border: '3px solid #022c22'/g, "border: '3px solid rgba(6, 78, 59, 0.1)'");
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log('Colors replaced successfully');
