const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('d:/gcr/gcrapp/ValuationApp/src', (filePath) => {
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('https://gcr-9ys1.onrender.com')) {
      // Replace hardcoded URLs with ${API_BASE_URL}
      content = content.replace(/'https:\/\/gcr-9ys1\.onrender\.com([^']*)'/g, '`${API_BASE_URL}$1`');
      
      // Ensure API_BASE_URL is imported if not already
      if (!content.includes('import { API_BASE_URL }')) {
        const depth = filePath.split(path.sep).length - 'd:/gcr/gcrapp/ValuationApp/src'.split('/').length;
        let relativePath = '';
        for(let i=1; i<depth; i++) relativePath += '../';
        if (relativePath === '') relativePath = './';
        
        const importStr = `import { API_BASE_URL } from '${relativePath}config/api';\n`;
        content = importStr + content;
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`Updated ${filePath}`);
    }
  }
});
