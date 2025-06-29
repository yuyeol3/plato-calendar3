// build.js
const esbuild = require('esbuild');

esbuild.build({
  entryPoints: [ // 번들링할 파일 목록
    'src/popup.ts',
    'src/background/background.ts',
    'src/content_scripts/content.ts'
  ],
  bundle: true,        // 모든 파일을 하나로 묶음
  outdir: 'dist',      // 결과물이 저장될 폴더
  sourcemap: 'inline', // 디버깅을 위한 소스맵
}).catch(() => process.exit(1));

console.log('✅ Build finished!');