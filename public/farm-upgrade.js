'use strict';
window.FarmUpgrade={
 catalog:[['Iniciación cerdos','Tradicional',335],['Crecimiento cerdos','Tradicional',320],['Desarrollo cerdos','Tradicional',309],['Engorda cerdos','Tradicional',303],['Engorda cerdos Racto','Tradicional',319],['Reproductora gestación N','Tradicional',288],['Reproductora lactancia','Tradicional',349],['Iniciación cerdos Hi-Magra','Hi-Magra',354],['Crecimiento cerdos Hi-Magra','Hi-Magra',325],['Engorda cerdos Racto Hi-Magra','Hi-Magra',331],['Reproductora gestación Hi-Magra','Hi-Magra',301],['Reproductora lactancia Hi-Magra','Hi-Magra',367],['Iniciación cerdos MPG AVI','Pellet',294],['Engorda cerdos MPG AVI','Pellet',241]],
 migrate(input){if(input.version===3)return structuredClone(input);if(input.version!==2)throw new Error('Primero migra al esquema 2.');const s=structuredClone(input),stamp=s.migrated_at||new Date().toISOString();for(const c of Pig.collections)s[c]=s[c]||[];s.farmMigrationReport=s.farmMigrationReport||[];
 for(const a of s.farmAnimals){const old=a.reproductive_state,first=s.farmEvents.filter(e=>e.animal_id===a.id&&!e.reverted_at).sort((a,b)=>a.date.localeCompare(b.date))[0],base=first?.before;a.migration_original={...(a.migration_original||{}),reproductive_state:old,status:a.status,current_state_since:a.current_state_since};a.reproductive_baseline=a.reproductive_baseline||{state:Pig.breeding(a)?Pig.normalize(base?.reproductive_state||(!first?old:'open')):'not_applicable',life:base?.status||(!first?a.status:'active'),since:base?.current_state_since||a.current_state_since||null,serviceDate:!first&&old==='gestation'?a.current_state_since||null:null,farrowingDate:!first&&old==='lactation'?a.current_state_since||null:null};
 if(a.celo_date&&V2Domain.date(a.celo_date)&&!s.farmEvents.some(e=>e.animal_id===a.id&&e.type==='heat_observed'&&e.date===a.celo_date)){const id='c3100000-0000-4000-8000-'+a.id.replace(/-/g,'').slice(-12);s.farmEvents.push({id,animal_id:a.id,type:'heat_observed',date:a.celo_date,idempotency_key:id,source:'migration-celo-date',created_at:stamp,updated_at:stamp,schema_version:3});}
 const derived=Pig.derive(s,a);a.reproductive_state=derived.state;a.status=derived.life;a.current_state_since=derived.since;if(old==='gestation'&&derived.state==='served_pending_confirmation')s.farmMigrationReport.push({animal_id:a.id,ear_tag:a.ear_tag,original:old,current:derived.state,reason:'Una monta no acredita gestación; requiere revisión registrada.'});}
 for(const f of s.farmSettings){f.maternity_capacity??=3;f.prefarrowing_days??=7;f.check_days??=28;f.late_gestation_day??=85;f.safety_buffer_percent??=0;f.water_check??=true;}
 FarmUpgrade.catalog.forEach(([name,line,price],n)=>{const tail=String(n+1).padStart(12,'0'),id='fe300000-0000-4000-8000-'+tail;if(s.farmFeedProducts.some(p=>p.id===id))return;s.farmFeedProducts.push({id,name,title:name,brand:'MAFORNU',line,form:line==='Pellet'?'pellet':'harina',bag_weight_g:40000,active:false,requires_compliance_review:name.includes('Racto'),compliance_confirmed:false,created_at:stamp,updated_at:stamp,source:'photo-reference-table'});s.farmFeedPriceHistory.push({id:'fe310000-0000-4000-8000-'+tail,product_id:id,price_cents:price*100,currency:'MXN',effective_date:'2026-09-13',status:'reference_needs_confirmation',source:'photo_price_board',created_at:stamp,updated_at:stamp});});
 s.version=3;s.farm_schema_version=3;s.migrations=[...(s.migrations||[]),{version:3,from:2,at:stamp,description:'Ciclo porcino por eventos y alimentación sin referencias activadas.'}];return s;
 }
};
V2Domain.collections.push(...Pig.collections.filter(c=>!V2Domain.collections.includes(c)));

