'use strict';
const fs=require('node:fs'),path=require('node:path');
const extensions=new Set(['.txt','.md','.csv','.pdf','.docx','.xlsx','.pptx','.png','.jpg','.jpeg','.webp','.gif','.mp3','.wav','.mp4','.mov','.zip']);
function local(file){if(typeof file!=='string'||!path.isAbsolute(file)||file.startsWith('\\\\'))throw Error('Solo archivos/carpetas locales autorizados.');const resolved=fs.realpathSync(file);if(resolved.toLowerCase()!==path.resolve(file).toLowerCase())throw Error('No se admiten enlaces simbólicos ni redirecciones.');for(const root of [process.env.SystemRoot,process.env.APPDATA,process.env.LOCALAPPDATA].filter(Boolean)){if(resolved.toLowerCase()===root.toLowerCase()||resolved.toLowerCase().startsWith(root.toLowerCase()+path.sep))throw Error('Ruta de sistema o perfil protegida.');}if(/(?:^|[\\/])(?:\.ssh|\.gnupg|\.env|passwords?|credentials?|cookies?|tokens?|wallets?)(?:[\\/.]|$)/i.test(resolved))throw Error('Archivos sensibles no permitidos.');return resolved;}
function selection(file){const resolved=local(file);if(!fs.statSync(resolved).isFile()||!extensions.has(path.extname(resolved).toLowerCase()))throw Error('Selecciona un documento o recurso multimedia compatible.');return resolved;}
function createFileTools({settings,shell}){
 function describe(name,args){const cfg=settings(),file=selection(cfg.files?.[args.fileId]),stat=fs.statSync(file);let destination=null;
  if(name==='windows.rename_file'){if(!args.name||args.name!==path.basename(args.name)||/[<>:"/\\|?*\x00-\x1f]/.test(args.name)||/[. ]$/.test(args.name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(args.name))throw Error('Nombre de archivo inválido.');if(path.extname(args.name).toLowerCase()!==path.extname(file).toLowerCase())throw Error('El cambio de nombre conserva la extensión.');destination=path.join(path.dirname(file),args.name);}
  if(name==='windows.move_file'){const folder=local(cfg.locations?.[args.alias]);if(!fs.statSync(folder).isDirectory())throw Error('Destino no autorizado.');destination=path.join(folder,path.basename(file));}
  if(destination&&fs.existsSync(destination))throw Error('El destino ya existe; no se sobrescriben archivos.');
  return {file,destination,identity:{dev:stat.dev,ino:stat.ino,size:stat.size,mtime:stat.mtimeMs,birthtime:stat.birthtimeMs}};
 }
 return {selection,prepare(name,args){const snapshot=describe(name,args);return {snapshot,preview:{tool:name,...snapshot,warning:name==='windows.trash_file'?'Mover a Papelera; nunca eliminación permanente.':'Solo el archivo seleccionado. No se sobrescribe un destino existente.'}};},async execute(name,args,prepared){const snapshot=describe(name,args);if(!prepared?.snapshot||JSON.stringify(snapshot)!==JSON.stringify(prepared.snapshot))throw Error('El archivo o sus permisos cambiaron. Revisa una propuesta nueva.');
  if(name==='windows.reveal_file'){shell.showItemInFolder(snapshot.file);return {ok:true,data:{revealRequested:true}};}
  if(name==='windows.trash_file'){await shell.trashItem(snapshot.file);if(fs.existsSync(snapshot.file))throw Error('No se pudo verificar el traslado a Papelera.');return {ok:true,data:{trashed:true,permanentDeletion:false}};}
  if(!['windows.rename_file','windows.move_file'].includes(name))throw Error('Operación de archivo no permitida.');
  // No-clobber, same-volume only. If removing the old link fails, both
  // references remain and the user is warned. No copy or deletion fallback.
  fs.linkSync(snapshot.file,snapshot.destination);try{const original=fs.statSync(snapshot.file),destination=fs.statSync(snapshot.destination);if(original.ino!==destination.ino||original.dev!==destination.dev||original.size!==snapshot.identity.size||original.mtimeMs!==snapshot.identity.mtime)throw Error('El archivo cambió durante la operación.');fs.unlinkSync(snapshot.file);}catch{throw Error('Destino creado pero origen conservado. Revisa ambas ubicaciones antes de repetir.');}
  return {ok:true,data:{moved:true,source:snapshot.file,destination:snapshot.destination,verified:fs.existsSync(snapshot.destination)&&!fs.existsSync(snapshot.file)}};
 }};
}
module.exports={createFileTools,selection};
