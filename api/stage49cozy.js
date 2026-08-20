const AdmZip=require('adm-zip');
const MOD={modId:20011,fileId:118893,version:'1.0.2',path:'[CP] Cozy Chocolate Furniture/i18n/default.json'};
const COLORS={
 Red:{m:'красный',f:'красная',n:'красное',pl:'красные'},Purple:{m:'фиолетовый',f:'фиолетовая',n:'фиолетовое',pl:'фиолетовые'},Green:{m:'зелёный',f:'зелёная',n:'зелёное',pl:'зелёные'},Blue:{m:'синий',f:'синяя',n:'синее',pl:'синие'},Cream:{m:'кремовый',f:'кремовая',n:'кремовое',pl:'кремовые'},Brown:{m:'коричневый',f:'коричневая',n:'коричневое',pl:'коричневые'},LightBrown:{m:'светло-коричневый',f:'светло-коричневая',n:'светло-коричневое',pl:'светло-коричневые'}
};
const SIZE={Small:'Маленький',Medium:'Средний',Large:'Большой',ExtraLarge:'Очень большой'};
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
function c(x,g){return COLORS[x]&&COLORS[x][g]}
function num(s){const m=s.match(/(\d+)$/);return m?` №${m[1]}`:''}
function stem(s){return s.replace(/\d+$/,'')}
function translate(full){const k=full.replace(/^skellady\.CCF\./,'');let m,n= num(k),b=stem(k);
 if((m=b.match(/^(Red|Purple|Green|Blue|Cream)Chair$/)))return `${cap(c(m[1],'m'))} стул`;
 if((m=b.match(/^(Red|Purple|Green|Blue|Cream)Stool$/)))return `${cap(c(m[1],'m'))} табурет`;
 if(b==='CozyChocolateCatalogue')return 'Каталог уютной шоколадной мебели';
 if((m=b.match(/^Cozy(Red|Purple|Green|Blue|Cream)Armchair$/)))return `Уютное ${c(m[1],'n')} кресло`;
 if((m=b.match(/^Cozy(Red|Purple|Green|Blue|Cream)Couch$/)))return `Уютный ${c(m[1],'m')} диван`;
 if((m=b.match(/^Cozy(Red|Purple|Green|Blue|Cream)CushionedCouch$/)))return `Уютный ${c(m[1],'m')} диван с подушками`;
 if(b==='ChocolateBench')return 'Шоколадная скамья'; if(b==='WhiteChocolateBench')return 'Скамья из белого шоколада';
 if(b==='ChocolateDresser')return 'Шоколадный комод'; if(b==='WhiteChocolateDresser')return 'Комод из белого шоколада';
 if(b==='ChocolateVanity')return 'Шоколадный туалетный столик'; if(b==='WhiteChocolateVanity')return 'Туалетный столик из белого шоколада';
 if(b==='ChocolateMirror')return 'Шоколадное зеркало'; if(b==='WhiteChocolateMirror')return 'Зеркало из белого шоколада';
 if(b==='BrownDiningTable')return 'Коричневый обеденный стол';
 if(b==='FancyBrownDiningTable')return `Изысканный коричневый обеденный стол${n}`;
 if(b==='DecoratedBrownDiningTable')return 'Украшенный коричневый обеденный стол';
 if(b==='DecoratedFancyDiningTable')return `Украшенный изысканный обеденный стол${n}`;
 if(b==='ChocolateIsland')return 'Шоколадный кухонный остров'; if(b==='WhiteChocolateIsland')return 'Кухонный остров из белого шоколада';
 if(b==='StripedChocolateIsland')return 'Полосатый шоколадный кухонный остров'; if(b==='StripedWhiteChocolateIsland')return 'Полосатый кухонный остров из белого шоколада';
 if(b==='ChocolateTable')return 'Шоколадный стол'; if(b==='DecoratedChocolateTable')return `Украшенный шоколадный стол${n}`;
 if(b==='WhiteChocolateTable')return 'Стол из белого шоколада'; if(b==='DecoratedWhiteChocolateTable')return `Украшенный стол из белого шоколада${n}`;
 if(b==='ChocolateTeaTable')return 'Шоколадный чайный столик'; if(b==='DecoratedChocolateTeaTable')return `Украшенный шоколадный чайный столик${n}`; if(b==='FlatChocolateTeaTable')return `Плоский шоколадный чайный столик${n}`;
 if(b==='WhiteChocolateTeaTable')return 'Чайный столик из белого шоколада'; if(b==='DecoratedWhiteChocolateTeaTable')return `Украшенный чайный столик из белого шоколада${n}`; if(b==='FlatWhiteChocolateTeaTable')return `Плоский чайный столик из белого шоколада${n}`;
 if(b==='ChocolateEndTable')return `Шоколадный приставной столик${n}`; if(b==='WhiteChocolateEndTable')return `Приставной столик из белого шоколада${n}`;
 if(b==='ChocolateCoffeeTable')return `Шоколадный журнальный столик${n}`; if(b==='WhiteChocolateCoffeeTable')return 'Журнальный столик из белого шоколада';
 if(b==='LongChocolateCoffeeTable')return `Длинный шоколадный журнальный столик${n}`;
 if((m=b.match(/^(Small|Medium|Large|ExtraLarge)ChocolateBookcase$/)))return `${SIZE[m[1]]} шоколадный книжный шкаф`;
 if(b==='ChocolateCloset')return 'Шоколадный шкаф'; if(b==='WhiteChocolateCloset')return 'Шкаф из белого шоколада'; if(b==='SmallChocolateCloset')return 'Маленький шоколадный шкаф'; if(b==='SmallWhiteChocolateCloset')return 'Маленький шкаф из белого шоколада';
 if(b==='LargeHousePlant')return 'Большое комнатное растение'; if(b==='HousePlant')return 'Комнатное растение'; if(b==='LeafDecal')return 'Наклейка с листом'; if(b==='LongLeafDecal')return 'Длинная наклейка с листом'; if(b==='HangingPlant')return 'Подвесное растение';
 if(b==='ChocolateClothesHanger')return 'Шоколадная вешалка для одежды';
 if((m=b.match(/^Cozy(Red|Purple|Green|Blue|Brown)Vase$/)))return `Уютная ${c(m[1],'f')} ваза`;
 if(b==='CozyPotions')return 'Уютные зелья'; if(b==='CozyBooks')return 'Уютные книги'; if(b==='CozyCandles')return 'Уютные свечи';
 if((m=b.match(/^Small(Red|Purple|Green|Blue|Cream)Vase$/)))return `Маленькая ${c(m[1],'f')} ваза`;
 if((m=b.match(/^(Red|Purple|Green|Blue)MushroomPot$/)))return `${cap(c(m[1],'m'))} горшок с грибами`;
 if((m=b.match(/^Fancy(Red|Purple|Green|Blue|Cream|Brown)Rug$/)))return `Изысканный ${c(m[1],'m')} ковёр`;
 if((m=b.match(/^Square(Red|Purple|Green|Blue|Cream|LightBrown|Brown)Rug$/)))return `Квадратный ${c(m[1],'m')} ковёр`;
 if((m=b.match(/^Large(Red|Purple|Green|Blue|Cream|Brown)Rug$/)))return `Большой ${c(m[1],'m')} ковёр`;
 if((m=b.match(/^Small(Red|Purple|Green|Blue|Cream|Brown)Rug$/)))return `Маленький ${c(m[1],'m')} ковёр`;
 if((m=b.match(/^Cozy(Red|Purple|Green|Blue|Cream|Brown)Mat$/)))return `Уютный ${c(m[1],'m')} коврик`;
 if(b==='DecorativeTV')return `Декоративный телевизор${n}`;
 if(b==='SmallChocolateWindow')return 'Маленькое шоколадное окно'; if(b==='MediumChocolateWindow')return 'Среднее шоколадное окно'; if(b==='ChocolateWindow')return `Шоколадное окно${n}`;
 if(b==='SmallWhiteChocolateWindow')return 'Маленькое окно из белого шоколада'; if(b==='MediumWhiteChocolateWindow')return 'Среднее окно из белого шоколада'; if(b==='WhiteChocolateWindow')return `Окно из белого шоколада${n}`;
 if(b==='ChocolateFireplace')return 'Шоколадный камин';
 if((m=b.match(/^Cozy(Red|Purple|Green|Blue)Bed$/)))return `Уютная ${c(m[1],'f')} кровать`;
 if((m=b.match(/^(Red|Purple|Green|Blue)PinstripeDoubleBed$/)))return `${cap(c(m[1],'f'))} двуспальная кровать в тонкую полоску${n}`;
 if(b==='BigChocolateCrate')return 'Большой шоколадный ящик'; if(b==='SmallChocolateCrate')return 'Маленький шоколадный ящик'; if(b==='SwordDecor')return 'Декоративный меч'; if(b==='HangingBookcase')return 'Подвесной книжный шкаф';
 if(b==='ChocolatePedestal')return 'Шоколадный пьедестал';
 if(b==='ChocolateShelf')return `Шоколадная полка${n}`; if(b==='WhiteChocolateShelf')return `Полка из белого шоколада${n}`; if(b==='DoubleChocolateShelf')return `Двойная шоколадная полка${n}`; if(b==='DoubleWhiteChocolateShelf')return `Двойная полка из белого шоколада${n}`;
 if(b==='SmallCozyPainting')return 'Маленькая уютная картина'; if(b==='LargeChocolatePainting')return 'Большая шоколадная картина'; if(b==='LargeWhiteChocolatePainting')return 'Большая картина из белого шоколада';
 if(b==='ChocolateWallMirror')return 'Шоколадное настенное зеркало'; if(b==='WhiteChocolateWallMirror')return 'Настенное зеркало из белого шоколада';
 if(b==='ChocolateCabinet')return `Шоколадный шкафчик${n}`; if(b==='SmallChocolateCabinet')return 'Маленький шоколадный шкафчик'; if(b==='WhiteChocolateCabinet')return `Шкафчик из белого шоколада${n}`; if(b==='SmallWhiteChocolateCabinet')return 'Маленький шкафчик из белого шоколада';
 if(b==='CozySconce')return 'Уютное бра'; if(b==='ChocolatePiano')return 'Шоколадное пианино'; if(b==='WhiteChocolatePiano')return 'Пианино из белого шоколада'; if(b==='FancyChocolatePiano')return 'Изысканное шоколадное пианино';
 return null;
}
async function getDefault(){const u=`https://nexus-loader.vercel.app/api/nexusarchive?modId=${MOD.modId}&fileId=${MOD.fileId}&path=${encodeURIComponent(MOD.path)}`;const r=await fetch(u,{headers:{'User-Agent':'nexus-loader-stage49/1.0'}});if(!r.ok)throw new Error(`source HTTP ${r.status}`);const j=await r.json();if(!j.ok||!j.text)throw new Error('source missing');return JSON.parse(j.text)}
module.exports=async function handler(req,res){try{const src=await getDefault(),keys=Object.keys(src);if(keys.length!==197)throw new Error(`source keys ${keys.length} != 197`);const ru={},missing=[];for(const k of keys){const v=translate(k);if(!v)missing.push(k);else ru[k]=v}if(missing.length)throw new Error('untranslated keys: '+missing.join(','));if(Object.keys(ru).length!==197)throw new Error('RU key count mismatch');for(const [k,v] of Object.entries(ru))if(!/[А-Яа-яЁё]/.test(v)||/[A-Za-z]{3,}/.test(v))throw new Error(`English remains in ${k}: ${v}`);const zip=new AdmZip();zip.addFile('Mods/[CP] Cozy Chocolate Furniture/i18n/ru.json',Buffer.from(JSON.stringify(ru,null,2)+'\n','utf8'));const buf=zip.toBuffer(),report={ok:true,stage:49,mods:1,name:'Cozy Chocolate Furniture',version:MOD.version,fileId:MOD.fileId,sourceKeys:keys.length,translatedKeys:Object.keys(ru).length,missing:0,englishUserFacingValues:0,idsChanged:0,zipBytes:buf.length};if(String(req.query.status||'')==='1')return res.json(report);res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="RU_STAGE49_COZY_CHOCOLATE_1.0.2_VERIFIED.zip"');res.setHeader('Cache-Control','no-store');return res.status(200).send(buf)}catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)})}}