// Catalog-only revision: the data schema remains 3 until entityLinks migration is ready.
FarmUpgrade.referencesV4=[
 ['PIGGO F1 K','Preiniciador',25000,66200],['PIGGO F2 F','Preiniciador',25000,56200],['PIGGO F3 K','Preiniciador',25000,50700],
 ['Maíz grano amarillo','Materia prima',40000,31000],['Maíz grano blanco','Materia prima',40000,31000],['Maíz molido amarillo','Materia prima',40000,31000],['Maíz quebrado amarillo','Materia prima',40000,31000],
 ['Pasta de canola','Materia prima',40000,30600],['Pasta de soya','Materia prima',40000,42000],['Salvado de trigo','Materia prima',25000,19600],['Sorgo en grano','Materia prima',40000,29500],['Sorgo molido','Materia prima',40000,29500],['Trigo en grano','Materia prima',40000,38600],['Palmalife','Mineral/sustituto',25000,77500],['Suplemento mineral estándar con fósforo','Mineral',25000,28500],['Suplemento mineral para engorda con monensina','Mineral',20000,24000]
];
FarmUpgrade.upgradeReferences=function(input,force=false){
 const s=structuredClone(input);if(s.farm_catalog_version===4&&!force)return s;
 V2Domain.assert(s.version>=3,'Actualiza primero el esquema de Granja.');
 const stamp=new Date().toISOString(),normalize=name=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 let productsAdded=0,pricesAdded=0;
 FarmUpgrade.referencesV4.forEach(([name,category,weight,price],n)=>{
  const tail=String(n+1).padStart(12,'0'),id='fe400000-0000-4000-8000-'+tail,priceId='fe410000-0000-4000-8000-'+tail;
  let product=s.farmFeedProducts.find(p=>p.id===id)||s.farmFeedProducts.find(p=>normalize(p.name)===normalize(name)&&p.bag_weight_g===weight);
  if(!product){product={id,name,title:name,brand:'Referencia MAFORNU',line:category,category,bag_weight_g:weight,active:false,status:'reference_needs_confirmation',requires_compliance_review:/monensina|racto/i.test(name),compliance_confirmed:false,source:'photo_price_board',observed_at:'2026-09-16',created_at:stamp,updated_at:stamp};s.farmFeedProducts.push(product);productsAdded++;}
  // Respect existing/deleted records and never overwrite a user's confirmed prices.
  if(product.deleted_at)return;
  const exists=s.farmFeedPriceHistory.some(p=>p.id===priceId||(p.product_id===product.id&&p.effective_date==='2026-09-16'&&p.price_cents===price&&p.source==='photo_price_board'));
  if(!exists){s.farmFeedPriceHistory.push({id:priceId,product_id:product.id,price_cents:price,currency:'MXN',effective_date:'2026-09-16',status:'reference_needs_confirmation',source:'photo_price_board',created_at:stamp,updated_at:stamp});pricesAdded++;}
 });
 s.farm_catalog_version=4;
 s.catalog_updates=s.catalog_updates||[];
 if(!s.catalog_updates.some(x=>x.key==='mafornu-2026-09-16'))s.catalog_updates.push({key:'mafornu-2026-09-16',at:stamp,products_added:productsAdded,prices_added:pricesAdded,description:'Referencias inactivas. Sin raciones, inventario ni gasto.'});
 return s;
};
{
 const migrateV3=FarmUpgrade.migrate;
 FarmUpgrade.migrate=function(input){return FarmUpgrade.upgradeReferences(migrateV3(input),input.version<3);};
}

