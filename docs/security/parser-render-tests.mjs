import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),ts=require('../../node_modules/typescript/lib/typescript.js');
function loadTs(rel,extraRequire={}){
  const source=fsSync.readFileSync(path.join(root,rel),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={},module={exports};
  new vm.Script(code,{filename:rel}).runInNewContext({exports,module,Buffer,TextDecoder,process:{cwd:()=>root},setTimeout,clearTimeout,console:{error(){},log(){},warn(){}},require:n=>{
    if(n in extraRequire)return extraRequire[n];
    if(n==='@/lib/gemini/client')return {extractImageText:async()=>{throw Error('OCR disabled')}};
    if(n==='@/lib/uploads/limits'||n==='./limits')return loadTs('src/lib/uploads/limits.ts');
    if(n==='@/lib/uploads/constants'||n==='./constants')return loadTs('src/lib/uploads/constants.ts');
    if(n==='@/lib/uploads/validation')return loadTs('src/lib/uploads/validation.ts');
    if(['node:worker_threads','node:path','mammoth','jszip','fast-xml-parser','pdf-parse/lib/pdf-parse.js'].includes(n))return require(n);
    throw Error('blocked '+n);
  }},{timeout:5000});
  return module.exports;
}
const exports=loadTs('src/lib/materials/extract.ts');
const zip=new (require('jszip'))();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');zip.file('ppt/slides/slide1.xml','<p:sld xmlns:p="urn:fixture" xmlns:a="urn:fixture"><a:t>SECURITY_FIXTURE_PPTX</a:t></p:sld>');
const tiny=await zip.generateAsync({type:'nodebuffer'}),tests=[];
for(const item of [{name:'TXT positive',buffer:Buffer.from('SECURITY_FIXTURE_TXT'),mimeType:'text/plain',fileName:'fixture.txt'},{name:'Tiny PPTX positive',buffer:tiny,mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',fileName:'fixture.pptx'},{name:'MIME spoof text rejected',buffer:Buffer.from('<html>SECURITY_FIXTURE_HTML</html>'),mimeType:'text/plain',fileName:'fixture.pdf'},{name:'Unsupported format negative',buffer:Buffer.from('fixture'),mimeType:'application/x-fixture',fileName:'fixture.bin'}]){try{const segments=await exports.extractMaterialText(item);tests.push({name:item.name,bytes:item.buffer.length,segments:segments.length,accepted:true})}catch{tests.push({name:item.name,bytes:item.buffer.length,accepted:false})}}
const parser={isolation:'local parser modules; OCR mocked to throw; no network',tests};
await fs.writeFile(root+'/docs/security/parser-test-results.json',JSON.stringify(parser,null,2)+'\n');
const React=await import('../../node_modules/react/index.js'),rendered=await import('../../node_modules/react-dom/server.node.js'),markdown=await import('../../node_modules/react-markdown/index.js');
const html=rendered.renderToStaticMarkup(React.createElement(markdown.default,null,'<script>SECURITY_FIXTURE</script>\n\n[bad](javascript:alert(1))\n\n[good](https://links.fixture.invalid)'));
const render={renderer:'installed react-markdown defaults; full component/browser not tested',scriptElement:/<script[ >]/.test(html),javascriptHref:/href="javascript:/i.test(html),goodHttpsLink:html.includes('https://links.fixture.invalid')};
await fs.writeFile(root+'/docs/security/render-test-results.json',JSON.stringify(render,null,2)+'\n');console.log(JSON.stringify({parser,render},null,2));
if(!tests[0].accepted||!tests[1].accepted||tests[2].accepted||tests[3].accepted||render.scriptElement||render.javascriptHref||!render.goodHttpsLink)process.exitCode=1;
